import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../config.js";
import type { ToolResult } from "../errors.js";
import { getTrackedTab, removeTrackedTab, trackTab } from "../state.js";
import type { ToolDeps } from "../server.js";
import { registerObservationTools } from "../tools/observation.js";
import type { TabInfo } from "../types.js";

function makeTab(tabId: string, overrides: Partial<TabInfo> = {}): TabInfo {
  return {
    tabId,
    url: "http://example.com",
    createdAt: "2026-02-16T00:00:00.000Z",
    lastActivity: 0,
    userId: "user-1",
    sessionKey: "session-1",
    visitedUrls: [],
    toolCalls: 0,
    refsCount: 0,
    ...overrides
  };
}

function parseToolTextJson(result: ToolResult): any {
  const first = result.content[0];
  if (!first || first.type !== "text") {
    throw new Error("Expected first content entry to be text");
  }
  return JSON.parse(first.text);
}

function makeServerCapture(): {
  server: { tool: ReturnType<typeof vi.fn> };
  getHandler: (name: string) => (input: unknown) => Promise<ToolResult>;
} {
  const server = {
    tool: vi.fn()
  };

  const getHandler = (name: string) => {
    const call = server.tool.mock.calls.find((entry) => entry[0] === name);
    if (!call) {
      throw new Error(`Expected tool '${name}' to be registered`);
    }
    return call[3] as (input: unknown) => Promise<ToolResult>;
  };

  return { server, getHandler };
}

describe("tools/observation", () => {
  let deps: ToolDeps;
  const createdTabIds: string[] = [];

  beforeEach(() => {
    deps = {
      client: {
        snapshot: vi.fn(),
        screenshot: vi.fn(),
        getLinksWithOptions: vi.fn(),
        waitForText: vi.fn(),
        evaluate: vi.fn()
      } as unknown as ToolDeps["client"],
      config: loadConfig([], { CAMOFOX_URL: "http://test:9377" } as NodeJS.ProcessEnv)
    };
  });

  afterEach(() => {
    for (const tabId of createdTabIds.splice(0, createdTabIds.length)) {
      removeTrackedTab(tabId);
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("camofox_get_page_html returns the rendered DOM HTML", async () => {
    const tabId = "tab-html";
    createdTabIds.push(tabId);
    trackTab(makeTab(tabId, { userId: "user-1" }));
    vi.mocked(deps.client.evaluate).mockResolvedValueOnce({
      ok: true,
      result: "<html><body>ready</body></html>",
      resultType: "string"
    } as any);

    const { server, getHandler } = makeServerCapture();
    registerObservationTools(server as unknown as Parameters<typeof registerObservationTools>[0], deps);
    const handler = getHandler("camofox_get_page_html");

    const result = await handler({ tabId });

    expect(result.isError).toBeFalsy();
    expect(parseToolTextJson(result)).toEqual({ html: "<html><body>ready</body></html>" });
    expect(deps.client.evaluate).toHaveBeenCalledWith(tabId, "document.documentElement.outerHTML", "user-1");
    expect(getTrackedTab(tabId).toolCalls).toBe(1);
  });

  it("camofox_get_page_html scopes extraction when selector is provided", async () => {
    const tabId = "tab-html-scoped";
    createdTabIds.push(tabId);
    trackTab(makeTab(tabId, { userId: "user-1" }));
    vi.mocked(deps.client.evaluate).mockResolvedValueOnce({
      ok: true,
      result: "<main id=\"app\">ready</main>",
      resultType: "string"
    } as any);

    const { server, getHandler } = makeServerCapture();
    registerObservationTools(server as unknown as Parameters<typeof registerObservationTools>[0], deps);
    const handler = getHandler("camofox_get_page_html");

    const result = await handler({ tabId, selector: "#app" });

    expect(result.isError).toBeFalsy();
    expect(parseToolTextJson(result)).toEqual({ html: "<main id=\"app\">ready</main>" });
    expect(vi.mocked(deps.client.evaluate).mock.calls[0]?.[1]).toContain('document.querySelector(selector)');
    expect(vi.mocked(deps.client.evaluate).mock.calls[0]?.[1]).toContain(JSON.stringify("#app"));
    expect(getTrackedTab(tabId).toolCalls).toBe(1);
  });

  it("camofox_get_page_html returns an error result when evaluate fails", async () => {
    const tabId = "tab-html-error";
    createdTabIds.push(tabId);
    trackTab(makeTab(tabId));
    vi.mocked(deps.client.evaluate).mockResolvedValueOnce({ ok: false, error: "evaluate failed" } as any);

    const { server, getHandler } = makeServerCapture();
    registerObservationTools(server as unknown as Parameters<typeof registerObservationTools>[0], deps);
    const handler = getHandler("camofox_get_page_html");

    const result = await handler({ tabId });
    const payload = parseToolTextJson(result);

    expect(result.isError).toBe(true);
    expect(payload).toMatchObject({ isError: true, code: "INTERNAL_ERROR", message: "evaluate failed" });
    expect(getTrackedTab(tabId).toolCalls).toBe(0);
  });

  it("camofox_wait_for_selector polls until the selector appears", async () => {
    vi.useFakeTimers();

    const tabId = "tab-wait-selector";
    createdTabIds.push(tabId);
    trackTab(makeTab(tabId, { userId: "user-1" }));
    vi.mocked(deps.client.evaluate)
      .mockResolvedValueOnce({ ok: true, result: false } as any)
      .mockResolvedValueOnce({ ok: true, result: false } as any)
      .mockResolvedValueOnce({ ok: true, result: true } as any);

    const { server, getHandler } = makeServerCapture();
    registerObservationTools(server as unknown as Parameters<typeof registerObservationTools>[0], deps);
    const handler = getHandler("camofox_wait_for_selector");

    const pending = handler({ tabId, selector: "#app", timeout: 1500 });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;

    expect(result.isError).toBeFalsy();
    expect(parseToolTextJson(result)).toEqual({ success: true, message: "Selector \"#app\" found on page" });
    expect(deps.client.evaluate).toHaveBeenCalledTimes(3);
    expect(getTrackedTab(tabId).toolCalls).toBe(1);
  });

  it("camofox_query_selector returns element details", async () => {
    const tabId = "tab-query-selector";
    createdTabIds.push(tabId);
    trackTab(makeTab(tabId, { userId: "user-1" }));
    vi.mocked(deps.client.evaluate).mockResolvedValueOnce({
      ok: true,
      result: {
        exists: true,
        text: "Sign in",
        html: '<button id="cta" data-role="primary">Sign in</button>',
        tag: "button",
        attributes: {
          id: "cta",
          "data-role": "primary"
        }
      }
    } as any);

    const { server, getHandler } = makeServerCapture();
    registerObservationTools(server as unknown as Parameters<typeof registerObservationTools>[0], deps);
    const handler = getHandler("camofox_query_selector");

    const result = await handler({ tabId, selector: "#cta" });

    expect(result.isError).toBeFalsy();
    expect(parseToolTextJson(result)).toEqual({
      exists: true,
      text: "Sign in",
      html: '<button id="cta" data-role="primary">Sign in</button>',
      tag: "button",
      attributes: {
        id: "cta",
        "data-role": "primary"
      }
    });
    expect(vi.mocked(deps.client.evaluate).mock.calls[0]?.[1]).toContain(JSON.stringify("#cta"));
    expect(getTrackedTab(tabId).toolCalls).toBe(1);
  });

  it("camofox_query_selector returns a specific attribute when requested", async () => {
    const tabId = "tab-query-selector-attr";
    createdTabIds.push(tabId);
    trackTab(makeTab(tabId));
    vi.mocked(deps.client.evaluate).mockResolvedValueOnce({
      ok: true,
      result: {
        exists: true,
        attribute: "href",
        value: "/docs"
      }
    } as any);

    const { server, getHandler } = makeServerCapture();
    registerObservationTools(server as unknown as Parameters<typeof registerObservationTools>[0], deps);
    const handler = getHandler("camofox_query_selector");

    const result = await handler({ tabId, selector: "a.help", attribute: "href" });

    expect(result.isError).toBeFalsy();
    expect(parseToolTextJson(result)).toEqual({ exists: true, attribute: "href", value: "/docs" });
    expect(vi.mocked(deps.client.evaluate).mock.calls[0]?.[1]).toContain(JSON.stringify("href"));
    expect(getTrackedTab(tabId).toolCalls).toBe(1);
  });

  it("camofox_wait_for_selector times out cleanly", async () => {
    vi.useFakeTimers();

    const tabId = "tab-wait-timeout";
    createdTabIds.push(tabId);
    trackTab(makeTab(tabId));
    vi.mocked(deps.client.evaluate).mockResolvedValue({ ok: true, result: false } as any);

    const { server, getHandler } = makeServerCapture();
    registerObservationTools(server as unknown as Parameters<typeof registerObservationTools>[0], deps);
    const handler = getHandler("camofox_wait_for_selector");

    const pending = handler({ tabId, selector: ".late", timeout: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;
    const payload = parseToolTextJson(result);

    expect(result.isError).toBe(true);
    expect(payload).toMatchObject({
      isError: true,
      code: "TIMEOUT",
      message: "Selector \".late\" not found within 1000ms"
    });
    expect(getTrackedTab(tabId).toolCalls).toBe(0);
  });
});