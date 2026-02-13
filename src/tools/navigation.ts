import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { okResult, toErrorResult } from "../errors.js";
import { getTrackedTab, incrementToolCall, updateRefsCount, updateTabUrl } from "../state.js";
import type { ToolDeps } from "../server.js";

export function registerNavigationTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "navigate",
    "Navigate a tab to a URL. Waits for page load. Use create_tab first, then navigate. Returns final URL (may differ due to redirects).",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      url: z.string().url().describe("Full URL including protocol (e.g. 'https://example.com')")
    },
    async (input: unknown) => {
      try {
        const parsed = z.object({ tabId: z.string().min(1).describe("Tab ID from create_tab"), url: z.string().url().describe("Full URL including protocol (e.g. 'https://example.com')") }).parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        const result = await deps.client.navigate(parsed.tabId, parsed.url, tracked.userId);
        incrementToolCall(parsed.tabId);
        updateTabUrl(parsed.tabId, result.url);
        return okResult({ url: result.url, title: result.title ?? "" });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "go_back",
    "Navigate backward in browser history (Back button). Returns new page URL.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab")
    },
    async (input: unknown) => {
      try {
        const parsed = z.object({ tabId: z.string().min(1).describe("Tab ID from create_tab") }).parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        await deps.client.goBack(parsed.tabId, tracked.userId);
        const snap = await deps.client.snapshot(parsed.tabId, tracked.userId);
        incrementToolCall(parsed.tabId);
        updateTabUrl(parsed.tabId, snap.url);
        updateRefsCount(parsed.tabId, snap.refsCount);
        return okResult({ url: snap.url });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "go_forward",
    "Navigate forward in browser history (Forward button). Returns new page URL.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab")
    },
    async (input: unknown) => {
      try {
        const parsed = z.object({ tabId: z.string().min(1).describe("Tab ID from create_tab") }).parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        await deps.client.goForward(parsed.tabId, tracked.userId);
        const snap = await deps.client.snapshot(parsed.tabId, tracked.userId);
        incrementToolCall(parsed.tabId);
        updateTabUrl(parsed.tabId, snap.url);
        updateRefsCount(parsed.tabId, snap.refsCount);
        return okResult({ url: snap.url });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "refresh",
    "Reload the current page. Useful when page state is stale or after changes.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab")
    },
    async (input: unknown) => {
      try {
        const parsed = z.object({ tabId: z.string().min(1).describe("Tab ID from create_tab") }).parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        await deps.client.refresh(parsed.tabId, tracked.userId);
        incrementToolCall(parsed.tabId);
        return okResult({ success: true });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}
