# CamoFox MCP Documentation

This documentation set is organized to get a new MCP client working quickly, then move into workflow guidance and reference material. The root [../README.md](../README.md) stays intentionally short; this directory is the canonical place for setup and deeper usage docs.

## Getting Started

- [Getting Started](getting-started.md) for prerequisites, installation methods, client configuration, verification, and first browser actions.

## Guides

- [Refs vs Selectors](guides/refs-vs-selectors.md) for choosing between accessibility refs and CSS selectors.
- SPA and Dynamic Sites *(coming soon)* for hydration waits, async content, and selector-based fallbacks.
- Session Profiles *(coming soon)* for login reuse, cookie import, and auto-save behavior.
- Search and Discovery *(coming soon)* for `web_search`, snapshots, and extraction flows.
- Downloads and Resources *(coming soon)* for download tracking, resource extraction, and blob resolution.
- Geo Presets *(coming soon)* for preset-driven locale, timezone, and geolocation setup.
- Snapshot Pagination *(coming soon)* for large-page reading with `offset`.
- [OpenClaw Integration](openclaw.md) for HTTP transport setup with OpenClaw.

## Tool Reference

- [Tool Reference Overview](tool-reference/README.md) for the full surface area and conventions.
- Health *(coming soon)*
- Tabs *(coming soon)*
- Navigation *(coming soon)*
- Interaction *(coming soon)*
- Observation *(coming soon)*
- Search *(coming soon)*
- Session *(coming soon)*
- Profiles *(coming soon)*
- Downloads *(coming soon)*
- Extraction *(coming soon)*
- Batch *(coming soon)*
- Presets *(coming soon)*

## Recipes

- Login and Reuse a Session *(coming soon)*
- Search Then Extract *(coming soon)*
- Fill and Submit a Form *(coming soon)*
- Collect Downloads from a Page *(coming soon)*
- Paginate Large Snapshots *(coming soon)*

## Reference

- [Website Patterns](reference/website-patterns.md)
- Errors *(coming soon)*
- Troubleshooting *(coming soon)*
- Configuration *(coming soon)*
- Prompts *(coming soon)*
- Security *(coming soon)*
- Architecture *(coming soon)*

## Architecture

CamoFox MCP is a TypeScript MCP server that translates MCP tool calls into HTTP requests against `camofox-browser`. The browser server manages Camoufox-backed browser contexts, anti-detection behavior, downloads, and live DOM operations. In practice, the flow is:

1. Your MCP client calls a CamoFox MCP tool.
2. CamoFox MCP validates arguments, manages tracked state, and forwards the request.
3. `camofox-browser` executes the browser operation and returns a structured result.
4. CamoFox MCP converts that result into MCP tool output for the agent.