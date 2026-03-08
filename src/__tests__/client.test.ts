import { afterEach, describe, expect, it, vi } from "vitest";

import { CamofoxClient } from "../client.js";
import { AppError } from "../errors.js";
import type { Config } from "../types.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    camofoxUrl: "http://test:9377",
    apiKey: undefined,
    defaultUserId: "default",
    profilesDir: "/tmp/camofox-profiles",
    timeout: 50,
    autoSave: true,
    ...overrides
  };
}

function expectAppErrorWithCode(err: unknown, code: string): AppError {
  expect(err).toBeTruthy();
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
  return err as AppError;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).fetch;
  }
});

describe("client", () => {
  it("request timeout maps AbortError(name=AbortError) to TIMEOUT", async () => {
    vi.useFakeTimers();

    const client = new CamofoxClient(makeConfig({ timeout: 50 }));

    const fetchMock = vi.fn(((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;

      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          const abortErr = Object.assign(new Error("aborted"), { name: "AbortError" });
          reject(abortErr);
        });
      });
    }) as typeof fetch);

    globalThis.fetch = fetchMock;

    const pending = client.healthCheck();
    const assertion = expect(pending).rejects.toMatchObject({
      name: "AppError",
      code: "TIMEOUT",
      message: expect.stringMatching(/timed out/i)
    });

    await vi.advanceTimersByTimeAsync(60);

    await assertion;
  });

  it("network errors map to CONNECTION_REFUSED", async () => {
    const client = new CamofoxClient(makeConfig());

    const fetchMock = vi.fn((() => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:9377");
    }) as typeof fetch);
    globalThis.fetch = fetchMock;

    try {
      await client.healthCheck();
      expect.fail("Expected healthCheck() to throw");
    } catch (err) {
      const appError = expectAppErrorWithCode(err, "CONNECTION_REFUSED");
      expect(appError.message).toMatch(/failed to connect/i);
      expect(appError.message).toMatch(/ECONNREFUSED/i);
    }
  });

  it("HTTP non-OK responses throw AppError with status and message", async () => {
    const client = new CamofoxClient(makeConfig());

    const fetchMock = vi.fn((async () => {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }) as typeof fetch);
    globalThis.fetch = fetchMock;

    try {
      await client.healthCheck();
      expect.fail("Expected healthCheck() to throw");
    } catch (err) {
      const appError = expectAppErrorWithCode(err, "API_KEY_REQUIRED");
      expect(appError.status).toBe(403);
      expect(appError.message).toContain("CAMOFOX_API_KEY");
    }
  });

  it("requests proceed without API key (no pre-flight guard)", async () => {
    const client = new CamofoxClient(makeConfig({ apiKey: undefined }));

    const fetchMock = vi.fn((async () => {
      return new Response(JSON.stringify({ ok: true, result: 2 }), { status: 200 });
    }) as typeof fetch);
    globalThis.fetch = fetchMock;

    const result = await client.evaluate("tab-1", "1 + 1", "user-1");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Verify no auth headers sent
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("x-api-key")).toBeNull();
    expect(headers.get("authorization")).toBeNull();
  });

  it("auth headers are sent when apiKey is configured", async () => {
    const client = new CamofoxClient(makeConfig({ apiKey: "test-key" }));

    const fetchMock = vi.fn((async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("x-api-key")).toBe("test-key");
      expect(headers.get("authorization")).toBe("Bearer test-key");
      expect(headers.get("content-type")).toMatch(/application\/json/i);

      return new Response(JSON.stringify({ ok: true, result: 2 }), { status: 200 });
    }) as typeof fetch);
    globalThis.fetch = fetchMock;

    const result = await client.evaluate("tab-1", "1 + 1", "user-1");
    expect(result.ok).toBe(true);
    expect(result.result).toBe(2);
  });

  it("successful request parses JSON response", async () => {
    const client = new CamofoxClient(makeConfig());

    const fetchMock = vi.fn((async (url: string) => {
      expect(url).toBe("http://test:9377/health");
      return new Response(JSON.stringify({ ok: true, browserConnected: true, version: "1.2.3" }), { status: 200 });
    }) as typeof fetch);
    globalThis.fetch = fetchMock;

    await expect(client.healthCheck()).resolves.toEqual({
      ok: true,
      browserConnected: true,
      version: "1.2.3"
    });
  });

  it("smartTypeText uses keystroke typing for short text", async () => {
    const client = new CamofoxClient(makeConfig());
    const shortText = "a".repeat(399);

    const fetchMock = vi.fn((async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://test:9377/tabs/tab-1/type");
      expect(JSON.parse(String(init?.body))).toEqual({
        selector: "#search",
        text: shortText,
        userId: "user-1"
      });
      return new Response(null, { status: 204 });
    }) as typeof fetch);
    globalThis.fetch = fetchMock;

    await expect(client.smartTypeText("tab-1", { selector: "#search" }, shortText, "user-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("smartTypeText uses evaluate fallback for long text with selector", async () => {
    const client = new CamofoxClient(makeConfig());
    const longText = "x".repeat(400);

    const fetchMock = vi.fn((async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://test:9377/tabs/tab-1/evaluate");
      const body = JSON.parse(String(init?.body)) as { expression: string; userId: string };
      expect(body.userId).toBe("user-1");
      expect(body.expression).toContain(JSON.stringify("#editor"));
      expect(body.expression).toContain(JSON.stringify(longText));
      expect(body.expression).toContain('document.execCommand("insertText", false, text)');
      expect(body.expression).toContain("element.textContent = text");
      return new Response(JSON.stringify({ ok: true, result: { applied: true, mode: "textarea" } }), { status: 200 });
    }) as typeof fetch);
    globalThis.fetch = fetchMock;

    await expect(client.smartTypeText("tab-1", { selector: "#editor" }, longText, "user-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("smartTypeText rejects long ref-only requests with actionable error", async () => {
    const client = new CamofoxClient(makeConfig());

    await expect(client.smartTypeText("tab-1", { ref: "e1" }, "x".repeat(400), "user-1")).rejects.toMatchObject({
      name: "AppError",
      code: "VALIDATION_ERROR",
      message: "Long text with ref-only is not supported; please provide a CSS selector for long text input"
    });
  });

  it("smartTypeText remaps evaluate auth failures to long-text guidance", async () => {
    const client = new CamofoxClient(makeConfig());

    const fetchMock = vi.fn((async () => {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }) as typeof fetch);
    globalThis.fetch = fetchMock;

    try {
      await client.smartTypeText("tab-1", { selector: "#editor" }, "x".repeat(400), "user-1");
      expect.fail("Expected smartTypeText() to throw");
    } catch (err) {
      const appError = expectAppErrorWithCode(err, "API_KEY_REQUIRED");
      expect(appError.message).toBe("Evaluate fallback requires API key. Set CAMOFOX_API_KEY for long text support.");
    }
  });

  it("smartTypeText uses the env-configured long text threshold", async () => {
    vi.resetModules();
    vi.stubEnv("CAMOFOX_LONG_TEXT_THRESHOLD", "12");

    const { CamofoxClient: ReloadedCamofoxClient } = await import("../client.js");
    const client = new ReloadedCamofoxClient(makeConfig());
    const fetchMock = vi.fn((async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://test:9377/tabs/tab-1/evaluate");
      const body = JSON.parse(String(init?.body)) as { expression: string; userId: string };
      expect(body.userId).toBe("user-1");
      expect(body.expression).toContain(JSON.stringify("threshold-hit"));
      return new Response(JSON.stringify({ ok: true, result: { applied: true, mode: "input" } }), { status: 200 });
    }) as typeof fetch);
    globalThis.fetch = fetchMock;

    await expect(client.smartTypeText("tab-1", { selector: "#search" }, "threshold-hit", "user-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
});
