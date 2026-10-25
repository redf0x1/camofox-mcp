import { homedir } from "node:os";
import { join } from "node:path";

import { type Config } from "./types.js";
import { validateSearchUrlTemplate } from "./search-template.js";
import { parseViewportString } from "./viewport.js";

interface CliArgs {
  camofoxUrl?: string;
  apiKey?: string;
  defaultUserId?: string;
  profilesDir?: string;
  timeout?: number;
  autoSave?: boolean;
  transport?: "stdio" | "http";
  httpPort?: number;
  httpHost?: string;
  httpRateLimit?: number;
  httpApiKey?: string;
  httpAllowedHosts?: string[];
  defaultViewport?: string;
}

function parseBoolFlag(raw: string): boolean | undefined {
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
}

function isFalsy(val: string | undefined): boolean {
  if (!val) return false;
  return ["false", "0", "no", "n", "off"].includes(val.trim().toLowerCase());
}

function parseCsvList(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : undefined;
}

function parsePositiveInteger(raw: string | undefined): number | undefined {
  const parsed = Number.parseInt(raw ?? "", 10);
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : undefined;
}

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[(.*)\]$/, "$1");

  if (normalized === "localhost" || normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return true;
  }

  const ipv4Parts = normalized.split(".");
  if (ipv4Parts.length === 4) {
    const octets = ipv4Parts.map((part) => Number.parseInt(part, 10));
    if (octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)) {
      return octets[0] === 127;
    }
  }

  return false;
}

function normalizeOptionalSecret(secret: string | undefined): string | undefined {
  const trimmed = secret?.trim();
  return trimmed ? trimmed : undefined;
}

function assertHttpConfigSafe(config: Pick<Config, "transport" | "httpHost" | "httpApiKey">): void {
  if (config.transport !== "http") {
    return;
  }

  if (config.httpApiKey && config.httpApiKey.length < 32) {
    throw new Error("CAMOFOX_HTTP_API_KEY must be at least 32 characters long");
  }

  if (!isLoopbackHost(config.httpHost) && !config.httpApiKey) {
    throw new Error("CAMOFOX_HTTP_API_KEY is required when CAMOFOX_HTTP_HOST exposes HTTP transport beyond loopback");
  }
}

function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if ((current === "--camofox-url" || current === "--url") && next) {
      args.camofoxUrl = next;
      i += 1;
      continue;
    }

    if ((current === "--api-key" || current === "--key") && next) {
      args.apiKey = next;
      i += 1;
      continue;
    }

    if ((current === "--default-user-id" || current === "--user-id") && next) {
      args.defaultUserId = next;
      i += 1;
      continue;
    }

    if (current === "--profiles-dir" && next) {
      args.profilesDir = next;
      i += 1;
      continue;
    }

    if (current === "--timeout" && next) {
      const timeout = Number.parseInt(next, 10);
      if (!Number.isNaN(timeout) && timeout > 0) {
        args.timeout = timeout;
      }
      i += 1;
      continue;
    }

    if (current === "--auto-save") {
      // Allow: --auto-save (implies true) OR --auto-save false
      if (next && !next.startsWith("--")) {
        const parsed = parseBoolFlag(next);
        if (parsed !== undefined) {
          args.autoSave = parsed;
          i += 1;
        }
      } else {
        args.autoSave = true;
      }
      continue;
    }

    if (current === "--transport" && next) {
      const transport = next.trim().toLowerCase();
      if (transport === "stdio" || transport === "http") {
        args.transport = transport;
      }
      i += 1;
      continue;
    }

    if (current === "--http-port" && next) {
      const httpPort = Number.parseInt(next, 10);
      if (!Number.isNaN(httpPort) && httpPort > 0) {
        args.httpPort = httpPort;
      }
      i += 1;
      continue;
    }

    if (current === "--http-host" && next) {
      args.httpHost = next;
      i += 1;
      continue;
    }

    if (current === "--http-rate-limit" && next) {
      const httpRateLimit = Number.parseInt(next, 10);
      if (!Number.isNaN(httpRateLimit) && httpRateLimit > 0) {
        args.httpRateLimit = httpRateLimit;
      }
      i += 1;
      continue;
    }

    if (current === "--http-api-key" && next) {
      args.httpApiKey = normalizeOptionalSecret(next);
      i += 1;
      continue;
    }

    if (current === "--http-allowed-hosts" && next) {
      args.httpAllowedHosts = parseCsvList(next);
      i += 1;
      continue;
    }

    if (current === "--viewport" && next) {
      args.defaultViewport = next;
      i += 1;
      continue;
    }
  }

  return args;
}

export function loadConfig(argv = process.argv.slice(2), env = process.env): Config {
  const cli = parseCliArgs(argv);
  const timeoutFromEnv = parsePositiveInteger(env.CAMOFOX_TIMEOUT);
  const transportFromEnv = env.CAMOFOX_TRANSPORT?.trim().toLowerCase();
  const httpPortFromEnv = parsePositiveInteger(env.CAMOFOX_HTTP_PORT);
  const httpRateLimitFromEnv = parsePositiveInteger(env.CAMOFOX_HTTP_RATE_LIMIT);

  const envTransport =
    transportFromEnv === "stdio" || transportFromEnv === "http" ? transportFromEnv : undefined;

  const config: Config = {
    camofoxUrl: cli.camofoxUrl ?? env.CAMOFOX_URL ?? "http://localhost:9377",
    apiKey: cli.apiKey ?? env.CAMOFOX_API_KEY,
    searchUrlTemplate: env.CAMOFOX_SEARCH_URL_TEMPLATE === undefined ? undefined : validateSearchUrlTemplate(env.CAMOFOX_SEARCH_URL_TEMPLATE),
    defaultUserId: cli.defaultUserId ?? env.CAMOFOX_DEFAULT_USER_ID ?? "default",
    profilesDir: cli.profilesDir ?? env.CAMOFOX_PROFILES_DIR ?? join(homedir(), ".camofox-mcp", "profiles"),
    timeout: cli.timeout ?? timeoutFromEnv ?? 30_000,
    autoSave: cli.autoSave ?? !isFalsy(env.CAMOFOX_AUTO_SAVE),
    transport: cli.transport ?? envTransport ?? "stdio",
    httpPort: cli.httpPort ?? httpPortFromEnv ?? 3000,
    httpHost: cli.httpHost ?? env.CAMOFOX_HTTP_HOST ?? "127.0.0.1",
    httpRateLimit: cli.httpRateLimit ?? httpRateLimitFromEnv ?? 60,
    httpApiKey: cli.httpApiKey ?? normalizeOptionalSecret(env.CAMOFOX_HTTP_API_KEY),
    httpAllowedHosts: cli.httpAllowedHosts ?? parseCsvList(env.CAMOFOX_HTTP_ALLOWED_HOSTS),
    defaultViewport: parseViewportString(cli.defaultViewport ?? env.CAMOFOX_VIEWPORT)
  };

  assertHttpConfigSafe(config);

  return config;
}
