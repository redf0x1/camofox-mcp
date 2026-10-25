import { createServer as createHttpServer } from "node:http";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { createServer } from "../server.js";
import { trackTab, removeTrackedTab } from "../state.js";

it("runs registered custom search over MCP and the real browser HTTP client contract", async () => {
  const requests: Array<{ path: string; method: string; body: unknown }> = [];
  let blocked = false;
  const fixture = createHttpServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    requests.push({ path: req.url!, method: req.method!, body });
    res.setHeader("content-type", "application/json");
    if (req.url === "/tabs/search-contract/navigate") {
      if (blocked) { res.statusCode = 403; res.end(JSON.stringify({ error: "Private network navigation blocked" })); return; }
      res.end(JSON.stringify({ url: body.url }));
    } else if (req.url?.startsWith("/tabs/search-contract/snapshot")) {
      res.end(JSON.stringify({ url: "https://search.example/results", snapshot: "Fixture result: 雪 & tea", refsCount: 1 }));
    } else { res.statusCode = 404; res.end("{}"); }
  });
  fixture.listen(0, "127.0.0.1");
  await once(fixture, "listening");
  const port = (fixture.address() as { port: number }).port;
  const config = loadConfig([], { CAMOFOX_URL: `http://127.0.0.1:${port}`, CAMOFOX_SEARCH_URL_TEMPLATE: "https://search.example/search?q={query}&language=en" });
  const { server } = createServer(config);
  const client = new Client({ name: "search-contract-test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  trackTab({ tabId: "search-contract", userId: "fixture-user", sessionKey: "fixture-session", url: "about:blank", createdAt: "2026-08-13", lastActivity: 0, visitedUrls: [], toolCalls: 0, refsCount: 0 });
  try {
    await server.connect(a);
    await client.connect(b);
    const tools = await client.listTools();
    expect(JSON.stringify(tools.tools.find(tool => tool.name === "web_search")?.inputSchema)).toContain("custom");
    const result = await client.callTool({ name: "web_search", arguments: { tabId: "search-contract", engine: "custom", query: "雪 & tea" } });
    expect(result.isError).toBeFalsy();
    expect(JSON.stringify(result)).toContain("Fixture result");
    expect(requests[0]).toEqual({ path: "/tabs/search-contract/navigate", method: "POST", body: { userId: "fixture-user", url: "https://search.example/search?q=%E9%9B%AA%20%26%20tea&language=en" } });
    expect(requests[1].path).toContain("/tabs/search-contract/snapshot");
    blocked = true;
    const failure = await client.callTool({ name: "web_search", arguments: { tabId: "search-contract", engine: "custom", query: "blocked" } });
    expect(failure.isError).toBe(true);
    expect(JSON.stringify(failure)).toContain("Private network navigation blocked");
    expect(requests).toHaveLength(3); // no snapshot or fallback after browser rejection
  } finally {
    removeTrackedTab("search-contract");
    await client.close();
    await server.close();
    await new Promise<void>((resolve, reject) => fixture.close(error => error ? reject(error) : resolve()));
  }
});
