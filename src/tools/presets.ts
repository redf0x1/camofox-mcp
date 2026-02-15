import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { okResult, toErrorResult } from "../errors.js";
import type { ToolDeps } from "../server.js";

// Tool: list_presets - Lists all available geo presets from the camofox-browser server
export function registerPresetTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "list_presets",
    "List all available geo presets supported by the CamoFox server. Presets include locale, timezone, and optional geolocation.",
    {},
    async () => {
      try {
        const response = await deps.client.listPresets();

        const presets = Object.entries(response.presets ?? {})
          .map(([name, info]) => ({ name, ...info }))
          .sort((a, b) => a.name.localeCompare(b.name));

        return okResult({
          count: presets.length,
          presets
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}
