import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../config.js";
import type { ToolResult } from "../errors.js";
import { registerBatchTools } from "../tools/batch.js";
import { getTrackedTab, removeTrackedTab, trackTab } from "../state.js";
import type { ToolDeps } from "../server.js";
import type { TabInfo } from "../types.js";

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

describe("tools/batch", () => {
  let deps: ToolDeps;
  const createdTabIds: string[] = [];

  beforeEach(() => {
    deps = {
      client: {
        typeText: vi.fn(),
        click: vi.fn()
      } as unknown as ToolDeps["client"],
      config: loadConfig([], { CAMOFOX_URL: "http://test-camofox:9377" } as NodeJS.ProcessEnv)
    };
  });

  afterEach(() => {
    for (const tabId of createdTabIds.splice(0, createdTabIds.length)) {
      removeTrackedTab(tabId);
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("fill_form", () => {
    it("all fields succeed -> success true, filled=N, total=N", async () => {
      const tabId = "tab-fill-all";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      (deps.client.typeText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const { server, getHandler } = makeServerCapture();
      registerBatchTools(server as unknown as Parameters<typeof registerBatchTools>[0], deps);
      const handler = getHandler("fill_form");

      const result = await handler({
        tabId,
        fields: [
          { ref: "e1", text: "a" },
          { selector: "#two", text: "b" }
        ]
      });

      expect(result.isError).toBe(false);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({
        success: true,
        filled: 2,
        total: 2
      });
      expect(payload.results).toHaveLength(2);
      expect(payload.results.map((r: any) => r.success)).toEqual([true, true]);

      expect(deps.client.typeText).toHaveBeenCalledTimes(2);
      expect(deps.client.click).not.toHaveBeenCalled();

      expect(getTrackedTab(tabId).toolCalls).toBe(1);
    });

    it("first field fails -> early return with partial results and stops remaining fields", async () => {
      const tabId = "tab-fill-first-fails";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      (deps.client.typeText as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("bad field"));

      const { server, getHandler } = makeServerCapture();
      registerBatchTools(server as unknown as Parameters<typeof registerBatchTools>[0], deps);
      const handler = getHandler("fill_form");

      const result = await handler({
        tabId,
        fields: [
          { ref: "e1", text: "a" },
          { selector: "#two", text: "b" }
        ]
      });

      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({
        success: false,
        filled: 0,
        total: 2,
        submitted: false
      });
      expect(payload.results).toHaveLength(1);
      expect(payload.results[0]).toMatchObject({ index: 0, success: false, error: "bad field" });

      expect(deps.client.typeText).toHaveBeenCalledTimes(1);
      expect(deps.client.click).not.toHaveBeenCalled();

      expect(getTrackedTab(tabId).toolCalls).toBe(0);
    });

    it("middle field fails -> success false, filled=K, total=N, partial results", async () => {
      const tabId = "tab-fill-middle-fails";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      const typeText = deps.client.typeText as unknown as ReturnType<typeof vi.fn>;
      typeText.mockResolvedValueOnce(undefined);
      typeText.mockRejectedValueOnce(new Error("nope"));
      typeText.mockResolvedValueOnce(undefined);

      const { server, getHandler } = makeServerCapture();
      registerBatchTools(server as unknown as Parameters<typeof registerBatchTools>[0], deps);
      const handler = getHandler("fill_form");

      const result = await handler({
        tabId,
        fields: [
          { ref: "e1", text: "a" },
          { selector: "#two", text: "b" },
          { ref: "e3", text: "c" }
        ]
      });

      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({
        success: false,
        filled: 1,
        total: 3,
        submitted: false
      });
      expect(payload.results).toHaveLength(2);
      expect(payload.results.map((r: any) => r.success)).toEqual([true, false]);
      expect(payload.results[1]).toMatchObject({ index: 1, success: false, error: "nope" });

      expect(deps.client.typeText).toHaveBeenCalledTimes(2);
      expect(deps.client.click).not.toHaveBeenCalled();
      expect(getTrackedTab(tabId).toolCalls).toBe(0);
    });

    it("with submit button -> clicks submit after filling", async () => {
      const tabId = "tab-fill-with-submit";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      (deps.client.typeText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (deps.client.click as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const { server, getHandler } = makeServerCapture();
      registerBatchTools(server as unknown as Parameters<typeof registerBatchTools>[0], deps);
      const handler = getHandler("fill_form");

      const result = await handler({
        tabId,
        fields: [
          { ref: "e1", text: "a" },
          { selector: "#two", text: "b" }
        ],
        submit: { selector: "button[type=submit]" }
      });

      expect(result.isError).toBe(false);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({
        success: true,
        filled: 2,
        total: 2,
        submitted: true
      });
      expect(deps.client.typeText).toHaveBeenCalledTimes(2);
      expect(deps.client.click).toHaveBeenCalledTimes(1);
      expect(deps.client.click).toHaveBeenCalledWith(
        tabId,
        { ref: undefined, selector: "button[type=submit]" },
        "user-1"
      );
      expect(getTrackedTab(tabId).toolCalls).toBe(1);
    });

    it("submit fails -> returns toErrorResult (fields were typed, toolCalls not incremented)", async () => {
      const tabId = "tab-fill-submit-fails";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      (deps.client.typeText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (deps.client.click as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("submit failed"));

      const { server, getHandler } = makeServerCapture();
      registerBatchTools(server as unknown as Parameters<typeof registerBatchTools>[0], deps);
      const handler = getHandler("fill_form");

      const result = await handler({
        tabId,
        fields: [
          { ref: "e1", text: "a" },
          { selector: "#two", text: "b" }
        ],
        submit: { ref: "e-submit" }
      });

      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({
        isError: true,
        code: "INTERNAL_ERROR"
      });
      expect(String(payload.message)).toContain("submit failed");

      expect(deps.client.typeText).toHaveBeenCalledTimes(2);
      expect(deps.client.click).toHaveBeenCalledTimes(1);
      expect(getTrackedTab(tabId).toolCalls).toBe(0);
    });

    it("empty fields array -> returns VALIDATION_ERROR (graceful error result)", async () => {
      const tabId = "tab-fill-empty";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      const { server, getHandler } = makeServerCapture();
      registerBatchTools(server as unknown as Parameters<typeof registerBatchTools>[0], deps);
      const handler = getHandler("fill_form");

      const result = await handler({
        tabId,
        fields: []
      });

      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({
        isError: true,
        code: "VALIDATION_ERROR"
      });

      expect(deps.client.typeText).not.toHaveBeenCalled();
      expect(deps.client.click).not.toHaveBeenCalled();
      expect(getTrackedTab(tabId).toolCalls).toBe(0);
    });
  });

  describe("batch_click", () => {
    it("all clicks succeed -> returns all success", async () => {
      const tabId = "tab-click-all";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      (deps.client.click as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const { server, getHandler } = makeServerCapture();
      registerBatchTools(server as unknown as Parameters<typeof registerBatchTools>[0], deps);
      const handler = getHandler("batch_click");

      const result = await handler({
        tabId,
        clicks: [{ ref: "e1" }, { selector: "#two" }, { ref: "e3" }],
        delayMs: 0
      });

      expect(result.isError).toBe(false);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({
        success: true,
        clicked: 3,
        total: 3
      });
      expect(payload.results).toHaveLength(3);
      expect(payload.results.map((r: any) => r.success)).toEqual([true, true, true]);
      expect(deps.client.click).toHaveBeenCalledTimes(3);
      expect(getTrackedTab(tabId).toolCalls).toBe(1);
    });

    it("one click fails -> continues to other clicks", async () => {
      const tabId = "tab-click-one-fails";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      const click = deps.client.click as unknown as ReturnType<typeof vi.fn>;
      click.mockResolvedValueOnce(undefined);
      click.mockRejectedValueOnce(new Error("no click"));
      click.mockResolvedValueOnce(undefined);

      const { server, getHandler } = makeServerCapture();
      registerBatchTools(server as unknown as Parameters<typeof registerBatchTools>[0], deps);
      const handler = getHandler("batch_click");

      const result = await handler({
        tabId,
        clicks: [{ ref: "e1" }, { selector: "#two" }, { ref: "e3" }],
        delayMs: 0
      });

      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({
        success: false,
        clicked: 2,
        total: 3
      });
      expect(payload.results).toHaveLength(3);
      expect(payload.results.map((r: any) => r.success)).toEqual([true, false, true]);
      expect(payload.results[1]).toMatchObject({ index: 1, success: false, error: "no click" });
      expect(deps.client.click).toHaveBeenCalledTimes(3);
      expect(getTrackedTab(tabId).toolCalls).toBe(1);
    });

    it("all clicks fail -> returns all failures, success=false", async () => {
      const tabId = "tab-click-all-fail";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      (deps.client.click as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("always"));

      const { server, getHandler } = makeServerCapture();
      registerBatchTools(server as unknown as Parameters<typeof registerBatchTools>[0], deps);
      const handler = getHandler("batch_click");

      const result = await handler({
        tabId,
        clicks: [{ ref: "e1" }, { selector: "#two" }],
        delayMs: 0
      });

      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({
        success: false,
        clicked: 0,
        total: 2
      });
      expect(payload.results).toHaveLength(2);
      expect(payload.results.map((r: any) => r.success)).toEqual([false, false]);
      expect(deps.client.click).toHaveBeenCalledTimes(2);
      expect(getTrackedTab(tabId).toolCalls).toBe(1);
    });

    it("with delay -> applies delay between clicks", async () => {
      vi.useFakeTimers();

      const tabId = "tab-click-delay";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      (deps.client.click as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const { server, getHandler } = makeServerCapture();
      registerBatchTools(server as unknown as Parameters<typeof registerBatchTools>[0], deps);
      const handler = getHandler("batch_click");

      const pending = handler({
        tabId,
        clicks: [{ ref: "e1" }, { ref: "e2" }, { ref: "e3" }],
        delayMs: 200
      });

      await Promise.resolve();
      expect(deps.client.click).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(200);
      await Promise.resolve();
      expect(deps.client.click).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(200);
      const result = await pending;
      expect(deps.client.click).toHaveBeenCalledTimes(3);

      expect(result.isError).toBe(false);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ success: true, clicked: 3, total: 3 });
    });

    it("single click -> no delay needed", async () => {
      vi.useFakeTimers();

      const tabId = "tab-click-single";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      (deps.client.click as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const { server, getHandler } = makeServerCapture();
      registerBatchTools(server as unknown as Parameters<typeof registerBatchTools>[0], deps);
      const handler = getHandler("batch_click");

      const result = await handler({
        tabId,
        clicks: [{ selector: "#only" }]
      });

      expect(deps.client.click).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(false);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ success: true, clicked: 1, total: 1 });
    });
  });
});
