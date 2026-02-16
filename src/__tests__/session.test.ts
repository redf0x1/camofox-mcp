import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../config.js";
import type { ToolResult } from "../errors.js";
import { getAllTrackedTabs, getTrackedTab, removeTrackedTab, trackTab } from "../state.js";
import { registerSessionTools } from "../tools/session.js";
import type { ToolDeps } from "../server.js";
import type { TabInfo } from "../types.js";

vi.mock("../profiles.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../profiles.js")>();
  return {
    ...actual,
    saveProfile: vi.fn(),
    withAutoTimeout: vi.fn()
  };
});

import { saveProfile, withAutoTimeout } from "../profiles.js";

function parseToolTextJson(result: ToolResult): any {
  const first = result.content[0];
  if (!first || first.type !== "text") {
    throw new Error("Expected first content entry to be text");
  }
  return JSON.parse(first.text);
}

function makeServerCapture(): {
  server: { tool: ReturnType<typeof vi.fn> };
  getHandler: (name: string) => (input: unknown) => Promise<ToolResult>;
} {
  const server = {
    tool: vi.fn()
  };

  const getHandler = (name: string) => {
    const call = server.tool.mock.calls.find((c) => c[0] === name);
    if (!call) {
      throw new Error(`Expected tool '${name}' to be registered`);
    }
    return call[3] as (input: unknown) => Promise<ToolResult>;
  };

  return { server, getHandler };
}

function makeTab(tabId: string, overrides: Partial<TabInfo> = {}): TabInfo {
  return {
    tabId,
    url: "http://example.com",
    createdAt: "2026-02-16T00:00:00.000Z",
    lastActivity: 0,
    userId: "user-1",
    sessionKey: "session-1",
    visitedUrls: [],
    toolCalls: 0,
    refsCount: 0,
    ...overrides
  };
}

describe("tools/session camofox_close_session", () => {
  let deps: ToolDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = {
      client: {
        exportCookies: vi.fn(),
        closeSession: vi.fn()
      } as unknown as ToolDeps["client"],
      config: loadConfig([], {
        CAMOFOX_URL: "http://test-camofox:9377",
        CAMOFOX_DEFAULT_USER_ID: "default",
        CAMOFOX_AUTO_SAVE: "true"
      } as NodeJS.ProcessEnv)
    };

    vi.mocked(withAutoTimeout).mockImplementation(async (promise: Promise<any>) => {
      try {
        const value = await promise;
        return { ok: true as const, value };
      } catch (error) {
        return { ok: false as const, reason: "error" as const, error };
      }
    });
  });

  afterEach(() => {
    for (const tab of getAllTrackedTabs()) {
      removeTrackedTab(tab.tabId);
    }
    vi.clearAllMocks();
  });

  it("close session without auto-save", async () => {
    trackTab(makeTab("tab-sess-1", { userId: "user-1", url: "http://a.com" }));
    trackTab(makeTab("tab-sess-2", { userId: "user-1", url: "http://b.com" }));

    vi.mocked(deps.client.closeSession).mockResolvedValue(undefined);

    const { server, getHandler } = makeServerCapture();
    registerSessionTools(server as unknown as Parameters<typeof registerSessionTools>[0], deps);
    const handler = getHandler("camofox_close_session");

    const result = await handler({ tabId: "tab-sess-2" });

    expect(result.isError).toBeFalsy();
    const payload = parseToolTextJson(result);
    expect(String(payload.message)).toContain("Session closed");
    expect(payload.autoSaved).toBe(false);

    expect(withAutoTimeout).not.toHaveBeenCalled();
    expect(deps.client.exportCookies).not.toHaveBeenCalled();
    expect(saveProfile).not.toHaveBeenCalled();

    expect(deps.client.closeSession).toHaveBeenCalledWith("user-1");
    expect(() => getTrackedTab("tab-sess-1")).toThrow();
    expect(() => getTrackedTab("tab-sess-2")).toThrow();
  });

  it("close session with auto-save succeeds", async () => {
    deps.config.apiKey = "test-key";
    deps.config.autoSave = true;

    trackTab(makeTab("tab-sess-auto-1", { userId: "user-1", url: "http://a.com" }));
    trackTab(makeTab("tab-sess-auto-2", { userId: "user-1", url: "http://b.com" }));

    vi.mocked(deps.client.exportCookies).mockResolvedValueOnce([
      { name: "sid", value: "1", domain: "example.com", path: "/" }
    ]);
    vi.mocked(saveProfile).mockResolvedValueOnce({} as any);
    vi.mocked(deps.client.closeSession).mockResolvedValue(undefined);

    const { server, getHandler } = makeServerCapture();
    registerSessionTools(server as unknown as Parameters<typeof registerSessionTools>[0], deps);
    const handler = getHandler("camofox_close_session");

    const result = await handler({ tabId: "tab-sess-auto-2" });

    expect(result.isError).toBeFalsy();
    const payload = parseToolTextJson(result);
    expect(payload.autoSaved).toBe(true);

    expect(deps.client.exportCookies).toHaveBeenCalledWith("tab-sess-auto-2", "user-1");
    expect(saveProfile).toHaveBeenCalledWith(
      deps.config.profilesDir,
      "_auto_user-1",
      "user-1",
      [{ name: "sid", value: "1", domain: "example.com", path: "/" }],
      { description: "Auto-saved session", lastUrl: "http://b.com" }
    );

    expect(deps.client.closeSession).toHaveBeenCalledWith("user-1");
    expect(() => getTrackedTab("tab-sess-auto-1")).toThrow();
    expect(() => getTrackedTab("tab-sess-auto-2")).toThrow();
  });

  it("close session auto-save fails gracefully", async () => {
    deps.config.apiKey = "test-key";
    deps.config.autoSave = true;

    trackTab(makeTab("tab-sess-fail-1", { userId: "user-1", url: "http://a.com" }));
    trackTab(makeTab("tab-sess-fail-2", { userId: "user-1", url: "http://b.com" }));

    vi.mocked(deps.client.exportCookies).mockRejectedValueOnce(new Error("export failed"));
    vi.mocked(deps.client.closeSession).mockResolvedValue(undefined);

    const { server, getHandler } = makeServerCapture();
    registerSessionTools(server as unknown as Parameters<typeof registerSessionTools>[0], deps);
    const handler = getHandler("camofox_close_session");

    const result = await handler({ tabId: "tab-sess-fail-1" });

    expect(result.isError).toBeFalsy();
    const payload = parseToolTextJson(result);
    expect(payload.autoSaved).toBe(false);

    expect(saveProfile).not.toHaveBeenCalled();
    expect(deps.client.closeSession).toHaveBeenCalledWith("user-1");
    expect(() => getTrackedTab("tab-sess-fail-1")).toThrow();
    expect(() => getTrackedTab("tab-sess-fail-2")).toThrow();
  });

  it("close_session when closeSession throws -> still clears tracked tabs", async () => {
    trackTab(makeTab("tab-sess-throw-1", { userId: "user-1", url: "http://a.com" }));
    trackTab(makeTab("tab-sess-throw-2", { userId: "user-1", url: "http://b.com" }));

    vi.mocked(deps.client.closeSession).mockRejectedValueOnce(new Error("close failed"));

    const { server, getHandler } = makeServerCapture();
    registerSessionTools(server as unknown as Parameters<typeof registerSessionTools>[0], deps);
    const handler = getHandler("camofox_close_session");

    const result = await handler({ tabId: "tab-sess-throw-2" });

    expect(result.isError).toBe(true);
    expect(deps.client.closeSession).toHaveBeenCalledWith("user-1");
    expect(() => getTrackedTab("tab-sess-throw-1")).toThrow();
    expect(() => getTrackedTab("tab-sess-throw-2")).toThrow();
  });
});
