import { AppError } from "./errors.js";
import type { TabInfo } from "./types.js";

function parseEnvInt(key: string, defaultVal: number, min: number): number {
  const raw = parseInt(process.env[key] || "", 10);
  return Number.isNaN(raw) ? defaultVal : Math.max(raw, min);
}

const TAB_TTL_MS = parseEnvInt("CAMOFOX_TAB_TTL_MS", 1_800_000, 0); // 30min, min 0 (0 = disabled)
const MAX_TABS = parseEnvInt("CAMOFOX_MAX_TABS", 100, 1); // 100, min 1
const VISITED_URLS_LIMIT = parseEnvInt("CAMOFOX_VISITED_URLS_LIMIT", 50, 1); // 50, min 1
const SWEEP_INTERVAL_MS = parseEnvInt("CAMOFOX_SWEEP_INTERVAL_MS", 60_000, 1_000); // 1min, min 1s

const CLOSE_TAB_TIMEOUT_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
  ]);

const tabs = new Map<string, TabInfo>();

export function trackTab(tab: TabInfo): void {
  if (tabs.size >= MAX_TABS) {
    throw new AppError(
      "MAX_TABS_EXCEEDED",
      `Maximum tracked tabs exceeded (${MAX_TABS}). Close existing tabs or increase CAMOFOX_MAX_TABS.`
    );
  }

  tabs.set(tab.tabId, { ...tab, lastActivity: Date.now() });
}

export function removeTrackedTab(tabId: string): void {
  tabs.delete(tabId);
}

export function getTrackedTab(tabId: string): TabInfo {
  const tab = tabs.get(tabId);
  if (!tab) {
    throw new AppError("TAB_NOT_FOUND", `Tab '${tabId}' is not tracked. Create or list tabs first.`);
  }
  tab.lastActivity = Date.now();
  return tab;
}

export function listTrackedTabs(): Array<Pick<TabInfo, "tabId" | "url" | "createdAt">> {
  return Array.from(tabs.values()).map((tab) => ({
    tabId: tab.tabId,
    url: tab.url,
    createdAt: tab.createdAt
  }));
}

export function getAllTrackedTabs(): TabInfo[] {
  return Array.from(tabs.values());
}

export function clearTrackedTabsByUserId(userId: string): void {
  for (const [tabId, tracked] of tabs.entries()) {
    if (tracked.userId === userId) {
      tabs.delete(tabId);
    }
  }
}

export function incrementToolCall(tabId: string): void {
  const tab = getTrackedTab(tabId);
  tab.toolCalls += 1;
}

export function updateTabUrl(tabId: string, url: string): void {
  const tab = getTrackedTab(tabId);
  tab.url = url;
  if (!tab.visitedUrls.includes(url)) {
    tab.visitedUrls.push(url);
  }

  if (tab.visitedUrls.length > VISITED_URLS_LIMIT) {
    tab.visitedUrls = tab.visitedUrls.slice(-VISITED_URLS_LIMIT);
  }
}

export function updateRefsCount(tabId: string, refsCount: number): void {
  const tab = getTrackedTab(tabId);
  tab.refsCount = refsCount;
}

export function setupCleanup(closeTab: (tabId: string, userId: string) => Promise<void>): void {
  const sweep = () => {
    if (TAB_TTL_MS <= 0) {
      return;
    }

    const now = Date.now();
    const closers: Array<Promise<unknown>> = [];

    for (const [tabId, tab] of tabs.entries()) {
      if (now - tab.lastActivity > TAB_TTL_MS) {
        tabs.delete(tabId);
        closers.push(
          withTimeout(closeTab(tab.tabId, tab.userId), CLOSE_TAB_TIMEOUT_MS).catch(() => undefined)
        );
      }
    }

    if (closers.length > 0) {
      void Promise.allSettled(closers);
    }
  };

  let sweepTimer: NodeJS.Timeout | undefined;
  if (TAB_TTL_MS > 0 && SWEEP_INTERVAL_MS > 0) {
    sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
    sweepTimer.unref();
  }

  const handleShutdown = async () => {
    if (sweepTimer) {
      clearInterval(sweepTimer);
    }

    const shutdownPromise = Promise.allSettled(
      Array.from(tabs.entries()).map(async ([tabId, tab]) => {
        tabs.delete(tabId);
        await withTimeout(closeTab(tabId, tab.userId), CLOSE_TAB_TIMEOUT_MS).catch(() => undefined);
      })
    );

    await Promise.race([
      shutdownPromise,
      new Promise((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS))
    ]);
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void handleShutdown();
  });

  process.once("SIGTERM", () => {
    void handleShutdown();
  });
}
