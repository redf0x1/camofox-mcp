import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { okResult, toErrorResult } from "../errors.js";
import { getTrackedTab, incrementToolCall, updateRefsCount, updateTabUrl } from "../state.js";
import type { ToolDeps } from "../server.js";
import type { SearchEngine } from "../types.js";

const searchEngines: SearchEngine[] = [
  "google",
  "youtube",
  "amazon",
  "bing",
  "duckduckgo",
  "reddit",
  "github",
  "stackoverflow",
  "wikipedia",
  "twitter",
  "linkedin",
  "facebook",
  "instagram",
  "tiktok"
];

export function registerSearchTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "web_search",
    "Search the web via 14 engines: google, youtube, amazon, bing, duckduckgo, reddit, github, stackoverflow, wikipedia, twitter, linkedin, facebook, instagram, tiktok. Call snapshot after to read results.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      query: z.string().min(1).describe("Search query text"),
      engine: z.enum(searchEngines).optional().describe("Search engine to use (default: google)")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            query: z.string().min(1).describe("Search query text"),
            engine: z.enum(searchEngines).optional().describe("Search engine to use (default: google)")
          })
          .parse(input);

        const engine = parsed.engine ?? "google";
        const macro = `@${engine}_search`;

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
