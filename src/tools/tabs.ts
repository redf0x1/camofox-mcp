import { randomUUID } from "node:crypto";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { okResult, toErrorResult } from "../errors.js";
import { getTrackedTab, listTrackedTabs, removeTrackedTab, trackTab } from "../state.js";
import type { ToolDeps } from "../server.js";
import type { TabInfo } from "../types.js";

export function registerTabsTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "create_tab",
    "Create a new browser tab with anti-detection fingerprinting. Each tab gets a unique fingerprint. Optionally provide a URL and userId for session isolation. Returns the tab ID for subsequent operations.",
    {
      url: z.string().url().optional().describe("Full URL including protocol (e.g. 'https://example.com')"),
      userId: z.string().min(1).optional().describe("User ID for session isolation")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            url: z.string().url().optional().describe("Full URL including protocol (e.g. 'https://example.com')"),
            userId: z.string().min(1).optional().describe("User ID for session isolation")
          })
          .parse(input);

        const userId = parsed.userId ?? deps.config.defaultUserId;
        const sessionKey = randomUUID();
        const tab = await deps.client.createTab({
          userId,
          sessionKey,
          url: parsed.url
        });

        const tracked: TabInfo = {
          tabId: tab.tabId,
          url: tab.url,
          createdAt: new Date().toISOString(),
          userId,
          sessionKey,
          visitedUrls: [tab.url],
          toolCalls: 1,
          refsCount: 0
        };

        trackTab(tracked);

        return okResult({ tabId: tab.tabId, url: tab.url });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "close_tab",
    "Close a browser tab and release resources. Always close tabs when done to free memory.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab")
    },
    async (input: unknown) => {
      try {
        const parsed = z.object({ tabId: z.string().min(1).describe("Tab ID from create_tab") }).parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        await deps.client.closeTab(parsed.tabId, tracked.userId);
        removeTrackedTab(parsed.tabId);
        return okResult({ success: true, tabId: parsed.tabId });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool("list_tabs", "List all open browser tabs with URLs and titles. Use to discover available tabs or verify tab state.", {}, async () => {
    try {
      const tabs = listTrackedTabs();
      return okResult(tabs);
    } catch (error) {
      return toErrorResult(error);
    }
  });
}
