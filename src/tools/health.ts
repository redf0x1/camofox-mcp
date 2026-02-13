import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { okResult, toErrorResult } from "../errors.js";
import { listTrackedTabs } from "../state.js";
import type { ToolDeps } from "../server.js";

export function registerHealthTools(server: McpServer, deps: ToolDeps): void {
  server.tool("server_status", "Check CamoFox server health and browser connection. Call first to verify server is running. Returns version, browser status, and active tab count.", {}, async () => {
    try {
      const health = await deps.client.healthCheck();
      const activeTabCount = listTrackedTabs().length;
      return okResult({
        ok: health.ok,
        running: health.running,
        browserConnected: health.browserConnected,
        version: health.version ?? "unknown",
        activeTabCount
      });
    } catch (error) {
      return toErrorResult(error);
    }
  });
}
