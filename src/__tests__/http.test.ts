import { afterEach, describe, expect, it } from "vitest";

import { once } from "node:events";
import { request, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { loadConfig } from "../config.js";
import { createMcpHttpApp } from "../http.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
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

async function getWithHost(baseUrl: string, host: string): Promise<number> {
  const url = new URL("/mcp", baseUrl);

  return new Promise<number>((resolve, reject) => {
    const req = request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "GET",
        headers: { Host: host }
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      }
    );

    req.on("error", reject);
    req.end();
  });
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

  it("does not leak the expected bearer token on invalid auth", async () => {
    const expectedToken = "0123456789abcdef0123456789abcdef";
    const config = loadConfig([], {
      CAMOFOX_TRANSPORT: "http",
      CAMOFOX_HTTP_API_KEY: expectedToken
    } as NodeJS.ProcessEnv);
    const baseUrl = await listen(createMcpHttpApp(config));

    const response = await fetch(`${baseUrl}/mcp`, {
      method: "GET",
      headers: { authorization: "Bearer wrong-token" }
    });

    expect(response.status).toBe(401);
    const authenticateHeader = response.headers.get("www-authenticate") ?? "";
    const body = await response.text();
    expect(authenticateHeader).not.toContain(expectedToken);
    expect(body).not.toContain(expectedToken);
  });

  it("authenticates before parsing POST bodies", async () => {
    const config = loadConfig([], {
      CAMOFOX_TRANSPORT: "http",
      CAMOFOX_HTTP_HOST: "0.0.0.0",
      CAMOFOX_HTTP_API_KEY: "0123456789abcdef0123456789abcdef",
      CAMOFOX_HTTP_ALLOWED_HOSTS: "127.0.0.1"
    } as NodeJS.ProcessEnv);
    const baseUrl = await listen(createMcpHttpApp(config));

    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).not.toMatch(/unexpected|json|syntax/i);
  });

  it("rejects unexpected Host headers on unauthenticated loopback HTTP", async () => {
    const config = loadConfig([], {
      CAMOFOX_TRANSPORT: "http"
    } as NodeJS.ProcessEnv);
    const baseUrl = await listen(createMcpHttpApp(config));

    await expect(getWithHost(baseUrl, "attacker.example")).resolves.toBe(403);
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
