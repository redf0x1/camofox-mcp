import { AppError } from "./errors.js";
import type { TabInfo } from "./types.js";

const TAB_TTL_MS = parseInt(process.env.CAMOFOX_TAB_TTL_MS || '1800000', 10);    // 30min default
const MAX_TABS = parseInt(process.env.CAMOFOX_MAX_TABS || '100', 10);             // 100 tabs max
const VISITED_URLS_LIMIT = parseInt(process.env.CAMOFOX_VISITED_URLS_LIMIT || '50', 10); // 50 URLs max
const SWEEP_INTERVAL_MS = parseInt(process.env.CAMOFOX_SWEEP_INTERVAL_MS || '60000', 10); // 1min sweep

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
    const now = Date.now();
    const closers: Array<Promise<void>> = [];

    for (const [tabId, tab] of tabs.entries()) {
      if (now - tab.lastActivity > TAB_TTL_MS) {
        tabs.delete(tabId);
        closers.push(closeTab(tab.tabId, tab.userId).catch(() => undefined));
      }
    }

    if (closers.length > 0) {
      void Promise.allSettled(closers);
    }
  };

  const sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
  sweepTimer.unref();

  const handleShutdown = async () => {
    clearInterval(sweepTimer);
    const openTabs = getAllTrackedTabs();

    await Promise.allSettled(openTabs.map(async (tab) => closeTab(tab.tabId, tab.userId)));
    process.exit(0);
  };

  process.once("SIGINT", () => {
    clearInterval(sweepTimer);
    void handleShutdown();
  });

  process.once("SIGTERM", () => {
    clearInterval(sweepTimer);
    void handleShutdown();
  });
}
