import { AppError } from "./errors.js";
import type { TabInfo } from "./types.js";

const tabs = new Map<string, TabInfo>();

export function trackTab(tab: TabInfo): void {
  tabs.set(tab.tabId, tab);
}

export function removeTrackedTab(tabId: string): void {
  tabs.delete(tabId);
}

export function getTrackedTab(tabId: string): TabInfo {
  const tab = tabs.get(tabId);
  if (!tab) {
    throw new AppError("TAB_NOT_FOUND", `Tab '${tabId}' is not tracked. Create or list tabs first.`);
  }
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
}

export function updateRefsCount(tabId: string, refsCount: number): void {
  const tab = getTrackedTab(tabId);
  tab.refsCount = refsCount;
}

export function setupCleanup(closeTab: (tabId: string, userId: string) => Promise<void>): void {
  const handleShutdown = async () => {
    const openTabs = getAllTrackedTabs();

    await Promise.allSettled(openTabs.map(async (tab) => closeTab(tab.tabId, tab.userId)));
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void handleShutdown();
  });

  process.once("SIGTERM", () => {
    void handleShutdown();
  });
}
