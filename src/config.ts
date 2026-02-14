import { homedir } from "node:os";
import { join } from "node:path";

import { type Config } from "./types.js";

interface CliArgs {
  camofoxUrl?: string;
  apiKey?: string;
  defaultUserId?: string;
  profilesDir?: string;
  timeout?: number;
  autoSave?: boolean;
}

function parseBoolFlag(raw: string): boolean | undefined {
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
}

function isFalsy(val: string | undefined): boolean {
  if (!val) return false;
  return ["false", "0", "no", "off"].includes(val.trim().toLowerCase());
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
  }

  return args;
}

export function loadConfig(argv = process.argv.slice(2), env = process.env): Config {
  const cli = parseCliArgs(argv);
  const timeoutFromEnv = Number.parseInt(env.CAMOFOX_TIMEOUT ?? "", 10);

  return {
    camofoxUrl: cli.camofoxUrl ?? env.CAMOFOX_URL ?? "http://localhost:9377",
    apiKey: cli.apiKey ?? env.CAMOFOX_API_KEY,
    defaultUserId: cli.defaultUserId ?? env.CAMOFOX_DEFAULT_USER_ID ?? "default",
    profilesDir: cli.profilesDir ?? env.CAMOFOX_PROFILES_DIR ?? join(homedir(), ".camofox-mcp", "profiles"),
    timeout: cli.timeout ?? (Number.isNaN(timeoutFromEnv) ? 30_000 : timeoutFromEnv),
    autoSave: cli.autoSave ?? !isFalsy(env.CAMOFOX_AUTO_SAVE)
  };
}
