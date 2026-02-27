# Changelog

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
