import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AppError, okResult, toErrorResult } from "../errors.js";
import { clearTrackedTabsByUserId, getAllTrackedTabs, getTrackedTab, incrementToolCall } from "../state.js";
import { saveProfile, withAutoTimeout } from "../profiles.js";
import type { ToolDeps } from "../server.js";

const AUTO_PROFILE_TIMEOUT_MS = 5_000;

export function registerSessionTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "import_cookies",
    "Import cookies for authenticated sessions. Provide cookies in a JSON string array. Restores login sessions without re-auth. Requires userId.",
    {
      userId: z.string().min(1).describe("User ID for session isolation"),
      cookies: z.string().min(1).describe("JSON string of cookie array to import"),
      tabId: z.string().optional().describe("Tab ID to target correct session (needed when using presets)")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            userId: z.string().min(1).describe("User ID for session isolation"),
            cookies: z.string().min(1).describe("JSON string of cookie array to import"),
            tabId: z.string().optional().describe("Tab ID to target correct session (needed when using presets)")
          })
          .parse(input);

        let cookies: unknown;
        try {
          cookies = JSON.parse(parsed.cookies);
        } catch {
          throw new AppError("VALIDATION_ERROR", "cookies must be a JSON array");
        }

        if (!Array.isArray(cookies)) {
          throw new AppError("VALIDATION_ERROR", "cookies must be a JSON array");
        }

        await deps.client.importCookies(parsed.userId, cookies, parsed.tabId);
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
      tabId: z.string().describe("Any tab ID from the session to identify the user")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().describe("Any tab ID from the session to identify the user")
          })
          .parse(input);
        const tracked = getTrackedTab(parsed.tabId);

        let autoSaved = false;
        // Auto-save before session close (best-effort; never blocks close)
        if (deps.config.autoSave) {
          const saved = await withAutoTimeout(
            (async () => {
              const allTabs = getAllTrackedTabs().filter((t) => t.userId === tracked.userId);
              const tabForExport = allTabs.find((t) => t.tabId === parsed.tabId) ?? allTabs[0];
              if (!tabForExport) {
                return false;
              }

              const cookies = await deps.client.exportCookies(tabForExport.tabId, tracked.userId);
              if (cookies.length <= 0) {
                return false;
              }

              const autoProfileId = `_auto_${tracked.userId}`;
              await saveProfile(deps.config.profilesDir, autoProfileId, tracked.userId, cookies, {
                description: "Auto-saved session",
                lastUrl: tabForExport.url
              });
              return true;
            })(),
            AUTO_PROFILE_TIMEOUT_MS
          );
          autoSaved = saved.ok ? saved.value : false;
        }

        try {
          await deps.client.closeSession(tracked.userId);
        } finally {
          clearTrackedTabsByUserId(tracked.userId);
        }
        return okResult({
          message: `Session closed. All tabs for user ${tracked.userId} have been released.`,
          autoSaved
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "toggle_display",
    "Toggle browser display mode between headless and headed. When encountering CAPTCHAs or issues requiring visual interaction, switch to headed mode (headless: false) to show the browser window. After resolving, switch back to headless mode (headless: true). Note: This restarts the browser context — all tabs are invalidated but cookies/auth persist.",
    {
      userId: z.string().min(1).describe("User/session identifier"),
      headless: z
        .union([z.boolean(), z.literal("virtual")])
        .describe("Display mode — false for headed, true for headless, \"virtual\" for virtual display")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            userId: z.string().min(1).describe("User/session identifier"),
            headless: z
              .union([z.boolean(), z.literal("virtual")])
              .describe("Display mode — false for headed, true for headless, \"virtual\" for virtual display")
          })
          .parse(input);

        const result = await deps.client.toggleDisplay(parsed.userId, parsed.headless);
        clearTrackedTabsByUserId(parsed.userId);

        return okResult(result);
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}
