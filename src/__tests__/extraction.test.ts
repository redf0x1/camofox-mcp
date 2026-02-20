import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../config.js";
import type { ToolResult } from "../errors.js";
import { getTrackedTab, removeTrackedTab, trackTab } from "../state.js";
import type { ToolDeps } from "../server.js";
import { registerExtractionTools } from "../tools/extraction.js";
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

describe("tools/extraction", () => {
  let deps: ToolDeps;
  const createdTabIds: string[] = [];

  beforeEach(() => {
    deps = {
      client: {
        extractResources: vi.fn(),
        batchDownload: vi.fn(),
        resolveBlobs: vi.fn()
      } as unknown as ToolDeps["client"],
      config: loadConfig([], { CAMOFOX_URL: "http://test:9377" } as NodeJS.ProcessEnv)
    };
  });

  afterEach(() => {
    for (const tabId of createdTabIds.splice(0, createdTabIds.length)) {
      removeTrackedTab(tabId);
    }
    vi.restoreAllMocks();
  });

  describe("extract_resources", () => {
    it("calls client.extractResources with tabId and params (forwards filters)", async () => {
      const tabId = "tab-extract";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId, { userId: "user-1" }));

      const response = { resources: [{ type: "images", url: "http://x" }], count: 1 };
      vi.mocked(deps.client.extractResources).mockResolvedValueOnce(response as any);

      const { server, getHandler } = makeServerCapture();
      registerExtractionTools(server as unknown as Parameters<typeof registerExtractionTools>[0], deps);
      const handler = getHandler("extract_resources");

      const result = await handler({
        tabId,
        selector: ".post",
        types: ["images", "links"],
        extensions: ["jpg", "png"],
        resolveBlobs: true,
        triggerLazyLoad: true,
        maxDepth: 3
      });

      expect(result.isError).toBeFalsy();
      expect(parseToolTextJson(result)).toEqual(response);
      expect(deps.client.extractResources).toHaveBeenCalledWith(tabId, {
        userId: "user-1",
        selector: ".post",
        ref: undefined,
        types: ["images", "links"],
        extensions: ["jpg", "png"],
        resolveBlobs: true,
        triggerLazyLoad: true,
        maxDepth: 3
      });
      expect(getTrackedTab(tabId).toolCalls).toBe(1);
    });

    it("requires tabId (should error without tracked tab)", async () => {
      const { server, getHandler } = makeServerCapture();
      registerExtractionTools(server as unknown as Parameters<typeof registerExtractionTools>[0], deps);
      const handler = getHandler("extract_resources");

      const result = await handler({ tabId: "missing", selector: ".x" });
      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ isError: true, code: "TAB_NOT_FOUND" });
      expect(deps.client.extractResources).not.toHaveBeenCalled();
    });

    it("increments tool call counter on tracked tab", async () => {
      const tabId = "tab-extract-toolcalls";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));
      vi.mocked(deps.client.extractResources).mockResolvedValueOnce({ ok: true } as any);

      const { server, getHandler } = makeServerCapture();
      registerExtractionTools(server as unknown as Parameters<typeof registerExtractionTools>[0], deps);
      const handler = getHandler("extract_resources");

      await handler({ tabId, selector: ".x" });
      expect(getTrackedTab(tabId).toolCalls).toBe(1);
    });

    it("client error -> returns error result", async () => {
      const tabId = "tab-extract-error";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));
      vi.mocked(deps.client.extractResources).mockRejectedValueOnce(new Error("extract failed"));

      const { server, getHandler } = makeServerCapture();
      registerExtractionTools(server as unknown as Parameters<typeof registerExtractionTools>[0], deps);
      const handler = getHandler("extract_resources");

      const result = await handler({ tabId, selector: ".x" });
      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ isError: true, code: "INTERNAL_ERROR", message: "extract failed" });
      expect(getTrackedTab(tabId).toolCalls).toBe(0);
    });
  });

  describe("batch_download", () => {
    it("calls client.batchDownload with tabId and params", async () => {
      const tabId = "tab-batch-download";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId, { userId: "user-1" }));
      const response = { downloads: [{ url: "http://x", success: true }], total: 1 };
      vi.mocked(deps.client.batchDownload).mockResolvedValueOnce(response as any);

      const { server, getHandler } = makeServerCapture();
      registerExtractionTools(server as unknown as Parameters<typeof registerExtractionTools>[0], deps);
      const handler = getHandler("batch_download");

      const result = await handler({
        tabId,
        selector: ".container",
        types: ["images"],
        extensions: ["jpg"],
        maxFiles: 7,
        resolveBlobs: false,
        concurrency: 2
      });

      expect(result.isError).toBeFalsy();
      expect(parseToolTextJson(result)).toEqual(response);
      expect(deps.client.batchDownload).toHaveBeenCalledWith(tabId, {
        userId: "user-1",
        selector: ".container",
        ref: undefined,
        types: ["images"],
        extensions: ["jpg"],
        resolveBlobs: false,
        concurrency: 2,
        maxFiles: 7
      });
      expect(getTrackedTab(tabId).toolCalls).toBe(1);
    });

    it("requires tabId", async () => {
      const { server, getHandler } = makeServerCapture();
      registerExtractionTools(server as unknown as Parameters<typeof registerExtractionTools>[0], deps);
      const handler = getHandler("batch_download");

      const result = await handler({ tabId: "missing", selector: ".x" });
      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ isError: true, code: "TAB_NOT_FOUND" });
      expect(deps.client.batchDownload).not.toHaveBeenCalled();
    });

    it("client error -> error result", async () => {
      const tabId = "tab-batch-error";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));
      vi.mocked(deps.client.batchDownload).mockRejectedValueOnce(new Error("batch failed"));

      const { server, getHandler } = makeServerCapture();
      registerExtractionTools(server as unknown as Parameters<typeof registerExtractionTools>[0], deps);
      const handler = getHandler("batch_download");

      const result = await handler({ tabId, selector: ".x" });
      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ isError: true, code: "INTERNAL_ERROR", message: "batch failed" });
      expect(getTrackedTab(tabId).toolCalls).toBe(0);
    });
  });

  describe("resolve_blobs", () => {
    it("calls client.resolveBlobs with tabId and urls", async () => {
      const tabId = "tab-resolve";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId, { userId: "user-1" }));

      const response = { resolved: [{ url: "blob:1", dataUri: "data:text/plain;base64,WA==" }] };
      vi.mocked(deps.client.resolveBlobs).mockResolvedValueOnce(response as any);

      const { server, getHandler } = makeServerCapture();
      registerExtractionTools(server as unknown as Parameters<typeof registerExtractionTools>[0], deps);
      const handler = getHandler("resolve_blobs");

      const result = await handler({ tabId, urls: ["blob:1"] });
      expect(result.isError).toBeFalsy();
      expect(parseToolTextJson(result)).toEqual(response);
      expect(deps.client.resolveBlobs).toHaveBeenCalledWith(tabId, "user-1", ["blob:1"]);
      expect(getTrackedTab(tabId).toolCalls).toBe(1);
    });

    it("requires tabId and at least one URL", async () => {
      const tabId = "tab-resolve-validate";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));

      const { server, getHandler } = makeServerCapture();
      registerExtractionTools(server as unknown as Parameters<typeof registerExtractionTools>[0], deps);
      const handler = getHandler("resolve_blobs");

      const result = await handler({ tabId, urls: [] });
      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ isError: true, code: "VALIDATION_ERROR" });
      expect(deps.client.resolveBlobs).not.toHaveBeenCalled();
      expect(getTrackedTab(tabId).toolCalls).toBe(0);
    });

    it("client error -> error result", async () => {
      const tabId = "tab-resolve-error";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId));
      vi.mocked(deps.client.resolveBlobs).mockRejectedValueOnce(new Error("resolve failed"));

      const { server, getHandler } = makeServerCapture();
      registerExtractionTools(server as unknown as Parameters<typeof registerExtractionTools>[0], deps);
      const handler = getHandler("resolve_blobs");

      const result = await handler({ tabId, urls: ["blob:1"] });
      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ isError: true, code: "INTERNAL_ERROR", message: "resolve failed" });
      expect(getTrackedTab(tabId).toolCalls).toBe(0);
    });
  });
});
