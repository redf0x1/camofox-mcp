import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AppError, okResult, toErrorResult } from "../errors.js";
import { clearTrackedTabsByUserId, getTrackedTab, incrementToolCall } from "../state.js";
import type { ToolDeps } from "../server.js";

export function registerSessionTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "import_cookies",
    "Import cookies for authenticated sessions. Provide cookies in a JSON string array. Restores login sessions without re-auth. Requires userId.",
    {
      userId: z.string().min(1).describe("User ID for session isolation"),
      cookies: z.string().min(1).describe("JSON string of cookie array to import")
    },
    async (input: unknown) => {
      try {
        const parsed = z.object({ userId: z.string().min(1).describe("User ID for session isolation"), cookies: z.string().min(1).describe("JSON string of cookie array to import") }).parse(input);

        if (!deps.config.apiKey) {
          throw new AppError("API_KEY_REQUIRED", "CAMOFOX_API_KEY is required to import cookies");
        }

        await deps.client.importCookies(parsed.userId, parsed.cookies);
        return okResult({ success: true });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "get_stats",
    "Get session statistics: request counts, active tabs, uptime, performance metrics.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab")
    },
    async (input: unknown) => {
      try {
        const parsed = z.object({ tabId: z.string().min(1).describe("Tab ID from create_tab") }).parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        const remoteStats = await deps.client.getStats(parsed.tabId, tracked.userId);
        incrementToolCall(parsed.tabId);

        return okResult({
          visitedUrls: tracked.visitedUrls,
          toolCalls: tracked.toolCalls,
          refsCount: tracked.refsCount,
          sessionKey: tracked.sessionKey,
          remote: remoteStats
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "camofox_close_session",
    "Close all browser tabs for a user session. Use for complete cleanup when done with a browsing session.",
    {
      tab_id: z.string().describe("Any tab ID from the session to identify the user")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tab_id: z.string().describe("Any tab ID from the session to identify the user")
          })
          .parse(input);
        const tracked = getTrackedTab(parsed.tab_id);
        try {
          await deps.client.closeSession(tracked.userId);
        } finally {
          clearTrackedTabsByUserId(tracked.userId);
        }
        return okResult({
          message: `Session closed. All tabs for user ${tracked.userId} have been released.`
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}
