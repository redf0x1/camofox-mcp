import { afterEach, describe, expect, it, vi } from "vitest";

import type { TabInfo } from "../types.js";

type StateModule = typeof import("../state.js");

function expectAppErrorWithCode(err: unknown, code: string): void {
  expect(err).toBeTruthy();
  expect(typeof err).toBe("object");
  expect((err as { name?: unknown }).name).toBe("AppError");
  expect((err as { code?: unknown }).code).toBe(code);
}

function makeTab(overrides: Partial<TabInfo> = {}): TabInfo {
  return {
    tabId: "tab-1",
    url: "http://example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActivity: 0,
    userId: "user-1",
    sessionKey: "session-1",
    visitedUrls: [],
    toolCalls: 0,
    refsCount: 0,
    ...overrides
  };
}

async function importFreshState(envOverrides: Record<string, string> = {}): Promise<StateModule> {
  vi.resetModules();
  vi.unstubAllEnvs();

  const baseEnv: Record<string, string> = {
    CAMOFOX_TAB_TTL_MS: "1800000",
    CAMOFOX_MAX_TABS: "100",
    CAMOFOX_VISITED_URLS_LIMIT: "50",
    CAMOFOX_SWEEP_INTERVAL_MS: "60000"
  };

  for (const [key, value] of Object.entries({ ...baseEnv, ...envOverrides })) {
    vi.stubEnv(key, value);
  }

  return import("../state.js");
}

async function clearTabs(state: Pick<StateModule, "getAllTrackedTabs" | "removeTrackedTab">): Promise<void> {
  for (const tab of state.getAllTrackedTabs()) {
    state.removeTrackedTab(tab.tabId);
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("state", () => {
  it("trackTab() creates an entry and sets lastActivity", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T00:00:00.000Z"));

    const state = await importFreshState();

    const tab = makeTab({ lastActivity: 123 });
    state.trackTab(tab);

    const all = state.getAllTrackedTabs();
    expect(all).toHaveLength(1);
    expect(all[0]?.tabId).toBe(tab.tabId);
    expect(all[0]?.lastActivity).toBe(Date.now());

    await clearTabs(state);
  });

  it("trackTab() enforces MAX_TABS limit", async () => {
    const state = await importFreshState({ CAMOFOX_MAX_TABS: "1" });

    state.trackTab(makeTab({ tabId: "tab-1" }));

    try {
      state.trackTab(makeTab({ tabId: "tab-2" }));
      expect.fail("Expected trackTab() to throw when MAX_TABS is exceeded");
    } catch (err) {
      expectAppErrorWithCode(err, "MAX_TABS_EXCEEDED");
    }

    await clearTabs(state);
  });

  it("getTrackedTab() returns tab and updates lastActivity", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T00:00:00.000Z"));

    const state = await importFreshState();
    state.trackTab(makeTab({ tabId: "tab-1" }));

    vi.setSystemTime(new Date("2026-02-14T00:00:10.000Z"));
    const tracked = state.getTrackedTab("tab-1");

    expect(tracked.tabId).toBe("tab-1");
    expect(tracked.lastActivity).toBe(Date.now());

    await clearTabs(state);
  });

  it("getTrackedTab() throws AppError for unknown tabId", async () => {
    const state = await importFreshState();

    try {
      state.getTrackedTab("missing");
      expect.fail("Expected getTrackedTab() to throw for unknown tabId");
    } catch (err) {
      expectAppErrorWithCode(err, "TAB_NOT_FOUND");
    }

    await clearTabs(state);
  });

  it("removeTrackedTab() removes tab and is a no-op for unknown tabId", async () => {
    const state = await importFreshState();

    state.trackTab(makeTab({ tabId: "tab-1" }));
    state.removeTrackedTab("tab-1");
    expect(state.getAllTrackedTabs()).toHaveLength(0);

    expect(() => state.removeTrackedTab("missing")).not.toThrow();

    await clearTabs(state);
  });

  it("updateTabUrl() adds to visitedUrls and caps at VISITED_URLS_LIMIT", async () => {
    const state = await importFreshState({ CAMOFOX_VISITED_URLS_LIMIT: "2" });

    state.trackTab(makeTab({ tabId: "tab-1", visitedUrls: [] }));

    state.updateTabUrl("tab-1", "http://a.com");
    state.updateTabUrl("tab-1", "http://b.com");
    state.updateTabUrl("tab-1", "http://c.com");

    const tracked = state.getTrackedTab("tab-1");
    expect(tracked.url).toBe("http://c.com");
    expect(tracked.visitedUrls).toEqual(["http://b.com", "http://c.com"]);

    // Duplicate should not be added
    state.updateTabUrl("tab-1", "http://c.com");
    expect(state.getTrackedTab("tab-1").visitedUrls).toEqual(["http://b.com", "http://c.com"]);

    await clearTabs(state);
  });

  it("incrementToolCall() increments the counter", async () => {
    const state = await importFreshState();

    state.trackTab(makeTab({ tabId: "tab-1", toolCalls: 0 }));
    state.incrementToolCall("tab-1");
    state.incrementToolCall("tab-1");

    expect(state.getTrackedTab("tab-1").toolCalls).toBe(2);

    await clearTabs(state);
  });

  it("clearTrackedTabsByUserId() clears all tabs for a user", async () => {
    const state = await importFreshState();

    state.trackTab(makeTab({ tabId: "tab-1", userId: "u1" }));
    state.trackTab(makeTab({ tabId: "tab-2", userId: "u1" }));
    state.trackTab(makeTab({ tabId: "tab-3", userId: "u2" }));

    state.clearTrackedTabsByUserId("u1");

    const remaining = state.getAllTrackedTabs().map((t) => t.tabId).sort();
    expect(remaining).toEqual(["tab-3"]);

    await clearTabs(state);
  });

  it("listTrackedTabs() returns tabId/url/createdAt for each tracked tab", async () => {
    const state = await importFreshState();

    state.trackTab(makeTab({ tabId: "tab-1", url: "http://one", createdAt: "t1" }));
    state.trackTab(makeTab({ tabId: "tab-2", url: "http://two", createdAt: "t2" }));

    const list = state.listTrackedTabs().sort((a, b) => a.tabId.localeCompare(b.tabId));
    expect(list).toEqual([
      { tabId: "tab-1", url: "http://one", createdAt: "t1" },
      { tabId: "tab-2", url: "http://two", createdAt: "t2" }
    ]);

    await clearTabs(state);
  });

  it("getAllTrackedTabs() returns all entries", async () => {
    const state = await importFreshState();

    state.trackTab(makeTab({ tabId: "tab-1" }));
    state.trackTab(makeTab({ tabId: "tab-2" }));

    const all = state.getAllTrackedTabs().map((t) => t.tabId).sort();
    expect(all).toEqual(["tab-1", "tab-2"]);

    await clearTabs(state);
  });

  it("env parsing: clamps min values and falls back on NaN", async () => {
    // Min clamp: MAX_TABS=0 should clamp to 1
    const stateClamp = await importFreshState({ CAMOFOX_MAX_TABS: "0" });
    stateClamp.trackTab(makeTab({ tabId: "tab-1" }));
    try {
      stateClamp.trackTab(makeTab({ tabId: "tab-2" }));
      expect.fail("Expected MAX_TABS min clamp to enforce 1 tracked tab");
    } catch (err) {
      expectAppErrorWithCode(err, "MAX_TABS_EXCEEDED");
    }
    await clearTabs(stateClamp);

    // NaN fallback: MAX_TABS=not-a-number should use default (100)
    const stateFallback = await importFreshState({ CAMOFOX_MAX_TABS: "not-a-number" });
    for (let i = 0; i < 100; i += 1) {
      stateFallback.trackTab(makeTab({ tabId: `tab-${i}` }));
    }
    try {
      stateFallback.trackTab(makeTab({ tabId: "tab-101" }));
      expect.fail("Expected MAX_TABS default fallback to enforce 100 tracked tabs");
    } catch (err) {
      expectAppErrorWithCode(err, "MAX_TABS_EXCEEDED");
    }

    await clearTabs(stateFallback);
  });
});
