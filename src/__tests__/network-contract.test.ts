import { createServer as httpServer, type Server } from "node:http";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { createMcpHttpApp } from "../http.js";
import { createServer } from "../server.js";
import { removeTrackedTab } from "../state.js";

const key = "A".repeat(43);
const record = { id: 1, tabId: "network-fixture", startedAt: 1, method: "GET", url: "https://example.test/", resourceType: "document", state: "finished", status: 200 };

async function urlOf(server: Server): Promise<string> {
  await once(server, "listening");
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

it.each(["stdio", "http"])("passes capture keys only in headers across the %s tool contract", async (mode) => {
  const requests: Array<{ path: string; key?: string; body?: unknown }> = [];
  let supportsCapture = true;
  const fixture = httpServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    const path = req.url!;
    requests.push({ path, key: req.headers["x-camofox-network-key"] as string | undefined, body });
    res.setHeader("content-type", "application/json");
    if (path === "/network/capabilities" && supportsCapture) res.end(JSON.stringify({ captureVersion: 1 }));
    else if (path === "/tabs") res.end(JSON.stringify({ tabId: "network-fixture", networkKey: key }));
    else if (path.startsWith("/network/requests?")) res.end(JSON.stringify({ state: "recording", dropped: 0, requests: [record], nextCursor: null }));
    else if (path.startsWith("/network/requests/1?")) res.end(JSON.stringify({ ...record, body: "body-fixture" }));
    else if (path.startsWith("/network/intercept?")) res.end(JSON.stringify({ ruleCount: 1 }));
    else if (path.startsWith("/network/capture/stop?")) res.end(JSON.stringify({ state: "stopped" }));
    else if (path.startsWith("/network/har?")) res.end(JSON.stringify({ log: { version: "1.2", creator: { name: "fixture", version: "1" }, entries: [] } }));
    else { res.statusCode = 404; res.end("{}"); }
  }).listen(0, "127.0.0.1");
  const config = loadConfig([], { CAMOFOX_URL: await urlOf(fixture), CAMOFOX_AUTO_SAVE: "false" });
  const client = new Client({ name: "network-contract", version: "1.0.0" });
  const mcp = mode === "stdio" ? createServer(config).server : undefined;
  const http = mode === "http" ? createMcpHttpApp(config).listen(0, "127.0.0.1") : undefined;

  try {
    if (mcp) {
      const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
      await mcp.connect(serverSide);
      await client.connect(clientSide);
    } else if (http) {
      await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", await urlOf(http))));
    }

    const created = await client.callTool({ name: "create_tab", arguments: {
      url: "https://example.test/", userId: "user & owner", sessionKey: "session", networkCapture: { scope: "session" }
    } });
    expect(created.isError).toBeFalsy();
    expect(JSON.stringify(created)).toContain(key);
    expect(requests[1]).toMatchObject({ path: "/tabs", body: { networkCapture: { scope: "session" } } });

    const args = { userId: "user & owner", networkKey: key };
    const listed = await client.callTool({ name: "network_list_requests", arguments: { ...args, after: 0, limit: 1 } });
    expect(listed.isError).toBeFalsy();
    expect(JSON.stringify(listed)).toContain("https://example.test/");
    expect(JSON.stringify(listed)).not.toContain(key);
    expect(requests[2]).toMatchObject({ path: "/network/requests?after=0&limit=1&userId=user+%26+owner", key });

    const inspected = await client.callTool({ name: "network_get_response", arguments: { ...args, requestId: 1 } });
    expect(inspected.isError).toBeFalsy();
    expect(JSON.stringify(inspected)).not.toContain("body-fixture");
    const body = await client.callTool({ name: "network_get_response", arguments: { ...args, requestId: 1, includeBody: true } });
    expect(body.isError).toBeFalsy();
    expect(JSON.stringify(body)).toContain("body-fixture");
    expect(requests.at(-1)?.path).toContain("includeBody=true");
    const rules = [{ action: "abort", method: "GET", url: "https://example.test/fixture" }];
    const intercepted = await client.callTool({ name: "network_intercept", arguments: { ...args, rules } });
    expect(intercepted.isError).toBeFalsy();
    expect(requests.at(-1)).toMatchObject({ path: "/network/intercept?userId=user+%26+owner", key, body: { rules } });
    const stopped = await client.callTool({ name: "network_capture_stop", arguments: args });
    expect(stopped.isError).toBeFalsy();
    const har = await client.callTool({ name: "network_export_har", arguments: args });
    expect(har.isError).toBeFalsy();
    expect(JSON.stringify(har)).toContain("1.2");

    supportsCapture = false;
    const count = requests.length;
    const unsupported = await client.callTool({ name: "create_tab", arguments: { networkCapture: {} } });
    expect(unsupported.isError).toBe(true);
    expect(JSON.stringify(unsupported)).toContain("does not support network capture");
    expect(requests.slice(count)).toEqual([{ path: "/network/capabilities", key: undefined, body: undefined }]);
  } finally {
    removeTrackedTab(record.tabId);
    await client.close();
    await mcp?.close();
    if (http) await close(http);
    await close(fixture);
  }
});
