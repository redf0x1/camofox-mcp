import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { okResult, toErrorResult } from "../errors.js";
import { getTrackedTab, incrementToolCall, updateRefsCount, updateTabUrl } from "../state.js";
import type { ToolDeps } from "../server.js";
import { SEARCH_ENGINES, type SearchEngine } from "../types.js";

const searchMacros: Record<SearchEngine, string> = {
  google: "@google_search",
  youtube: "@youtube_search",
  amazon: "@amazon_search",
  reddit: "@reddit_search",
  reddit_subreddit: "@reddit_subreddit",
  wikipedia: "@wikipedia_search",
  twitter: "@twitter_search",
  yelp: "@yelp_search",
  spotify: "@spotify_search",
  netflix: "@netflix_search",
  linkedin: "@linkedin_search",
  instagram: "@instagram_search",
  tiktok: "@tiktok_search",
  twitch: "@twitch_search"
};

export function registerSearchTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "web_search",
    "Search via the 14 macros supported by camofox-browser 2.4.7: google, youtube, amazon, reddit, reddit_subreddit, wikipedia, twitter, yelp, spotify, netflix, linkedin, instagram, tiktok, twitch. Call snapshot after to read results.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      query: z.string().min(1).describe("Search query text; for reddit_subreddit, pass the subreddit name"),
      engine: z.enum(SEARCH_ENGINES).optional().describe("Browser search macro to use (default: google)")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            query: z.string().min(1).describe("Search query text; for reddit_subreddit, pass the subreddit name"),
            engine: z.enum(SEARCH_ENGINES).optional().describe("Browser search macro to use (default: google)")
          })
          .parse(input);

        const engine = parsed.engine ?? "google";
        const macro = searchMacros[engine];

        const tracked = getTrackedTab(parsed.tabId);
        const navigation = await deps.client.navigateMacro(parsed.tabId, macro, parsed.query, tracked.userId);
        const snap = await deps.client.snapshot(parsed.tabId, tracked.userId);
        incrementToolCall(parsed.tabId);
        updateTabUrl(parsed.tabId, navigation.url || snap.url);
        updateRefsCount(parsed.tabId, snap.refsCount);

        return okResult({
          url: navigation.url || snap.url,
          snapshot: snap.snapshot
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}
