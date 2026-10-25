import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../config.js";
import type { ToolResult } from "../errors.js";
import { getTrackedTab, removeTrackedTab, trackTab } from "../state.js";
import type { ToolDeps } from "../server.js";
import { registerSearchTools } from "../tools/search.js";
import type { TabInfo } from "../types.js";

function makeTab(tabId: string): TabInfo {
  return {
    tabId,
    url: "about:blank",
    createdAt: "2026-08-13T00:00:00.000Z",
    lastActivity: 0,
    userId: "user-1",
    sessionKey: "session-1",
    visitedUrls: [],
    toolCalls: 0,
    refsCount: 0
  };
}

function makeServerCapture(): {
  server: { tool: ReturnType<typeof vi.fn> };
  getHandler: (name: string) => (input: unknown) => Promise<ToolResult>;
} {
  const server = { tool: vi.fn() };

  const getHandler = (name: string) => {
    const call = server.tool.mock.calls.find((entry) => entry[0] === name);
    if (!call) {
      throw new Error(`Expected tool '${name}' to be registered`);
    }
    return call[3] as (input: unknown) => Promise<ToolResult>;
  };

  return { server, getHandler };
}

describe("tools/search", () => {
  let deps: ToolDeps;
  const tabId = "tab-search";

  beforeEach(() => {
    deps = {
      client: {
        navigateMacro: vi.fn().mockResolvedValue({ url: "https://example.test/results" }),
        snapshot: vi.fn().mockResolvedValue({
          url: "https://example.test/results",
          snapshot: "results",
          refsCount: 2
        })
      } as unknown as ToolDeps["client"],
      config: loadConfig([], { CAMOFOX_URL: "http://test:9377" } as NodeJS.ProcessEnv)
    };
    trackTab(makeTab(tabId));
  });

  afterEach(() => {
    removeTrackedTab(tabId);
    vi.restoreAllMocks();
  });

  it.each([
    ["google", "@google_search"],
    ["youtube", "@youtube_search"],
    ["amazon", "@amazon_search"],
    ["reddit", "@reddit_search"],
    ["reddit_subreddit", "@reddit_subreddit"],
    ["wikipedia", "@wikipedia_search"],
    ["twitter", "@twitter_search"],
    ["yelp", "@yelp_search"],
    ["spotify", "@spotify_search"],
    ["netflix", "@netflix_search"],
    ["linkedin", "@linkedin_search"],
    ["instagram", "@instagram_search"],
    ["tiktok", "@tiktok_search"],
    ["twitch", "@twitch_search"]
  ] as const)("maps %s to the browser-supported %s macro", async (engine, macro) => {
    const { server, getHandler } = makeServerCapture();
    registerSearchTools(server as unknown as Parameters<typeof registerSearchTools>[0], deps);

    const result = await getHandler("web_search")({ tabId, query: "camofox", engine });

    expect(result.isError).toBeFalsy();
    expect(deps.client.navigateMacro).toHaveBeenCalledWith(tabId, macro, "camofox", "user-1");
    expect(getTrackedTab(tabId)).toMatchObject({
      url: "https://example.test/results",
      refsCount: 2,
      toolCalls: 1
    });
  });

  it.each(["bing", "duckduckgo", "github", "stackoverflow", "facebook"])(
    "rejects legacy %s because camofox-browser has no matching macro",
    async (engine) => {
      const { server, getHandler } = makeServerCapture();
      registerSearchTools(server as unknown as Parameters<typeof registerSearchTools>[0], deps);

      const result = await getHandler("web_search")({ tabId, query: "camofox", engine });

      expect(result.isError).toBe(true);
      expect(deps.client.navigateMacro).not.toHaveBeenCalled();
      expect(getTrackedTab(tabId).toolCalls).toBe(0);
    }
  );
});
