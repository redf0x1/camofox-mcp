import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../config.js";
import type { ToolResult } from "../errors.js";
import { getAllTrackedTabs, getTrackedTab, removeTrackedTab, trackTab } from "../state.js";
import { registerTabsTools } from "../tools/tabs.js";
import type { ToolDeps } from "../server.js";
import type { TabInfo } from "../types.js";

vi.mock("../profiles.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../profiles.js")>();
  return {
    ...actual,
    loadProfile: vi.fn(),
    saveProfile: vi.fn(),
    withAutoTimeout: vi.fn()
  };
});

import { loadProfile, saveProfile, withAutoTimeout } from "../profiles.js";

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

describe("tools/tabs", () => {
  let deps: ToolDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = {
      client: {
        createTab: vi.fn(),
        closeTab: vi.fn(),
        exportCookies: vi.fn(),
        importCookies: vi.fn()
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

  describe("create_tab", () => {
    it("basic create without auto-load (no apiKey)", async () => {
      vi.mocked(deps.client.createTab).mockResolvedValue({ tabId: "tab-basic", url: "http://example.com" });

      const { server, getHandler } = makeServerCapture();
      registerTabsTools(server as unknown as Parameters<typeof registerTabsTools>[0], deps);
      const handler = getHandler("create_tab");

      const result = await handler({ url: "http://example.com" });

      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ tabId: "tab-basic", url: "http://example.com" });

      expect(loadProfile).not.toHaveBeenCalled();
      expect(withAutoTimeout).not.toHaveBeenCalled();
      expect(deps.client.importCookies).not.toHaveBeenCalled();

      const tracked = getTrackedTab("tab-basic");
      expect(tracked.userId).toBe("default");
    });

    it("create with auto-load succeeds (apiKey + autoSave)", async () => {
      deps.config.apiKey = "test-key";
      deps.config.autoSave = true;

      vi.mocked(deps.client.createTab).mockResolvedValue({ tabId: "tab-auto", url: "http://example.com" });

      vi.mocked(loadProfile).mockResolvedValue({
        version: 1,
        profileId: "_auto_default",
        userId: "default",
        cookies: [{ name: "sid", value: "1", domain: "example.com", path: "/" }],
        metadata: { createdAt: "", updatedAt: "", cookieCount: 1, description: null, lastUrl: null }
      } as any);

      const { server, getHandler } = makeServerCapture();
      registerTabsTools(server as unknown as Parameters<typeof registerTabsTools>[0], deps);
      const handler = getHandler("create_tab");

      const result = await handler({ url: "http://example.com" });

      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ tabId: "tab-auto" });

      expect(loadProfile).toHaveBeenCalledTimes(1);
      expect(loadProfile).toHaveBeenCalledWith(deps.config.profilesDir, "_auto_default");
      expect(withAutoTimeout).toHaveBeenCalledTimes(1);

      expect(deps.client.importCookies).toHaveBeenCalledTimes(1);
      expect(deps.client.importCookies).toHaveBeenCalledWith(
        "default",
        [{ name: "sid", value: "1", domain: "example.com", path: "/" }],
        "tab-auto"
      );

      expect(getTrackedTab("tab-auto").userId).toBe("default");
    });

    it("create with auto-load fails gracefully (profile load throws)", async () => {
      deps.config.apiKey = "test-key";
      deps.config.autoSave = true;

      vi.mocked(deps.client.createTab).mockResolvedValue({ tabId: "tab-load-fails", url: "http://example.com" });
      vi.mocked(loadProfile).mockRejectedValueOnce(new Error("load failed"));

      const { server, getHandler } = makeServerCapture();
      registerTabsTools(server as unknown as Parameters<typeof registerTabsTools>[0], deps);
      const handler = getHandler("create_tab");

      const result = await handler({ url: "http://example.com" });

      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ tabId: "tab-load-fails" });

      expect(loadProfile).toHaveBeenCalledTimes(1);
      expect(deps.client.importCookies).not.toHaveBeenCalled();
      expect(getTrackedTab("tab-load-fails").userId).toBe("default");
    });

    it("create with auto-load timeout (withAutoTimeout returns timeout)", async () => {
      deps.config.apiKey = "test-key";
      deps.config.autoSave = true;

      vi.mocked(deps.client.createTab).mockResolvedValue({ tabId: "tab-timeout", url: "http://example.com" });
      vi.mocked(loadProfile).mockImplementation(() => new Promise(() => undefined) as any);
      vi.mocked(withAutoTimeout).mockResolvedValueOnce({ ok: false, reason: "timeout" } as any);

      const { server, getHandler } = makeServerCapture();
      registerTabsTools(server as unknown as Parameters<typeof registerTabsTools>[0], deps);
      const handler = getHandler("create_tab");

      const result = await handler({ url: "http://example.com" });

      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ tabId: "tab-timeout" });

      expect(loadProfile).toHaveBeenCalledTimes(1);
      expect(withAutoTimeout).toHaveBeenCalledTimes(1);
      expect(deps.client.importCookies).not.toHaveBeenCalled();
    });
  });

  describe("close_tab", () => {
    it("basic close without auto-save (no apiKey)", async () => {
      trackTab(makeTab("tab-close-basic", { userId: "user-1" }));

      vi.mocked(deps.client.closeTab).mockResolvedValue(undefined);

      const { server, getHandler } = makeServerCapture();
      registerTabsTools(server as unknown as Parameters<typeof registerTabsTools>[0], deps);
      const handler = getHandler("close_tab");

      const result = await handler({ tabId: "tab-close-basic" });

      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(payload).toEqual({ success: true, tabId: "tab-close-basic", autoSaved: false });

      expect(deps.client.exportCookies).not.toHaveBeenCalled();
      expect(saveProfile).not.toHaveBeenCalled();
      expect(withAutoTimeout).not.toHaveBeenCalled();

      expect(deps.client.closeTab).toHaveBeenCalledWith("tab-close-basic", "user-1");
      expect(() => getTrackedTab("tab-close-basic")).toThrow();
    });

    it("close_tab when closeTab throws -> still removes tracked tab", async () => {
      trackTab(makeTab("tab-close-throws", { userId: "user-1" }));

      vi.mocked(deps.client.closeTab).mockRejectedValueOnce(new Error("close failed"));

      const { server, getHandler } = makeServerCapture();
      registerTabsTools(server as unknown as Parameters<typeof registerTabsTools>[0], deps);
      const handler = getHandler("close_tab");

      const result = await handler({ tabId: "tab-close-throws" });

      expect(result.isError).toBe(true);
      expect(deps.client.closeTab).toHaveBeenCalledWith("tab-close-throws", "user-1");
      expect(() => getTrackedTab("tab-close-throws")).toThrow();
    });

    it("close with auto-save succeeds", async () => {
      deps.config.apiKey = "test-key";
      deps.config.autoSave = true;

      trackTab(makeTab("tab-close-auto", { userId: "user-1", url: "http://example.com" }));

      vi.mocked(deps.client.exportCookies).mockResolvedValueOnce([
        { name: "sid", value: "1", domain: "example.com", path: "/" }
      ]);
      vi.mocked(saveProfile).mockResolvedValueOnce({} as any);
      vi.mocked(deps.client.closeTab).mockResolvedValue(undefined);

      const { server, getHandler } = makeServerCapture();
      registerTabsTools(server as unknown as Parameters<typeof registerTabsTools>[0], deps);
      const handler = getHandler("close_tab");

      const result = await handler({ tabId: "tab-close-auto" });

      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ success: true, tabId: "tab-close-auto", autoSaved: true });

      expect(deps.client.exportCookies).toHaveBeenCalledWith("tab-close-auto", "user-1");
      expect(saveProfile).toHaveBeenCalledTimes(1);
      expect(saveProfile).toHaveBeenCalledWith(
        deps.config.profilesDir,
        "_auto_user-1",
        "user-1",
        [{ name: "sid", value: "1", domain: "example.com", path: "/" }],
        { description: "Auto-saved session", lastUrl: "http://example.com" }
      );

      expect(deps.client.closeTab).toHaveBeenCalledWith("tab-close-auto", "user-1");
      expect(() => getTrackedTab("tab-close-auto")).toThrow();
    });

    it("close with auto-save fails -> returns autoSaveFailure message", async () => {
      deps.config.apiKey = "test-key";
      deps.config.autoSave = true;

      trackTab(makeTab("tab-close-fails", { userId: "user-1" }));

      vi.mocked(deps.client.exportCookies).mockRejectedValueOnce(new Error("export failed"));
      vi.mocked(deps.client.closeTab).mockResolvedValue(undefined);

      const { server, getHandler } = makeServerCapture();
      registerTabsTools(server as unknown as Parameters<typeof registerTabsTools>[0], deps);
      const handler = getHandler("close_tab");

      const result = await handler({ tabId: "tab-close-fails" });

      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({ success: true, tabId: "tab-close-fails", autoSaved: false, autoSaveFailure: "export failed" });

      expect(saveProfile).not.toHaveBeenCalled();
      expect(deps.client.closeTab).toHaveBeenCalledWith("tab-close-fails", "user-1");
      expect(() => getTrackedTab("tab-close-fails")).toThrow();
    });

    it("close with auto-save timeout -> returns autoSaveFailure='timeout'", async () => {
      deps.config.apiKey = "test-key";
      deps.config.autoSave = true;

      trackTab(makeTab("tab-close-timeout", { userId: "user-1" }));

      vi.mocked(deps.client.exportCookies).mockImplementation(() => new Promise(() => undefined) as any);
      vi.mocked(withAutoTimeout).mockResolvedValueOnce({ ok: false, reason: "timeout" } as any);
      vi.mocked(deps.client.closeTab).mockResolvedValue(undefined);

      const { server, getHandler } = makeServerCapture();
      registerTabsTools(server as unknown as Parameters<typeof registerTabsTools>[0], deps);
      const handler = getHandler("close_tab");

      const result = await handler({ tabId: "tab-close-timeout" });

      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(payload).toMatchObject({
        success: true,
        tabId: "tab-close-timeout",
        autoSaved: false,
        autoSaveFailure: "timeout"
      });

      expect(deps.client.closeTab).toHaveBeenCalledWith("tab-close-timeout", "user-1");
      expect(() => getTrackedTab("tab-close-timeout")).toThrow();
    });

    it("close with empty cookies -> no save attempted", async () => {
      deps.config.apiKey = "test-key";
      deps.config.autoSave = true;

      trackTab(makeTab("tab-close-empty", { userId: "user-1" }));

      vi.mocked(deps.client.exportCookies).mockResolvedValueOnce([]);
      vi.mocked(deps.client.closeTab).mockResolvedValue(undefined);

      const { server, getHandler } = makeServerCapture();
      registerTabsTools(server as unknown as Parameters<typeof registerTabsTools>[0], deps);
      const handler = getHandler("close_tab");

      const result = await handler({ tabId: "tab-close-empty" });

      expect(result.isError).toBeFalsy();
      const payload = parseToolTextJson(result);
      expect(payload).toEqual({ success: true, tabId: "tab-close-empty", autoSaved: false });

      expect(saveProfile).not.toHaveBeenCalled();
      expect(deps.client.closeTab).toHaveBeenCalledWith("tab-close-empty", "user-1");
      expect(() => getTrackedTab("tab-close-empty")).toThrow();
    });
  });
});
