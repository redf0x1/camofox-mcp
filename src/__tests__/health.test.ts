import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "../config.js";
import type { ToolResult } from "../errors.js";
import type { ToolDeps } from "../server.js";
import { registerHealthTools } from "../tools/health.js";

function parseToolTextJson(result: ToolResult): any {
  const first = result.content[0];
  if (!first || first.type !== "text") {
    throw new Error("Expected first content entry to be text");
  }
  return JSON.parse(first.text);
}

function makeServerCapture(): {
  server: { tool: ReturnType<typeof vi.fn> };
  getHandler: (name: string) => () => Promise<ToolResult>;
} {
  const server = {
    tool: vi.fn()
  };

  const getHandler = (name: string) => {
    const call = server.tool.mock.calls.find((c) => c[0] === name);
    if (!call) {
      throw new Error(`Expected tool '${name}' to be registered`);
    }
    return call[3] as () => Promise<ToolResult>;
  };

  return { server, getHandler };
}

describe("tools/health", () => {
  it("server_status distinguishes reachable browser server from active browser session", async () => {
    const { server, getHandler } = makeServerCapture();
    const deps: ToolDeps = {
      client: {
        healthCheck: vi.fn(async () => ({
          ok: true,
          running: true,
          browserConnected: false,
          version: "2.4.1"
        }))
      } as unknown as ToolDeps["client"],
      config: loadConfig([], { CAMOFOX_URL: "http://test-camofox:9377" } as NodeJS.ProcessEnv)
    };

    registerHealthTools(server as unknown as Parameters<typeof registerHealthTools>[0], deps);

    const payload = parseToolTextJson(await getHandler("server_status")());

    expect(payload).toMatchObject({
      ok: true,
      running: true,
      reachable: true,
      browserConnected: false,
      browserSessionActive: false,
      version: "2.4.1",
      activeTabCount: 0
    });
    expect(payload.guidance).toMatch(/reachable/i);
    expect(payload.guidance).toMatch(/create_tab/i);
  });
});
