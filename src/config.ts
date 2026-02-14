import { homedir } from "node:os";
import { join } from "node:path";

import { type Config } from "./types.js";

interface CliArgs {
  camofoxUrl?: string;
  apiKey?: string;
  defaultUserId?: string;
  profilesDir?: string;
  timeout?: number;
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
    timeout: cli.timeout ?? (Number.isNaN(timeoutFromEnv) ? 30_000 : timeoutFromEnv)
  };
}
