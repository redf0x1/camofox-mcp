import { randomUUID } from "node:crypto";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { networkCaptureOptions } from "../network.js";
import { okResult, toErrorResult } from "../errors.js";
import { loadProfile, saveProfile, withAutoTimeout } from "../profiles.js";
import { getTrackedTab, listTrackedTabs, removeTrackedTab, trackTab } from "../state.js";
import type { ToolDeps } from "../server.js";
import type { TabInfo } from "../types.js";
import {
  VIEWPORT_HEIGHT_MAX,
  VIEWPORT_HEIGHT_MIN,
  VIEWPORT_WIDTH_MAX,
  VIEWPORT_WIDTH_MIN
} from "../viewport.js";

const AUTO_PROFILE_TIMEOUT_MS = 5_000;

const rawProxySchema = z
  .object({
    host: z.string().min(1),
    port: z.union([z.string().min(1), z.number().int().positive()]).transform(String),
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional()
  })
  .describe("Raw proxy override. proxyProfile takes precedence when both are provided.");

const geoModeSchema = z.enum(["explicit-wins", "proxy-locked"]).describe(
  "Geo merge mode. explicit-wins keeps explicit locale/timezone/geolocation; proxy-locked requires proxy/profile geo values."
);

export function registerTabsTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "create_tab",
    "Create a new browser tab with anti-detection fingerprinting. Each tab gets a unique fingerprint. Optionally provide a URL, userId, sessionKey, and viewport. To share the camofox CLI default browser profile/context, pass userId \"cli-default\" and sessionKey \"default\"; this creates a tracked MCP tab in that context but does not attach to a CLI tab that is already open.",
    {
      url: z.string().url().optional().describe("Full URL including protocol (e.g. 'https://example.com')"),
      userId: z.string().min(1).optional().describe('User ID for session isolation. MCP defaults to CAMOFOX_DEFAULT_USER_ID/default; use "cli-default" with sessionKey "default" to share the camofox CLI default context.'),
      sessionKey: z.string().min(1).optional().describe('Session key for browser context reuse. Defaults to a new unique session; use "default" with userId "cli-default" for the camofox CLI default context. This does not attach to a tab that the CLI already opened.'),
      preset: z.string().optional().describe(
        'Named geo preset (e.g. "us-east", "us-west", "japan", "uk", "germany", "vietnam", "singapore", "australia"). Sets locale, timezone, and geolocation.'
      ),
      locale: z.string().optional().describe('BCP 47 locale override (e.g. "ja-JP", "vi-VN")'),
      timezoneId: z.string().optional().describe('IANA timezone override (e.g. "Asia/Tokyo", "Asia/Ho_Chi_Minh")'),
      geolocation: z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180)
        })
        .optional()
        .describe("GPS coordinates override"),
      viewport: z
        .object({
          width: z.number().int().min(VIEWPORT_WIDTH_MIN).max(VIEWPORT_WIDTH_MAX),
          height: z.number().int().min(VIEWPORT_HEIGHT_MIN).max(VIEWPORT_HEIGHT_MAX)
        })
        .optional()
        .describe('Browser viewport/display size override. Use this to control wide windows, for example { "width": 1366, "height": 768 }.'),
      proxyProfile: z.string().min(1).optional().describe("Named proxy profile configured in camofox-browser"),
      proxy: rawProxySchema.optional(),
      geoMode: geoModeSchema.optional(),
      networkCapture: networkCaptureOptions.optional()
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            url: z.string().url().optional().describe("Full URL including protocol (e.g. 'https://example.com')"),
            userId: z.string().min(1).optional().describe('User ID for session isolation. MCP defaults to CAMOFOX_DEFAULT_USER_ID/default; use "cli-default" with sessionKey "default" to share the camofox CLI default context.'),
            sessionKey: z.string().min(1).optional().describe('Session key for browser context reuse. Defaults to a new unique session; use "default" with userId "cli-default" for the camofox CLI default context. This does not attach to a tab that the CLI already opened.'),
            preset: z.string().optional().describe(
              'Named geo preset (e.g. "us-east", "us-west", "japan", "uk", "germany", "vietnam", "singapore", "australia"). Sets locale, timezone, and geolocation.'
            ),
            locale: z.string().optional().describe('BCP 47 locale override (e.g. "ja-JP", "vi-VN")'),
            timezoneId: z.string().optional().describe('IANA timezone override (e.g. "Asia/Tokyo", "Asia/Ho_Chi_Minh")'),
            geolocation: z
              .object({
                latitude: z.number().min(-90).max(90),
                longitude: z.number().min(-180).max(180)
              })
              .optional()
              .describe("GPS coordinates override"),
            viewport: z
              .object({
                width: z.number().int().min(VIEWPORT_WIDTH_MIN).max(VIEWPORT_WIDTH_MAX),
                height: z.number().int().min(VIEWPORT_HEIGHT_MIN).max(VIEWPORT_HEIGHT_MAX)
              })
              .optional()
              .describe('Browser viewport/display size override. Use this to control wide windows, for example { "width": 1366, "height": 768 }.'),
            proxyProfile: z.string().min(1).optional().describe("Named proxy profile configured in camofox-browser"),
            proxy: rawProxySchema.optional(),
            geoMode: geoModeSchema.optional(),
            networkCapture: networkCaptureOptions.optional()
          })
          .parse(input);

        const userId = parsed.userId ?? deps.config.defaultUserId;
        const sessionKey = parsed.sessionKey ?? randomUUID();
        const tab = await deps.client.createTab({
          userId,
          sessionKey,
          url: parsed.url,
          preset: parsed.preset,
          locale: parsed.locale,
          timezoneId: parsed.timezoneId,
          geolocation: parsed.geolocation,
          viewport: parsed.viewport ?? deps.config.defaultViewport,
          proxyProfile: parsed.proxyProfile,
          proxy: parsed.proxy,
          geoMode: parsed.geoMode,
          ...(parsed.networkCapture ? { networkCapture: parsed.networkCapture } : {})
        });

        const tracked: TabInfo = {
          tabId: tab.tabId,
          url: tab.url,
          createdAt: new Date().toISOString(),
          lastActivity: Date.now(),
          userId,
          sessionKey,
          visitedUrls: [tab.url],
          toolCalls: 1,
          refsCount: 0
        };

        trackTab(tracked);

        // Auto-load profile if enabled
        // Note: This behavior is covered via E2E tests (requires a real server/client). Unit tests cover disk I/O + timeout helper.
        let autoLoaded = false;
        if (deps.config.autoSave) {
          const autoProfileId = `_auto_${tracked.userId}`;
          const autoLoadResult = await withAutoTimeout(
            (async () => {
              const profile = await loadProfile(deps.config.profilesDir, autoProfileId);
              if (profile.userId !== tracked.userId) {
                return false;
              }
              if (profile.cookies.length <= 0) {
                return false;
              }

              await deps.client.importCookies(tracked.userId, profile.cookies, tab.tabId);
              return true;
            })(),
            AUTO_PROFILE_TIMEOUT_MS
          );

          autoLoaded = autoLoadResult.ok && autoLoadResult.value === true;

          // If cookies were loaded and a URL was provided, re-navigate so the page applies the new cookie jar.
          if (autoLoaded && parsed.url) {
            await deps.client.navigate(tab.tabId, parsed.url, tracked.userId);
          }
        }

        return okResult({ tabId: tab.tabId, url: tab.url, userId, sessionKey, preset: parsed.preset, autoLoaded, ...(tab.networkKey ? { networkKey: tab.networkKey } : {}) });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "close_tab",
    "Close a browser tab and release resources. Always close tabs when done to free memory.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab")
    },
    async (input: unknown) => {
      try {
        const parsed = z.object({ tabId: z.string().min(1).describe("Tab ID from create_tab") }).parse(input);
        const tracked = getTrackedTab(parsed.tabId);

        let autoSaved = false;
        let autoSaveFailure: string | undefined;
        // Auto-save profile before closing (best-effort; never blocks close)
        if (deps.config.autoSave) {
          const saved = await withAutoTimeout(
            (async () => {
              const cookies = await deps.client.exportCookies(parsed.tabId, tracked.userId);
              if (cookies.length <= 0) {
                return false;
              }
              const autoProfileId = `_auto_${tracked.userId}`;
              await saveProfile(deps.config.profilesDir, autoProfileId, tracked.userId, cookies, {
                description: "Auto-saved session",
                lastUrl: tracked.url
              });
              return true;
            })(),
            AUTO_PROFILE_TIMEOUT_MS
          );
          autoSaved = saved.ok ? saved.value : false;
          if (!saved.ok) {
            autoSaveFailure =
              saved.reason === "timeout"
                ? "timeout"
                : saved.error instanceof Error
                  ? saved.error.message
                  : String(saved.error);
          }
        }

        try {
          await deps.client.closeTab(parsed.tabId, tracked.userId);
        } finally {
          removeTrackedTab(parsed.tabId);
        }
        return okResult({ success: true, tabId: parsed.tabId, autoSaved, autoSaveFailure });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool("list_tabs", "List all open browser tabs with URLs and titles. Use to discover available tabs or verify tab state.", {}, async () => {
    try {
      const tabs = listTrackedTabs();
      return okResult(tabs);
    } catch (error) {
      return toErrorResult(error);
    }
  });
}
