#!/usr/bin/env node

import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { hostHeaderValidation } from "@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { fileURLToPath } from "node:url";

import { CamofoxClient } from "./client.js";
import { isLoopbackHost, loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { getAllTrackedTabs, removeTrackedTab, setupCleanup } from "./state.js";
import type { Config } from "./types.js";

let httpServer: HttpServer | null = null;
let cleanupClient: CamofoxClient | null = null;
let cleanupInitialized = false;
let httpSignalHandlersRegistered = false;

function constantTimeEquals(actual: string, expected: string): boolean {
  const actualDigest = createHash("sha256").update(actual).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

function createStaticTokenVerifier(expectedToken: string) {
  return {
    async verifyAccessToken(token: string) {
      if (!constantTimeEquals(token, expectedToken)) {
        throw new InvalidTokenError("Invalid bearer token");
      }

      return {
        token,
        clientId: "camofox-http-client",
        scopes: ["mcp"],
        expiresAt: Number.MAX_SAFE_INTEGER
      };
    }
  };
}

function hostHeaderValue(host: string): string {
  const normalized = host.trim().toLowerCase().replace(/^\[(.*)\]$/, "$1");
  return normalized.includes(":") ? `[${normalized}]` : normalized;
}

function getAllowedHostHeaders(config: Config): string[] | undefined {
  if (config.httpAllowedHosts) {
    return config.httpAllowedHosts;
  }

  if (isLoopbackHost(config.httpHost)) {
    return Array.from(new Set(["localhost", "127.0.0.1", "[::1]", hostHeaderValue(config.httpHost)]));
  }

  return undefined;
}

function ensureHttpSignalHandlers(): void {
  if (httpSignalHandlersRegistered) {
    return;
  }

  httpSignalHandlersRegistered = true;

  const closeHttpServer = () => {
    if (httpServer) {
      httpServer.close();
      httpServer = null;
    }
  };

  process.once("SIGINT", closeHttpServer);
  process.once("SIGTERM", closeHttpServer);
}

function ensureCleanup(config: Config): void {
  cleanupClient = new CamofoxClient(config);

  if (cleanupInitialized) {
    return;
  }

  cleanupInitialized = true;
  setupCleanup(async (tabId, userId) => {
    if (!cleanupClient) {
      return;
    }
    await cleanupClient.closeTab(tabId, userId);
    removeTrackedTab(tabId);
  });
}

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  return fileURLToPath(import.meta.url) === process.argv[1];
}

export async function startHttpServer(config: Config = loadConfig()): Promise<void> {
  ensureHttpSignalHandlers();
  ensureCleanup(config);

  const app = createMcpHttpApp(config);

  if (!config.apiKey) {
    console.error(
      "[camofox-mcp] ⚠️  CAMOFOX_API_KEY not set in HTTP mode — if your CamoFox server requires auth, requests will fail."
    );
  }

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(config.httpPort, config.httpHost, () => {
      console.error(
        `[camofox-mcp] HTTP transport listening on http://${config.httpHost}:${config.httpPort}/mcp (rate limit: ${config.httpRateLimit} req/min)`
      );
      resolve();
    });

    httpServer = server;
    server.on("error", reject);
  });
}

export function createMcpHttpApp(config: Config): Express {
  const app = express();
  const allowedHostHeaders = getAllowedHostHeaders(config);

  const limiter = rateLimit({
    windowMs: 60_000,
    limit: config.httpRateLimit,
    standardHeaders: true,
    legacyHeaders: false
  });

  if (allowedHostHeaders) {
    app.use(hostHeaderValidation(allowedHostHeaders));
  } else if (config.httpHost === "0.0.0.0" || config.httpHost === "::") {
    console.warn(
      `Warning: Server is binding to ${config.httpHost} without DNS rebinding protection. ` +
        "Set CAMOFOX_HTTP_ALLOWED_HOSTS when possible; CAMOFOX_HTTP_API_KEY is still required for this bind."
    );
  }

  app.use("/mcp", limiter);

  if (config.httpApiKey) {
    app.use(
      "/mcp",
      requireBearerAuth({
        verifier: createStaticTokenVerifier(config.httpApiKey),
        requiredScopes: ["mcp"]
      })
    );
  }

  app.use("/mcp", express.json());

  app.post("/mcp", async (req: any, res: any) => {
    try {
      const { server } = createServer(config);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

      res.on("close", () => {
        transport.close().catch((err) =>
          console.error("[camofox-mcp] transport close error:", err)
        );
        server.close().catch((err) => console.error("[camofox-mcp] server close error:", err));
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[camofox-mcp] HTTP request error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null
        });
      }
    }
  });

  app.delete("/mcp", (_req: any, res: any) => {
    res.status(405).json({ error: "Method not allowed in stateless HTTP mode" });
  });

  app.get("/mcp", (_req: any, res: any) => {
    res.status(405).json({ error: "Method not allowed in stateless HTTP mode" });
  });

  return app;
}

if (isDirectExecution()) {
  const config = loadConfig();

  startHttpServer(config).catch(async (error) => {
    const openTabs = getAllTrackedTabs();
    const client = new CamofoxClient(config);

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
}
