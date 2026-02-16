import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createRequire } from "node:module";

import { CamofoxClient } from "./client.js";
import type { Config } from "./types.js";
import { registerBatchTools } from "./tools/batch.js";
import { registerHealthTools } from "./tools/health.js";
import { registerInteractionTools, registerPressKeyTool } from "./tools/interaction.js";
import { registerNavigationTools } from "./tools/navigation.js";
import { registerObservationTools } from "./tools/observation.js";
import { registerPresetTools } from "./tools/presets.js";
import { registerProfileTools } from "./tools/profiles.js";
import { registerSearchTools } from "./tools/search.js";
import { registerSessionTools } from "./tools/session.js";
import { registerTabsTools } from "./tools/tabs.js";
import { registerPrompts } from "./prompts.js";

const require = createRequire(import.meta.url);
const pkg: { version: string } = require("../package.json");

export interface ToolDeps {
  client: CamofoxClient;
  config: Config;
}

export function createServer(config: Config): { server: McpServer; client: CamofoxClient } {
  const client = new CamofoxClient(config);

  const server = new McpServer({
    name: "camofox-mcp",
    version: pkg.version
  });

  const deps: ToolDeps = { client, config };

  registerHealthTools(server, deps);
  registerTabsTools(server, deps);
  registerNavigationTools(server, deps);
  registerInteractionTools(server, deps);
  registerPressKeyTool(server, deps);
  registerObservationTools(server, deps);
  registerSearchTools(server, deps);
  registerSessionTools(server, deps);
  registerBatchTools(server, deps);
  registerProfileTools(server, deps);
  registerPresetTools(server, deps);

  registerPrompts(server, deps);

  return { server, client };
}
