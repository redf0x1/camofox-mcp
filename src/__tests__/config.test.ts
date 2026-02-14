import { describe, expect, it } from "vitest";

import { homedir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "../config.js";

describe("config", () => {
  it("loadConfig() returns defaults when no env/CLI provided", () => {
    const cfg = loadConfig([], {} as NodeJS.ProcessEnv);

    expect(cfg).toEqual({
      camofoxUrl: "http://localhost:9377",
      apiKey: undefined,
      defaultUserId: "default",
      profilesDir: join(homedir(), ".camofox-mcp", "profiles"),
      timeout: 30_000
    });
  });

  it("loadConfig() uses env var overrides", () => {
    const cfg = loadConfig([], {
      CAMOFOX_URL: "http://env:1234",
      CAMOFOX_API_KEY: "env-key",
      CAMOFOX_DEFAULT_USER_ID: "env-user",
      CAMOFOX_PROFILES_DIR: "/tmp/camofox-profiles",
      CAMOFOX_TIMEOUT: "12345"
    } as NodeJS.ProcessEnv);

    expect(cfg.camofoxUrl).toBe("http://env:1234");
    expect(cfg.apiKey).toBe("env-key");
    expect(cfg.defaultUserId).toBe("env-user");
    expect(cfg.profilesDir).toBe("/tmp/camofox-profiles");
    expect(cfg.timeout).toBe(12345);
  });

  it("loadConfig() uses CLI arg overrides", () => {
    const cfg = loadConfig(
      ["--url", "http://cli:1", "--key", "cli-key", "--user-id", "cli-user", "--profiles-dir", "/tmp/cli-profiles", "--timeout", "5000"],
      {} as NodeJS.ProcessEnv
    );

    expect(cfg.camofoxUrl).toBe("http://cli:1");
    expect(cfg.apiKey).toBe("cli-key");
    expect(cfg.defaultUserId).toBe("cli-user");
    expect(cfg.profilesDir).toBe("/tmp/cli-profiles");
    expect(cfg.timeout).toBe(5000);
  });

  it("loadConfig() CLI overrides env vars", () => {
    const cfg = loadConfig(
      ["--camofox-url", "http://cli:2", "--api-key", "cli-key", "--default-user-id", "cli-user", "--profiles-dir", "/tmp/cli-profiles-2"],
      {
        CAMOFOX_URL: "http://env:2",
        CAMOFOX_API_KEY: "env-key",
        CAMOFOX_DEFAULT_USER_ID: "env-user",
        CAMOFOX_PROFILES_DIR: "/tmp/env-profiles-2",
        CAMOFOX_TIMEOUT: "1111"
      } as NodeJS.ProcessEnv
    );

    expect(cfg.camofoxUrl).toBe("http://cli:2");
    expect(cfg.apiKey).toBe("cli-key");
    expect(cfg.defaultUserId).toBe("cli-user");
    expect(cfg.profilesDir).toBe("/tmp/cli-profiles-2");
    // timeout remains env-derived unless CLI provides it
    expect(cfg.timeout).toBe(1111);
  });

  it("loadConfig() handles invalid values", () => {
    const cfg = loadConfig(
      ["--timeout", "0"],
      {
        CAMOFOX_TIMEOUT: "not-a-number"
      } as NodeJS.ProcessEnv
    );

    // CLI timeout ignored (0), env timeout invalid => default
    expect(cfg.timeout).toBe(30_000);
  });
});
