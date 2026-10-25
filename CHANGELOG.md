# Changelog

## [1.15.0] - 2026-08-13

### Added
- Added `screenshot.fullPage` support, forwarding the documented `fullPage=true` query parameter from the MCP tool through the existing browser screenshot route.

### Fixed
- Aligned `web_search` with the 14 macros actually supported by `camofox-browser`: Google, YouTube, Amazon, Reddit search/subreddit, Wikipedia, Twitter/X, Yelp, Spotify, Netflix, LinkedIn, Instagram, TikTok, and Twitch. The previously advertised Bing, DuckDuckGo, GitHub, Stack Overflow, and Facebook values never had matching browser macros and now fail MCP input validation instead of reaching the browser as invalid macro requests.
- Clarified that evaluate/DOM helpers require `CAMOFOX_API_KEY` only when browser-server authentication is enabled.

### Compatibility
- Recommend `camofox-browser` `2.4.7` or newer, including the official Windows x64 headless portable distribution. Browser lifecycle recovery, `process.execPath`, and session-generation hardening remain browser-internal and require no parallel MCP lifecycle implementation.
- Documented the Windows x64 display contract: `headless=true` is supported; headed and virtual-display modes remain unsupported on Windows.

### Security
- Refreshed the runtime lockfile within existing dependency ranges to clear all moderate/high/critical `npm audit --omit=dev --audit-level=moderate` findings. One low-severity transitive `body-parser` advisory remains outside that release gate.

## [1.14.5] - 2026-06-17

### Compatibility
- Recommend `camofox-browser` `2.4.6` or newer so MCP users avoid fresh-install first-tab crashes from incompatible Playwright protocol dependency resolution. CamoFox MCP itself remains an HTTP client and does not depend on `playwright-core`.

## [1.14.4] - 2026-05-25

### Compatibility
- Documented `camofox-browser` `2.4.5` browser auth modes, including the trusted private-network `CAMOFOX_AUTH_MODE=disabled` setup where CamoFox MCP must leave `CAMOFOX_API_KEY` unset.

### Changed
- Clarified outbound browser authentication (`CAMOFOX_API_KEY`) versus inbound HTTP MCP authentication (`CAMOFOX_HTTP_API_KEY`) across package-facing docs.

## [1.14.3] - 2026-05-24

### Added
- Added `CAMOFOX_VIEWPORT` / `--viewport` as a bounded default viewport for new tabs when `create_tab.viewport` is omitted.

### Fixed
- Ignored out-of-range configured default viewports instead of forwarding values outside the `create_tab` schema bounds.
- Ignored non-positive numeric environment values for timeout, HTTP port, and HTTP rate limit, matching CLI validation behavior.
- Treated `CAMOFOX_AUTO_SAVE=n` as false, matching CLI boolean parsing.

## [1.14.2] - 2026-05-23

### Compatibility
- Recommend `camofox-browser` `2.4.4` or newer. Browser `2.4.4` fixes the persistent-context cold-start `about:blank` page reuse path, preventing a second window when opening the first tab through CLI or MCP.

### Changed
- Clarified `create_tab` guidance for sharing the camofox CLI default browser context with `userId: "cli-default"` and `sessionKey: "default"`.
- Clarified that MCP can create a tracked tab in that shared context but cannot reliably attach to a tab that the CLI already opened.
- Documented viewport/display-size control for wide headed windows, including `{ "width": 1366, "height": 768 }`.

### Security
- Updated the transitive runtime `qs` lockfile entry to `6.15.2` so `npm audit --audit-level=moderate` reports zero vulnerabilities.

## [1.14.1] - 2026-05-13

### Compatibility
- Pair with `camofox-browser` `2.4.3` or newer for session-level `proxyProfile`/raw `proxy` egress, because `2.4.3` applies the resolved session proxy to browser context launch.

### Changed
- Public server metadata and skill docs now point to `camofox-mcp` `1.14.1`, superseding the pushed-but-unpublished `1.14.0` release tag.

## [1.14.0] - 2026-05-13

### Added
- `extract_structured` tool for camofox-browser structured extraction schemas.
- `create_tab` support for browser session `proxyProfile`, raw `proxy`, `geoMode`, and optional `sessionKey` reuse.
- HTTP auth boundary regression coverage to verify unauthenticated `/mcp` requests are rejected before MCP tool-server creation.

### Compatibility
- Superseded before npm/GitHub release by `1.14.1`, which pairs this MCP surface with `camofox-browser` `2.4.3` for browser-side proxy launch wiring.

### Changed
- Public server metadata and skill docs now reflect 47 registered tools.

### Security
- Refreshed dev dependency lockfile entries so full `npm audit` reports zero vulnerabilities.

## [1.13.2] - 2026-05-12

### Added
- `CAMOFOX_HTTP_API_KEY` for inbound HTTP MCP Bearer authentication.
- `CAMOFOX_HTTP_ALLOWED_HOSTS` / `--http-allowed-hosts` for HTTP Host header allowlisting.
- Private vulnerability reporting policy in `SECURITY.md`.

### Fixed
- HTTP transport now fails startup when bound beyond loopback without an inbound HTTP API key.
- HTTP Bearer authentication now runs before `/mcp` JSON body parsing, reducing unauthenticated request handling surface.
- `server_status` now distinguishes browser-server reachability from an active browser session.
- Docker HTTP transport examples now use the image's `8080` container port and bind HTTP transport to `0.0.0.0` with inbound Bearer authentication.
- Public server metadata now reflects the current release and 46 registered tools.

### Security
- Updated MCP SDK and HTTP rate-limit dependencies, plus transitive runtime packages, so `npm audit --omit=dev` reports zero vulnerabilities.

## [1.13.1] - 2026-03-08

### Added
- `camofox_get_page_html` tool — retrieves live rendered DOM HTML with optional CSS selector scoping
- `camofox_wait_for_selector` tool — poll-based CSS selector wait for SPA dynamic content
- `camofox_query_selector` tool — purpose-built DOM element querying (text, HTML, attributes)
- `smartTypeText()` — hybrid text entry: keystrokes for short text, evaluate fallback for long text
- `CAMOFOX_LONG_TEXT_THRESHOLD` environment variable for configurable typing threshold

### Fixed
- Text input no longer has any character length limitations
- ContentEditable elements use `document.execCommand('insertText')` for rich text compatibility
- Ref-only long text now returns an actionable error message instead of silent failure

### Changed
- Updated `type_text` and batch `type` actions to use hybrid text entry
- Updated `camofox_snapshot` description to clarify accessibility tree limitations and recommend CSS selectors for SPAs
- Updated README documentation with new tools and long-text behavior

## [1.13.0] — 2025-07-15

### Added
- **VNC URL in toggle_display response** — When switching to virtual/headed mode, response includes `vncUrl` for browser viewing

## [1.12.0] — 2026-02-27

### Added
- **`toggle_display` tool** — Switch browser between headless and headed mode via MCP. Enables solving CAPTCHAs by temporarily showing the browser window, then switching back to headless

## [1.11.2] — 2026-02-27

### Fixed
- **Snapshot parsing on non-truncated pages** — `nextOffset` Zod schema now accepts `null` (returned by server for non-truncated pages), fixing snapshot/back/forward failures on small pages

## [1.11.1] — 2026-02-27

### Fixed
- Restore `camofox-mcp-http` binary entry accidentally removed in v1.11.0

## [1.11.0] — 2026-02-27

### Added
- `youtube_transcript` tool — extract transcripts from YouTube videos with language selection
- Snapshot pagination: `offset` parameter with truncation metadata (`truncated`, `totalChars`, `hasMore`, `nextOffset`)
- `refsAvailable` field in `navigate`, `click`, `go_back`, `go_forward`, `refresh` responses
- Health monitoring: `consecutiveFailures` and `activeOps` fields in `server_status` tool

### Changed
- Navigation tools (`go_back`, `go_forward`, `refresh`) now return structured JSON with `refsAvailable`
- Client schemas updated for new response fields (backward-compatible, all new fields optional)
- Snapshot tool displays truncation info and pagination guidance when pages are large

## [1.10.0] — 2026-02-25

### Added
- HTTP transport support for OpenClaw integration

## [1.9.1] — 2026-02-20
### Improved
- Download tool descriptions updated: `list_downloads` mentions `contentUrl`, `get_download` recommends `includeContent: true`

## [1.9.0] - 2026-02-20

### Added
- 6 new MCP tools: `list_downloads`, `get_download`, `delete_download`, `extract_resources`, `batch_download`, `resolve_blobs`
- Enhanced `get_links` tool with scope, extension, and downloadOnly parameters
- Binary content handling with MCP imageResult for images
- Safe image size guard (10MB limit, status verification)
- Input validation: sort enum constraint, minSize<=maxSize refinement
- 8 new REST client methods for download/extraction endpoints
- `binaryResult()` helper for MCP image content
- Comprehensive unit tests for all new tools and helpers
