import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverEntry = process.env.CAMOFOX_MCP_ENTRY ?? path.join(__dirname, "..", "dist", "index.js");
const camofoxUrl = process.env.CAMOFOX_URL ?? "http://localhost:9377";
const testUrl = process.env.CAMOFOX_E2E_URL ?? "https://bot.sannysoft.com";

const transport = new StdioClientTransport({
  command: "node",
  args: [serverEntry],
  env: { ...process.env, CAMOFOX_URL: camofoxUrl }
});

const client = new Client({ name: "test-client", version: "1.0.0" });
await client.connect(transport);

console.log("=== Tools List ===");
const tools = await client.listTools();
console.log(`Total tools: ${tools.tools.length}`);

console.log("\n=== Server Status ===");
const status = await client.callTool({ name: "server_status", arguments: {} });
console.log(JSON.stringify(status.content, null, 2));

console.log("\n=== Create Tab ===");
const tab = await client.callTool({ name: "create_tab", arguments: {} });
console.log(JSON.stringify(tab.content, null, 2));

const tabContent = JSON.parse(tab.content[0].text);
const tabId = tabContent.tabId;

console.log("\n=== Navigate ===");
const nav = await client.callTool({ name: "navigate", arguments: { tabId, url: testUrl } });
console.log(JSON.stringify(nav.content, null, 2));

console.log("\n=== Snapshot ===");
const snap = await client.callTool({ name: "snapshot", arguments: { tabId } });
const snapContent = JSON.parse(snap.content[0].text);
console.log(`URL: ${snapContent.url}`);
console.log(`Refs count: ${snapContent.refsCount}`);

console.log("\n=== Web Search ===");
const search = await client.callTool({ name: "web_search", arguments: { tabId, query: "CamoFox browser", engine: "google" } });
const searchContent = JSON.parse(search.content[0].text);
console.log(`Search URL: ${searchContent.url}`);
console.log(`Search refs: ${searchContent.refsCount}`);

console.log("\n=== Get Links ===");
const links = await client.callTool({ name: "get_links", arguments: { tabId } });
const linksContent = JSON.parse(links.content[0].text);
console.log(`Links found: ${linksContent.links?.length || 0}`);

console.log("\n=== Get Stats ===");
const stats = await client.callTool({ name: "get_stats", arguments: { tabId } });
console.log(JSON.stringify(stats.content, null, 2));

console.log("\n=== Close Tab ===");
const close = await client.callTool({ name: "close_tab", arguments: { tabId } });
console.log(JSON.stringify(close.content, null, 2));

console.log("\n=== List Tabs ===");
const tabList = await client.callTool({ name: "list_tabs", arguments: {} });
console.log(JSON.stringify(tabList.content, null, 2));

console.log("\n✅ All tests passed!");
await client.close();
