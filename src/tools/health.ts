import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { okResult, toErrorResult } from "../errors.js";
import { listTrackedTabs } from "../state.js";
import type { ToolDeps } from "../server.js";

export function registerHealthTools(server: McpServer, deps: ToolDeps): void {
  server.tool("server_status", "Check CamoFox server health and browser connection. Call first to verify server is running. Returns version, browser status, and active tab count.", {}, async () => {
    try {
      const health = await deps.client.healthCheck();
      const activeTabCount = listTrackedTabs().length;
      const running = health.running ?? health.browserConnected ?? false;
      const reachable = health.ok === true;
      const browserSessionActive = health.browserConnected;
      const guidance =
        reachable && !browserSessionActive
          ? "CamoFox Browser is reachable, but no browser session is active yet. Continue with create_tab to start a session."
          : undefined;

      return okResult({
        ok: health.ok,
        running,
        reachable,
        browserConnected: health.browserConnected,
        browserSessionActive,
        version: health.version ?? "unknown",
        consecutiveFailures: health.consecutiveFailures,
        activeOps: health.activeOps,
        activeTabCount,
        guidance
      });
    } catch (error) {
      return toErrorResult(error);
    }
  });
}
