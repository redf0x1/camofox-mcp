import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../config.js";
import type { ToolResult } from "../errors.js";
import { getTrackedTab, removeTrackedTab, trackTab } from "../state.js";
import type { ToolDeps } from "../server.js";
import { registerDownloadTools } from "../tools/downloads.js";
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

describe("tools/downloads", () => {
  let deps: ToolDeps;
  const createdTabIds: string[] = [];

  beforeEach(() => {
    deps = {
      client: {
        listTabDownloads: vi.fn(),
        listUserDownloads: vi.fn(),
        getDownload: vi.fn(),
        getDownloadContent: vi.fn(),
        deleteDownload: vi.fn()
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

  describe("list_downloads", () => {
    it("lists by tabId -> calls listTabDownloads with correct params", async () => {
      const tabId = "tab-list-downloads";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId, { userId: "user-1" }));

      const response = { downloads: [{ downloadId: "d1" }], total: 1 };
      vi.mocked(deps.client.listTabDownloads).mockResolvedValueOnce(response as any);

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("list_downloads");

      const result = await handler({ tabId });

      expect(result.isError).toBeFalsy();
      expect(parseToolTextJson(result)).toEqual(response);

      expect(deps.client.listTabDownloads).toHaveBeenCalledTimes(1);
      expect(deps.client.listTabDownloads).toHaveBeenCalledWith(
        tabId,
        "user-1",
        expect.objectContaining({ limit: 50, offset: 0 })
      );
      expect(deps.client.listUserDownloads).not.toHaveBeenCalled();
      expect(getTrackedTab(tabId).toolCalls).toBe(1);
    });

    it("lists without tabId -> calls listUserDownloads with default userId from config", async () => {
      const response = { downloads: [{ downloadId: "u1" }], total: 1 };
      vi.mocked(deps.client.listUserDownloads).mockResolvedValueOnce(response as any);

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("list_downloads");

      const result = await handler({});

      expect(result.isError).toBeFalsy();
      expect(parseToolTextJson(result)).toEqual(response);
      expect(deps.client.listUserDownloads).toHaveBeenCalledTimes(1);
      expect(deps.client.listUserDownloads).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({ limit: 50, offset: 0 })
      );
      expect(deps.client.listTabDownloads).not.toHaveBeenCalled();
    });

    it("passes all filter params", async () => {
      const tabId = "tab-list-downloads-filters";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId, { userId: "tracked-user" }));

      vi.mocked(deps.client.listTabDownloads).mockResolvedValueOnce({ ok: true } as any);

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("list_downloads");

      await handler({
        tabId,
        userId: "override-user",
        status: "completed",
        extension: "pdf,jpg",
        mimeType: "image/",
        minSize: 10,
        maxSize: 20,
        sort: "createdAt:asc",
        limit: 10,
        offset: 5
      });

      expect(deps.client.listTabDownloads).toHaveBeenCalledTimes(1);
      expect(deps.client.listTabDownloads).toHaveBeenCalledWith(tabId, "override-user", {
        status: "completed",
        extension: "pdf,jpg",
        mimeType: "image/",
        minSize: 10,
        maxSize: 20,
        sort: "createdAt:asc",
        limit: 10,
        offset: 5
      });
    });

    it("validates minSize <= maxSize (should return error)", async () => {
      vi.mocked(deps.client.listUserDownloads).mockResolvedValueOnce({ ok: true } as any);

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("list_downloads");

      const result = await handler({ minSize: 50, maxSize: 10 });

      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ isError: true, code: "VALIDATION_ERROR" });
      expect(String(payload.message)).toContain("minSize must be <= maxSize");
      expect(deps.client.listUserDownloads).not.toHaveBeenCalled();
      expect(deps.client.listTabDownloads).not.toHaveBeenCalled();
    });

    it("handles empty list", async () => {
      const response = { downloads: [], total: 0 };
      vi.mocked(deps.client.listUserDownloads).mockResolvedValueOnce(response as any);

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("list_downloads");

      const result = await handler({});
      expect(result.isError).toBeFalsy();
      expect(parseToolTextJson(result)).toEqual(response);
    });

    it("returns error on client failure", async () => {
      const tabId = "tab-list-downloads-error";
      createdTabIds.push(tabId);
      trackTab(makeTab(tabId, { userId: "user-1" }));

      vi.mocked(deps.client.listTabDownloads).mockRejectedValueOnce(new Error("boom"));

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("list_downloads");

      const result = await handler({ tabId });
      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ isError: true, code: "INTERNAL_ERROR", message: "boom" });
      expect(getTrackedTab(tabId).toolCalls).toBe(0);
    });
  });

  describe("get_download", () => {
    it("image (completed, size within limit) -> returns text metadata + image block", async () => {
      vi.mocked(deps.client.getDownload).mockResolvedValueOnce({
        download: {
          downloadId: "d-img",
          mimeType: "image/png",
          status: "completed",
          size: 1024,
          filename: "img.png"
        }
      } as any);

      vi.mocked(deps.client.getDownloadContent).mockResolvedValueOnce(Buffer.from("hello"));

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("get_download");

      const result = await handler({ downloadId: "d-img" });

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(2);
      expect(result.content[1]).toEqual({
        type: "image",
        data: Buffer.from("hello").toString("base64"),
        mimeType: "image/png"
      });

      const meta = parseToolTextJson(result);
      expect(meta).toMatchObject({ downloadId: "d-img", note: "Image rendered below" });

      expect(deps.client.getDownload).toHaveBeenCalledWith("d-img", "default");
      expect(deps.client.getDownloadContent).toHaveBeenCalledWith("d-img", "default");
    });

    it("image (completed, size exceeds 10MB) -> returns metadata-only with note", async () => {
      const tooBig = 10 * 1024 * 1024 + 1;
      vi.mocked(deps.client.getDownload).mockResolvedValueOnce({
        download: { mimeType: "image/jpeg", status: "completed", size: tooBig }
      } as any);

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("get_download");

      const result = await handler({ downloadId: "d-too-big" });
      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(String(payload.note)).toContain("exceeds 10MB");
      expect(deps.client.getDownloadContent).not.toHaveBeenCalled();
    });

    it("image (pending status) -> returns metadata-only with status note", async () => {
      vi.mocked(deps.client.getDownload).mockResolvedValueOnce({
        download: { mimeType: "image/png", status: "pending", size: 100 }
      } as any);

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("get_download");

      const result = await handler({ downloadId: "d-pending" });
      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(payload.note).toBe("Cannot render image: download status is 'pending'");
      expect(deps.client.getDownloadContent).not.toHaveBeenCalled();
    });

    it("image (unknown/0 size) -> returns metadata-only with size-unknown note", async () => {
      vi.mocked(deps.client.getDownload).mockResolvedValueOnce({
        download: { mimeType: "image/png", status: "completed", size: 0 }
      } as any);

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("get_download");

      const result = await handler({ downloadId: "d-unknown" });
      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(String(payload.note)).toMatch(/file size unknown/i);
      expect(deps.client.getDownloadContent).not.toHaveBeenCalled();
    });

    it("non-image without includeContent -> metadata only", async () => {
      const download = { mimeType: "application/pdf", status: "completed", size: 1000, filename: "a.pdf" };
      vi.mocked(deps.client.getDownload).mockResolvedValueOnce({ download } as any);

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("get_download");

      const result = await handler({ downloadId: "d-pdf" });
      expect(result.isError).toBeFalsy();
      expect(parseToolTextJson(result)).toEqual(download);
      expect(deps.client.getDownloadContent).not.toHaveBeenCalled();
    });

    it("non-image with includeContent + small size -> metadata + base64 content", async () => {
      vi.mocked(deps.client.getDownload).mockResolvedValueOnce({
        download: { mimeType: "text/plain", status: "completed", size: 12 }
      } as any);
      vi.mocked(deps.client.getDownloadContent).mockResolvedValueOnce(Buffer.from("hello world"));

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("get_download");

      const result = await handler({ downloadId: "d-txt", includeContent: true });
      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(payload.content).toBe(Buffer.from("hello world").toString("base64"));
      expect(deps.client.getDownloadContent).toHaveBeenCalledTimes(1);
    });

    it("non-image with includeContent + large size -> metadata only with note", async () => {
      vi.mocked(deps.client.getDownload).mockResolvedValueOnce({
        download: { mimeType: "application/octet-stream", status: "completed", size: 256 * 1024 + 1 }
      } as any);

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("get_download");

      const result = await handler({ downloadId: "d-big", includeContent: true });
      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(String(payload.note)).toContain("exceeds 256KB");
      expect(deps.client.getDownloadContent).not.toHaveBeenCalled();
    });

    it("client error -> returns error result", async () => {
      vi.mocked(deps.client.getDownload).mockRejectedValueOnce(new Error("nope"));

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("get_download");

      const result = await handler({ downloadId: "d-error" });
      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ isError: true, code: "INTERNAL_ERROR", message: "nope" });
    });
  });

  describe("delete_download", () => {
    it("success -> returns ok result", async () => {
      vi.mocked(deps.client.deleteDownload).mockResolvedValueOnce({ success: true } as any);

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("delete_download");

      const result = await handler({ downloadId: "d-del" });
      expect(result.isError).toBeFalsy();
      expect(parseToolTextJson(result)).toEqual({ success: true });
      expect(deps.client.deleteDownload).toHaveBeenCalledWith("d-del", "default");
    });

    it("client error -> returns error result", async () => {
      vi.mocked(deps.client.deleteDownload).mockRejectedValueOnce(new Error("delete failed"));

      const { server, getHandler } = makeServerCapture();
      registerDownloadTools(server as unknown as Parameters<typeof registerDownloadTools>[0], deps);
      const handler = getHandler("delete_download");

      const result = await handler({ downloadId: "d-del" });
      expect(result.isError).toBe(true);
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ isError: true, code: "INTERNAL_ERROR", message: "delete failed" });
    });
  });
});
