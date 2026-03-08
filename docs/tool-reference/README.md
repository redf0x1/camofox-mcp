# Tool Reference

This page is the canonical index for the tools currently registered by `camofox-mcp`.

> Note: older docs in this repo still mention 41 or 46 tools. The current source registers **46 tools across 12 categories**. This index follows the live source in `src/tools/` and `src/server.ts`.

## Overview

- Total tools: **46**
- Categories: **12**
- Primary interaction model: `create_tab` -> `navigate` or `web_search` -> `snapshot` -> interact with refs or CSS selectors
- Preferred read path: use `snapshot` first, then fall back to CSS-selector and DOM tools when refs are incomplete
- API key note: tools marked `Yes` call browser-server endpoints that require `CAMOFOX_API_KEY` when the browser server is protected

## Quick Reference

| Tool | Category | Description |
| --- | --- | --- |
| `server_status` | Health & Status | Check browser-server health, browser connection, and tracked tab count. |
| `create_tab` | Tab Management | Open a new anti-detection browser tab, optionally preconfigured with URL, user, and geo settings. |
| `close_tab` | Tab Management | Close a tracked tab and optionally auto-save its session profile. |
| `list_tabs` | Tab Management | List currently tracked tabs. |
| `navigate` | Navigation | Navigate a tab to a URL and return the resolved page state. |
| `go_back` | Navigation | Move backward in browser history and refresh refs metadata. |
| `go_forward` | Navigation | Move forward in browser history and refresh refs metadata. |
| `refresh` | Navigation | Reload the current page. |
| `click` | Interaction | Click an element by ref or CSS selector. |
| `type_text` | Interaction | Replace text in an input or editable target by ref or selector. |
| `scroll` | Interaction | Scroll the page vertically. |
| `camofox_scroll_element` | Interaction | Scroll a specific container element. |
| `camofox_evaluate_js` | Interaction | Execute isolated JavaScript in the page context. |
| `camofox_hover` | Interaction | Hover an element to trigger menus, tooltips, or hover state. |
| `camofox_wait_for` | Interaction | Wait for readiness, hydration, and optional network idle. |
| `camofox_press_key` | Interaction | Press a keyboard key such as `Enter`, `Tab`, or `Escape`. |
| `snapshot` | Observation | Read the accessibility snapshot, refs, and truncation metadata. |
| `camofox_get_page_html` | Observation | Return rendered page HTML or a selected element's outer HTML. |
| `camofox_query_selector` | Observation | Inspect a CSS selector and optionally read a specific attribute. |
| `screenshot` | Observation | Capture a base64 PNG screenshot. |
| `get_links` | Observation | Extract links from the page or a scoped container. |
| `youtube_transcript` | Observation | Fetch a YouTube transcript without opening a tab. |
| `camofox_wait_for_text` | Observation | Wait until specific text appears. |
| `camofox_wait_for_selector` | Observation | Wait until a CSS selector appears in the live DOM. |
| `web_search` | Search & Discovery | Run a search through one of 14 built-in engines. |
| `import_cookies` | Session Management | Import cookies into a user session or tab. |
| `get_stats` | Session Management | Return local tab stats plus browser-server session stats. |
| `camofox_close_session` | Session Management | Close all tabs for the current user session. |
| `toggle_display` | Session Management | Switch a user session between headless, headed, and virtual display modes. |
| `save_profile` | Profiles | Save the current tab's cookies to a named disk profile. |
| `load_profile` | Profiles | Load a named cookie profile into an active tab. |
| `list_profiles` | Profiles | List stored profiles and metadata. |
| `delete_profile` | Profiles | Delete a saved profile. |
| `list_downloads` | Downloads | List downloads with filters for status, file type, and size. |
| `get_download` | Downloads | Return download metadata and optionally inline file content. |
| `delete_download` | Downloads | Delete a downloaded file and registry entry. |
| `extract_resources` | Content Extraction | Extract images, links, media, and documents from a container. |
| `batch_download` | Content Extraction | Extract and download matching resources in one operation. |
| `resolve_blobs` | Content Extraction | Convert `blob:` URLs into downloadable data. |
| `fill_form` | Batch Operations | Fill multiple fields and optionally submit the form. |
| `type_and_submit` | Batch Operations | Type once and press a key, usually `Enter`. |
| `navigate_and_snapshot` | Batch Operations | Navigate, wait, and return a snapshot in one call. |
| `scroll_and_snapshot` | Batch Operations | Scroll and return a new snapshot. |
| `camofox_scroll_element_and_snapshot` | Batch Operations | Scroll a container and return a new snapshot. |
| `batch_click` | Batch Operations | Click multiple targets sequentially and report per-click results. |
| `list_presets` | Presets | List server-supported geo presets. |

## Health & Status

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `server_status` | Verify that CamoFox Browser is reachable and report current server state. | None. | `ok`, `running`, `browserConnected`, `version`, `consecutiveFailures`, `activeOps`, `activeTabCount`. | No | `server_status({})` |

## Tab Management

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `create_tab` | Open a new anti-detection tab and start tracking it in MCP state. | `url?: string (URL)`; `userId?: string`; `preset?: string`; `locale?: string`; `timezoneId?: string`; `geolocation?: { latitude: number, longitude: number }`; `viewport?: { width: int, height: int }`. | `tabId`, `url`, `userId`, `sessionKey`, `preset`, `autoLoaded`. | No | `create_tab({ url: "https://example.com", preset: "us-east" })` |
| `close_tab` | Close a tracked tab and remove it from local state. | `tabId: string`. | `success`, `tabId`, `autoSaved`, `autoSaveFailure?`. | No | `close_tab({ tabId: "tab_123" })` |
| `list_tabs` | Show all tracked tabs known to MCP. | None. | Array of tracked tab records including `tabId`, `url`, `userId`, timestamps, counters, and session metadata. | No | `list_tabs({})` |

## Navigation

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `navigate` | Navigate a tab to a URL and update tracked tab metadata. | `tabId: string`; `url: string (URL)`. | `url`, `title`, `refsAvailable`. | No | `navigate({ tabId: "tab_123", url: "https://react.dev" })` |
| `go_back` | Go back in browser history and refresh snapshot metadata. | `tabId: string`. | `url`, `title`, `refsAvailable`. | No | `go_back({ tabId: "tab_123" })` |
| `go_forward` | Go forward in browser history and refresh snapshot metadata. | `tabId: string`. | `url`, `title`, `refsAvailable`. | No | `go_forward({ tabId: "tab_123" })` |
| `refresh` | Reload the current page. | `tabId: string`. | `success`, `url`, `title`, `refsAvailable`. | No | `refresh({ tabId: "tab_123" })` |

## Interaction

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `click` | Click an element using a snapshot ref or CSS selector. | `tabId: string`; `ref?: string`; `selector?: string`. One of `ref` or `selector` is required. | `success`, `navigated`, `refsAvailable`. | No | `click({ tabId: "tab_123", ref: "e8" })` |
| `type_text` | Replace text in an input, textarea, or editable element. | `tabId: string`; `ref?: string`; `selector?: string`; `text: string`. One of `ref` or `selector` is required. | `success`. | No | `type_text({ tabId: "tab_123", selector: "input[name=q]", text: "camofox" })` |
| `scroll` | Scroll the page by a pixel amount. | `tabId: string`; `direction: "up" | "down"`; `amount?: int` default `500`. | `success`. | No | `scroll({ tabId: "tab_123", direction: "down", amount: 900 })` |
| `camofox_scroll_element` | Scroll a container such as a modal, drawer, or overflow div. | `tabId: string`; `selector?: string`; `ref?: string`; `deltaY?: number` default `300`; `deltaX?: number` default `0`. One of `ref` or `selector` is required. | `ok`, `scrollPosition { scrollTop, scrollLeft, scrollHeight, clientHeight, scrollWidth, clientWidth }`. | No | `camofox_scroll_element({ tabId: "tab_123", selector: "[role=dialog]", deltaY: 400 })` |
| `camofox_evaluate_js` | Execute isolated JavaScript inside the page context for advanced inspection or extraction. | `tabId: string`; `expression: string`; `timeout?: int` default `5000`, max `30000`. | On success: `ok: true`, `result`, `resultType`, `truncated?`. On handled failure: `ok: false`, `error`, `errorType`. | Yes | `camofox_evaluate_js({ tabId: "tab_123", expression: "document.title" })` |
| `camofox_hover` | Hover a target to reveal menus, tooltips, or hover-only UI. | `tabId: string`; `ref?: string`; `selector?: string`. One of `ref` or `selector` is required. | `message`. | No | `camofox_hover({ tabId: "tab_123", ref: "e12" })` |
| `camofox_wait_for` | Wait for DOM readiness, hydration, and optionally network idle. | `tabId: string`; `timeout?: number` default `10000`; `waitForNetwork?: boolean` default `true`. | `message`, `ready`. | No | `camofox_wait_for({ tabId: "tab_123", timeout: 15000 })` |
| `camofox_press_key` | Press a keyboard key in the active tab. | `tabId: string`; `key: string`. | `success`. | No | `camofox_press_key({ tabId: "tab_123", key: "Enter" })` |

## Observation

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `snapshot` | Read the accessibility-tree snapshot, including refs and pagination metadata for long pages. | `tabId: string`; `offset?: number`. | `url`, `snapshot`, `refsCount`, and when truncated: `truncated`, `totalChars`, `hasMore`, `nextOffset`, `truncationInfo`. | No | `snapshot({ tabId: "tab_123" })` |
| `camofox_get_page_html` | Get rendered HTML from the live DOM, optionally scoped to one selector. | `tabId: string`; `selector?: string`. | `html`. | Yes | `camofox_get_page_html({ tabId: "tab_123", selector: "main" })` |
| `camofox_query_selector` | Inspect a selector and optionally return a specific attribute instead of the full element payload. | `tabId: string`; `selector: string`; `attribute?: string`. | If found without `attribute`: `exists`, `text`, `html`, `tag`, `attributes`. If `attribute` is set: `exists`, `attribute`, `value`. If missing: `exists: false`. | Yes | `camofox_query_selector({ tabId: "tab_123", selector: "a.download", attribute: "href" })` |
| `screenshot` | Capture a visual screenshot when layout proof matters more than token efficiency. | `tabId: string`. | Base64 PNG image result. | No | `screenshot({ tabId: "tab_123" })` |
| `get_links` | Extract links from the page or a selected container. | `tabId: string`; `scope?: string`; `extension?: string` comma-separated; `downloadOnly?: boolean`. | Array of link records with fields such as `text`, `href`, and any server-supplied metadata. | No | `get_links({ tabId: "tab_123", extension: "pdf,zip" })` |
| `youtube_transcript` | Fetch a transcript for a YouTube video without managing a tab. | `url: string`; `languages?: string[]` default browser-server behavior, commonly `['en']`. | Provider payload including `status`, `video_id`, `video_title?`, `transcript?`, `language?`, `total_words?`, `available_languages?`, `message?`, `code?`. | No | `youtube_transcript({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", languages: ["en"] })` |
| `camofox_wait_for_text` | Wait until a specific text string appears on the page. | `tabId: string`; `text: string`; `timeout?: number` default `10000`. | `message`. | No | `camofox_wait_for_text({ tabId: "tab_123", text: "Results" })` |
| `camofox_wait_for_selector` | Wait until a CSS selector appears in the live DOM. | `tabId: string`; `selector: string`; `timeout?: int` default `10000`. | `success`, `message`. | Yes | `camofox_wait_for_selector({ tabId: "tab_123", selector: ".search-results" })` |

## Search & Discovery

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `web_search` | Run a search via a built-in macro and immediately return the resulting page snapshot. | `tabId: string`; `query: string`; `engine?: "google" | "youtube" | "amazon" | "bing" | "duckduckgo" | "reddit" | "github" | "stackoverflow" | "wikipedia" | "twitter" | "linkedin" | "facebook" | "instagram" | "tiktok"` default `google`. | `url`, `snapshot`. | No | `web_search({ tabId: "tab_123", query: "camoufox github", engine: "google" })` |

## Session Management

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `import_cookies` | Import a JSON cookie array into a user session and optionally target a specific tab. | `userId: string`; `cookies: string` containing a JSON array; `tabId?: string`. | `success`. | Yes | `import_cookies({ userId: "demo", cookies: "[{\"name\":\"sid\",\"value\":\"...\"}]" })` |
| `get_stats` | Return tracked tab counters plus browser-server stats. | `tabId: string`. | `visitedUrls`, `toolCalls`, `refsCount`, `sessionKey`, `remote`. | No | `get_stats({ tabId: "tab_123" })` |
| `camofox_close_session` | Close every tracked tab for the current user session. | `tabId: string` from any tab in the session. | `message`, `autoSaved`. | No | `camofox_close_session({ tabId: "tab_123" })` |
| `toggle_display` | Switch a session between headless, headed, and virtual-display mode. Existing tracked tabs are invalidated. | `userId: string`; `headless: boolean | "virtual"`. | Browser-server payload including `ok`, `headless`, `message`, `userId`, `vncUrl?`. | No | `toggle_display({ userId: "demo", headless: "virtual" })` |

## Profiles

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `save_profile` | Export the current tab's cookies and save them to disk. | `tabId: string`; `profileId: string`; `description?: string`. | `profileId`, `cookieCount`, `savedAt`, `path`. | No | `save_profile({ tabId: "tab_123", profileId: "github-main" })` |
| `load_profile` | Load saved cookies into an active tab and warn on user mismatch. | `profileId: string`; `tabId: string`. | `profileId`, `cookieCount`, `lastSaved`, `description`, `warning?`. | Yes | `load_profile({ profileId: "github-main", tabId: "tab_123" })` |
| `list_profiles` | List saved profiles on disk. | None. | `profilesDir`, `count`, `profiles`. | No | `list_profiles({})` |
| `delete_profile` | Remove a saved profile from disk. | `profileId: string`. | `deleted`. | No | `delete_profile({ profileId: "github-main" })` |

## Downloads

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `list_downloads` | List downloads globally or for a specific tab, with filtering and pagination. | `tabId?: string`; `userId?: string`; `status?: string`; `extension?: string`; `mimeType?: string`; `minSize?: int`; `maxSize?: int`; `sort?: "createdAt:asc" | "createdAt:desc"` default descending behavior; `limit?: int` default `50`; `offset?: int` default `0`. | Browser-server download listing payload, typically including `downloads`, `count`, and pagination metadata. | No | `list_downloads({ userId: "demo", extension: "pdf", limit: 20 })` |
| `get_download` | Return metadata for a download and optionally inline its content. Images are rendered as image output when small enough. | `downloadId: string`; `includeContent?: boolean` default `false`; `userId?: string`. | Metadata record, or metadata plus base64 `content`, or text-plus-image content for images. Large files return metadata with a `note`. | No | `get_download({ downloadId: "dl_123", includeContent: true })` |
| `delete_download` | Delete a download from disk and the registry. | `downloadId: string`; `userId?: string`. | Browser-server delete result. | No | `delete_download({ downloadId: "dl_123" })` |

## Content Extraction

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `extract_resources` | Extract images, links, media, or documents from a DOM container. | `tabId: string`; `userId?: string`; `selector?: string`; `ref?: string`; `types?: ("images" | "links" | "media" | "documents" | "image" | "link" | "document")[]`; `extensions?: string[]`; `resolveBlobs?: boolean` default `false`; `triggerLazyLoad?: boolean` default `false`; `maxDepth?: int` default `5`. One of `selector` or `ref` is required. | Extraction payload from the browser server, typically resource lists plus counts and status data. | No | `extract_resources({ tabId: "tab_123", selector: ".gallery", types: ["images"] })` |
| `batch_download` | Extract matching resources and download them immediately. | `tabId: string`; `userId?: string`; `selector?: string`; `ref?: string`; `types?: same enum array`; `extensions?: string[]`; `resolveBlobs?: boolean` default `true`; `concurrency?: int` default `5`; `maxFiles?: int` default `50`. One of `selector` or `ref` is required. | Batch download payload from the browser server, typically including queued, completed, failed, and download IDs. | No | `batch_download({ tabId: "tab_123", ref: "e21", types: ["documents"], extensions: ["pdf"] })` |
| `resolve_blobs` | Resolve one or more `blob:` URLs to downloadable data URLs. | `tabId: string`; `userId?: string`; `urls: string[]` minimum length `1`. | Blob-resolution payload with resolved URLs and failure information when applicable. | No | `resolve_blobs({ tabId: "tab_123", urls: ["blob:https://site/..."] })` |

## Batch Operations

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `fill_form` | Fill multiple fields sequentially and optionally click a submit button. Stops at the first failed field. | `tabId: string`; `fields: { ref?: string, selector?: string, text: string }[]` min `1`, max `20`; `submit?: { ref?: string, selector?: string }`. Each field and submit target requires `ref` or `selector`. | JSON result with `success`, `filled`, `total`, `results`, `submitted?`. | No | `fill_form({ tabId: "tab_123", fields: [{ selector: "#email", text: "me@example.com" }] })` |
| `type_and_submit` | Type into a field and press a key, usually for search boxes or single-field forms. | `tabId: string`; `ref?: string`; `selector?: string`; `text: string`; `key?: string` default `Enter`. One of `ref` or `selector` is required. | `typed`, `keyPressed`. | No | `type_and_submit({ tabId: "tab_123", selector: "input[name=q]", text: "camofox", key: "Enter" })` |
| `navigate_and_snapshot` | Navigate, wait for readiness, optionally wait for text, then return a snapshot. | `tabId: string`; `url: string (URL)`; `waitForText?: string`; `timeout?: number` default `10000`. | `url`, `title`, `snapshot`, `refsCount`. | No | `navigate_and_snapshot({ tabId: "tab_123", url: "https://example.com", timeout: 12000 })` |
| `scroll_and_snapshot` | Scroll the page and then capture a fresh snapshot. | `tabId: string`; `direction: "up" | "down"`; `amount?: number` default `500`; `waitMs?: number` default `500`. | `scrolled`, `snapshot`, `refsCount`. | No | `scroll_and_snapshot({ tabId: "tab_123", direction: "down", amount: 700 })` |
| `camofox_scroll_element_and_snapshot` | Scroll a container element and then capture a page snapshot. | `tabId: string`; `selector?: string`; `ref?: string`; `deltaY?: number` default `300`; `waitMs?: number` default `500`. One of `ref` or `selector` is required. | `ok`, `scrollPosition`, `snapshot`, `refsCount`. | No | `camofox_scroll_element_and_snapshot({ tabId: "tab_123", selector: ".comments-pane", deltaY: 500 })` |
| `batch_click` | Click multiple targets in order and keep going when one click fails. | `tabId: string`; `clicks: { ref?: string, selector?: string, description?: string }[]` min `1`, max `10`; `delayMs?: number` default `200`. | JSON result with `success`, `clicked`, `total`, `results`. Partial failure sets the MCP error flag but still returns per-click results. | No | `batch_click({ tabId: "tab_123", clicks: [{ ref: "e3" }, { selector: ".confirm" }] })` |

## Presets

| Name | Description | Parameters | Returns | Requires API Key | Example |
| --- | --- | --- | --- | --- | --- |
| `list_presets` | List available geo presets from the browser server. | None. | `count`, `presets[]`, where each preset includes `name`, `locale`, `timezoneId`, and optional `geolocation`. | No | `list_presets({})` |

## Practical Patterns

### Snapshot-first interaction

1. `create_tab`
2. `navigate` or `web_search`
3. `snapshot`
4. `click` or `type_text` with `ref`
5. Fall back to `selector` when refs are incomplete

### CSS-selector fallback for dynamic sites

1. `camofox_wait_for_selector`
2. `camofox_query_selector` or `camofox_get_page_html`
3. `type_text` or `click` with `selector`
4. `snapshot` again after the page stabilizes

### Download-heavy workflow

1. `extract_resources`
2. `batch_download`
3. `list_downloads`
4. `get_download`
