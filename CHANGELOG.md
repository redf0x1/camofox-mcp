# Changelog

## [1.9.1] — 2026-02-20
### Improved
- Download tool descriptions updated: `list_downloads` mentions `contentUrl`, `get_download` recommends `includeContent: true`

## [1.9.0] - 2025-02-20

### Added
- 6 new MCP tools: `list_downloads`, `get_download`, `delete_download`, `extract_resources`, `batch_download`, `resolve_blobs`
- Enhanced `get_links` tool with scope, extension, and downloadOnly parameters
- Binary content handling with MCP imageResult for images
- Safe image size guard (10MB limit, status verification)
- Input validation: sort enum constraint, minSize<=maxSize refinement
- 8 new REST client methods for download/extraction endpoints
- `binaryResult()` helper for MCP image content
- Comprehensive unit tests for all new tools and helpers