# Changelog

## [1.10.0] - 2026-02-25

### Added
- **HTTP Transport**: Streamable HTTP support for OpenClaw and remote MCP clients
	- New `--transport http` mode alongside existing stdio
	- Per-request stateless McpServer pattern
	- Rate limiting (configurable, default 60 req/min)
	- DNS rebinding protection via MCP SDK
	- Graceful shutdown with in-flight request handling
- **OpenClaw Integration Guide**: Comprehensive docs at `docs/openclaw.md`
- **New config options**: `CAMOFOX_TRANSPORT`, `CAMOFOX_HTTP_PORT`, `CAMOFOX_HTTP_HOST`, `CAMOFOX_HTTP_RATE_LIMIT`
- **New binary**: `camofox-mcp-http` for direct HTTP mode startup

### Fixed
- Config test assertions updated for extensibility (`.toMatchObject()`)
- `express-rate-limit` declared as direct dependency
- Tool count corrected to 41 in documentation

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