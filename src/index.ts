#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { getAllTrackedTabs, removeTrackedTab, setupCleanup } from "./state.js";

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.apiKey) {
    console.error(
      "[camofox-mcp] ℹ️  CAMOFOX_API_KEY not set — running without authentication. " +
        "If CamoFox server requires an API key, set CAMOFOX_API_KEY. " +
        "See: https://github.com/redf0x1/camofox-mcp#api-key-setup"
    );
  }

  const { server, client } = createServer(config);

  setupCleanup(async (tabId, userId) => {
    await client.closeTab(tabId, userId);
    removeTrackedTab(tabId);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(async (error) => {
  const openTabs = getAllTrackedTabs();
  const config = loadConfig();
  const { client } = createServer(config);

  await Promise.allSettled(
    openTabs.map(async (tab) => {
      try {
        await client.closeTab(tab.tabId, tab.userId);
        removeTrackedTab(tab.tabId);
      } catch {
        return;
      }
    })
  );

  process.stderr.write(`${error instanceof Error ? error.message : "Unknown startup error"}\n`);
  process.exit(1);
});
