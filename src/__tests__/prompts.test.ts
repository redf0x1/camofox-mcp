import { beforeEach, describe, expect, it, vi } from "vitest";

import { GetPromptResultSchema } from "@modelcontextprotocol/sdk/types.js";

import { loadConfig } from "../config.js";
import { registerPrompts } from "../prompts.js";

import type { ToolDeps } from "../server.js";

describe("prompts", () => {
  let deps: ToolDeps;

  beforeEach(() => {
    deps = {
      client: {} as ToolDeps["client"],
      config: loadConfig([], { CAMOFOX_URL: "http://test-camofox:9377" } as NodeJS.ProcessEnv)
    };
  });

  it("registerPrompts() registers 3 prompts", () => {
    const server = {
      registerPrompt: vi.fn()
    };

    registerPrompts(server as unknown as Parameters<typeof registerPrompts>[0], deps);

    expect(server.registerPrompt).toHaveBeenCalledTimes(3);

    const names = server.registerPrompt.mock.calls.map((call) => call[0]);
    expect(names).toEqual(["setup-verify", "troubleshoot", "quick-start"]);
  });

  it("each prompt callback returns a valid GetPromptResult", () => {
    const server = {
      registerPrompt: vi.fn()
    };

    registerPrompts(server as unknown as Parameters<typeof registerPrompts>[0], deps);

    for (const call of server.registerPrompt.mock.calls) {
      const cb = call[2] as (...args: unknown[]) => unknown;
      const result = cb({}, {});
      expect(() => GetPromptResultSchema.parse(result)).not.toThrow();
    }
  });

  it("troubleshoot prompt handles optional symptom arg", () => {
    const server = {
      registerPrompt: vi.fn()
    };

    registerPrompts(server as unknown as Parameters<typeof registerPrompts>[0], deps);

    const troubleshootCall = server.registerPrompt.mock.calls.find((call) => call[0] === "troubleshoot");
    if (!troubleshootCall) {
      throw new Error("Expected troubleshoot prompt to be registered");
    }

    const cb = troubleshootCall[2] as (args: { symptom?: string }) => unknown;

    const noSymptom = cb({});
    const noSymptomText = GetPromptResultSchema.parse(noSymptom).messages[0]?.content;
    if (!noSymptomText || noSymptomText.type !== "text") {
      throw new Error("Expected text content");
    }
    expect(noSymptomText.text).not.toContain("Symptom:");

    const withSymptom = cb({ symptom: "connection refused" });
    const withSymptomText = GetPromptResultSchema.parse(withSymptom).messages[0]?.content;
    if (!withSymptomText || withSymptomText.type !== "text") {
      throw new Error("Expected text content");
    }
    expect(withSymptomText.text).toContain("Symptom: connection refused");
  });

  it("quick-start prompt handles optional task arg", () => {
    const server = {
      registerPrompt: vi.fn()
    };

    registerPrompts(server as unknown as Parameters<typeof registerPrompts>[0], deps);

    const quickStartCall = server.registerPrompt.mock.calls.find((call) => call[0] === "quick-start");
    if (!quickStartCall) {
      throw new Error("Expected quick-start prompt to be registered");
    }

    const cb = quickStartCall[2] as (args: { task?: string }) => unknown;

    const noTask = cb({});
    const noTaskText = GetPromptResultSchema.parse(noTask).messages[0]?.content;
    if (!noTaskText || noTaskText.type !== "text") {
      throw new Error("Expected text content");
    }
    expect(noTaskText.text).not.toContain("I want to:");

    const withTask = cb({ task: "scrape a website" });
    const withTaskText = GetPromptResultSchema.parse(withTask).messages[0]?.content;
    if (!withTaskText || withTaskText.type !== "text") {
      throw new Error("Expected text content");
    }
    expect(withTaskText.text).toContain("I want to: scrape a website");
  });
});
