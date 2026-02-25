import { describe, expect, it } from "vitest";

import { homedir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "../config.js";

describe("config", () => {
  it("loadConfig() returns defaults when no env/CLI provided", () => {
    const cfg = loadConfig([], {} as NodeJS.ProcessEnv);

    expect(cfg).toMatchObject({
      camofoxUrl: "http://localhost:9377",
      apiKey: undefined,
      defaultUserId: "default",
      profilesDir: join(homedir(), ".camofox-mcp", "profiles"),
      timeout: 30_000,
      autoSave: true,
      transport: "stdio",
      httpPort: 3000,
      httpHost: "127.0.0.1",
      httpRateLimit: 60
    });
  });

  it("loadConfig() uses env var overrides", () => {
    const cfg = loadConfig([], {
      CAMOFOX_URL: "http://env:1234",
      CAMOFOX_API_KEY: "env-key",
      CAMOFOX_DEFAULT_USER_ID: "env-user",
      CAMOFOX_PROFILES_DIR: "/tmp/camofox-profiles",
      CAMOFOX_TIMEOUT: "12345",
      CAMOFOX_AUTO_SAVE: "false"
    } as NodeJS.ProcessEnv);

    expect(cfg.camofoxUrl).toBe("http://env:1234");
    expect(cfg.apiKey).toBe("env-key");
    expect(cfg.defaultUserId).toBe("env-user");
    expect(cfg.profilesDir).toBe("/tmp/camofox-profiles");
    expect(cfg.timeout).toBe(12345);
    expect(cfg.autoSave).toBe(false);
  });

  it.each(["0", "no", "off"])("loadConfig() treats CAMOFOX_AUTO_SAVE=%s as false", (val) => {
    const cfg = loadConfig([], {
      CAMOFOX_AUTO_SAVE: val
    } as NodeJS.ProcessEnv);
    expect(cfg.autoSave).toBe(false);
  });

  it("loadConfig() uses CLI arg overrides", () => {
    const cfg = loadConfig(
      ["--url", "http://cli:1", "--key", "cli-key", "--user-id", "cli-user", "--profiles-dir", "/tmp/cli-profiles", "--timeout", "5000", "--auto-save", "false"],
      {} as NodeJS.ProcessEnv
    );

    expect(cfg.camofoxUrl).toBe("http://cli:1");
    expect(cfg.apiKey).toBe("cli-key");
    expect(cfg.defaultUserId).toBe("cli-user");
    expect(cfg.profilesDir).toBe("/tmp/cli-profiles");
    expect(cfg.timeout).toBe(5000);
    expect(cfg.autoSave).toBe(false);
  });

  it("loadConfig() CLI overrides env vars", () => {
    const cfg = loadConfig(
      ["--camofox-url", "http://cli:2", "--api-key", "cli-key", "--default-user-id", "cli-user", "--profiles-dir", "/tmp/cli-profiles-2", "--auto-save", "true"],
      {
        CAMOFOX_URL: "http://env:2",
        CAMOFOX_API_KEY: "env-key",
        CAMOFOX_DEFAULT_USER_ID: "env-user",
        CAMOFOX_PROFILES_DIR: "/tmp/env-profiles-2",
        CAMOFOX_TIMEOUT: "1111",
        CAMOFOX_AUTO_SAVE: "false"
      } as NodeJS.ProcessEnv
    );

    expect(cfg.camofoxUrl).toBe("http://cli:2");
    expect(cfg.apiKey).toBe("cli-key");
    expect(cfg.defaultUserId).toBe("cli-user");
    expect(cfg.profilesDir).toBe("/tmp/cli-profiles-2");
    // timeout remains env-derived unless CLI provides it
    expect(cfg.timeout).toBe(1111);
    expect(cfg.autoSave).toBe(true);
  });

  it("loadConfig() uses HTTP transport env var overrides", () => {
    const cfg = loadConfig([], {
      CAMOFOX_TRANSPORT: "http",
      CAMOFOX_HTTP_PORT: "8080",
      CAMOFOX_HTTP_HOST: "0.0.0.0",
      CAMOFOX_HTTP_RATE_LIMIT: "120"
    } as NodeJS.ProcessEnv);

    expect(cfg.transport).toBe("http");
    expect(cfg.httpPort).toBe(8080);
    expect(cfg.httpHost).toBe("0.0.0.0");
    expect(cfg.httpRateLimit).toBe(120);
  });

  it("loadConfig() uses HTTP transport CLI arg overrides", () => {
    const cfg = loadConfig(
      [
        "--transport",
        "http",
        "--http-port",
        "9090",
        "--http-host",
        "0.0.0.0",
        "--http-rate-limit",
        "240"
      ],
      {} as NodeJS.ProcessEnv
    );

    expect(cfg.transport).toBe("http");
    expect(cfg.httpPort).toBe(9090);
    expect(cfg.httpHost).toBe("0.0.0.0");
    expect(cfg.httpRateLimit).toBe(240);
  });

  it("loadConfig() defaults to stdio for invalid CAMOFOX_TRANSPORT", () => {
    const cfg = loadConfig([], {
      CAMOFOX_TRANSPORT: "invalid"
    } as NodeJS.ProcessEnv);

    expect(cfg.transport).toBe("stdio");
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
