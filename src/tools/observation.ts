import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { imageResult, okResult, toErrorResult } from "../errors.js";
import { getTrackedTab, incrementToolCall, updateRefsCount, updateTabUrl } from "../state.js";
import type { ToolDeps } from "../server.js";

export function registerObservationTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "snapshot",
    "Get accessibility tree snapshot — the PRIMARY way to read page content. Returns element refs, roles, names and values. Token-efficient. Always prefer over screenshot. Element refs are used with click and type_text.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab")
    },
    async (input: unknown) => {
      try {
        const parsed = z.object({ tabId: z.string().min(1).describe("Tab ID from create_tab") }).parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        const response = await deps.client.snapshot(parsed.tabId, tracked.userId);
        incrementToolCall(parsed.tabId);
        updateTabUrl(parsed.tabId, response.url);
        updateRefsCount(parsed.tabId, response.refsCount);

        return okResult({
          url: response.url,
          snapshot: response.snapshot,
          refsCount: response.refsCount
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "screenshot",
    "Take visual screenshot in base64 PNG. Use ONLY for visual verification (CSS, layout, proof). Prefer snapshot for most tasks — much more token-efficient.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab")
    },
    async (input: unknown) => {
      try {
        const parsed = z.object({ tabId: z.string().min(1).describe("Tab ID from create_tab") }).parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        const screenshotBuffer = await deps.client.screenshot(parsed.tabId, tracked.userId);
        incrementToolCall(parsed.tabId);
        return imageResult(screenshotBuffer.toString("base64"));
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "get_links",
    "Get all hyperlinks on page with URLs and text. Useful for navigation discovery and site mapping.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      scope: z.string().min(1).optional().describe("CSS selector to scope link extraction to a container"),
      extension: z.string().min(1).optional().describe("Filter by extension, comma-separated (e.g. 'pdf,zip')"),
      downloadOnly: z.boolean().optional().describe("Only include links with a download attribute")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            scope: z.string().min(1).optional().describe("CSS selector to scope link extraction to a container"),
            extension: z.string().min(1).optional().describe("Filter by extension, comma-separated (e.g. 'pdf,zip')"),
            downloadOnly: z.boolean().optional().describe("Only include links with a download attribute")
          })
          .parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        const response = await deps.client.getLinksWithOptions(parsed.tabId, tracked.userId, {
          scope: parsed.scope,
          extension: parsed.extension,
          downloadOnly: parsed.downloadOnly
        });
        incrementToolCall(parsed.tabId);
        return okResult(response.links);
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "camofox_wait_for_text",
    "Wait for specific text to appear on the page. Useful for waiting for search results, form submissions, or dynamic content loading.",
    {
      tabId: z.string().describe("Tab ID"),
      text: z.string().describe("Text to wait for"),
      timeout: z.number().optional().describe("Timeout in ms (default: 10000)")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().describe("Tab ID"),
            text: z.string().describe("Text to wait for"),
            timeout: z.number().optional().describe("Timeout in ms (default: 10000)")
          })
          .parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        await deps.client.waitForText(parsed.tabId, tracked.userId, parsed.text, parsed.timeout);
        incrementToolCall(parsed.tabId);
        return okResult({ message: `Text \"${parsed.text}\" found on page` });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}
