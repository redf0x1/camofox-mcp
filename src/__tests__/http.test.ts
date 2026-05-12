import { afterEach, describe, expect, it } from "vitest";

import { once } from "node:events";
import type { AddressInfo } from "node:net";

import { loadConfig } from "../config.js";
import { createMcpHttpApp } from "../http.js";

const servers: Array<{ close: () => void }> = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close();
          resolve();
        })
    )
  );
});

async function listen(app: ReturnType<typeof createMcpHttpApp>): Promise<string> {
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("http transport", () => {
  it.each(["GET", "POST", "DELETE"])("requires bearer auth for %s /mcp when HTTP API key is configured", async (method) => {
    const config = loadConfig([], {
      CAMOFOX_TRANSPORT: "http",
      CAMOFOX_HTTP_API_KEY: "0123456789abcdef0123456789abcdef"
    } as NodeJS.ProcessEnv);
    const baseUrl = await listen(createMcpHttpApp(config));

    const response = await fetch(`${baseUrl}/mcp`, {
      method,
      headers: method === "POST" ? { "content-type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) : undefined
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toMatch(/^Bearer /);
    const body = await response.json();
    expect(body).toMatchObject({ error: "invalid_token" });
  });

  it("rejects x-api-key when inbound HTTP auth is configured", async () => {
    const config = loadConfig([], {
      CAMOFOX_TRANSPORT: "http",
      CAMOFOX_HTTP_API_KEY: "0123456789abcdef0123456789abcdef"
    } as NodeJS.ProcessEnv);
    const baseUrl = await listen(createMcpHttpApp(config));

    const response = await fetch(`${baseUrl}/mcp`, {
      method: "GET",
      headers: { "x-api-key": "0123456789abcdef0123456789abcdef" }
    });

    expect(response.status).toBe(401);
  });

  it("allows bearer-authenticated unsupported methods to reach method handling", async () => {
    const config = loadConfig([], {
      CAMOFOX_TRANSPORT: "http",
      CAMOFOX_HTTP_API_KEY: "0123456789abcdef0123456789abcdef"
    } as NodeJS.ProcessEnv);
    const baseUrl = await listen(createMcpHttpApp(config));

    const response = await fetch(`${baseUrl}/mcp`, {
      method: "GET",
      headers: { authorization: "Bearer 0123456789abcdef0123456789abcdef" }
    });

    expect(response.status).toBe(405);
  });
});
