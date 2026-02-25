# OpenClaw Integration Guide

## Overview

CamoFox MCP provides anti-detection browser automation for OpenClaw agents via the Model Context Protocol (MCP) over HTTP transport.

## Prerequisites

- Node.js >= 18
- CamoFox Browser running (default: http://localhost:9377)
- OpenClaw instance

## Setup

### Step 1: Start CamoFox Browser

Download and start [CamoFox Browser](https://github.com/redf0x1/camofox-browser):

```bash
# CamoFox Browser must be running before starting MCP server
# Default: http://localhost:9377
```

### Step 2: Start CamoFox MCP in HTTP Mode

```bash
# Using npx (no installation needed)
CAMOFOX_TRANSPORT=http npx camofox-mcp

# Or with API key authentication
CAMOFOX_TRANSPORT=http CAMOFOX_API_KEY=your-key npx camofox-mcp

# Custom port
CAMOFOX_TRANSPORT=http CAMOFOX_HTTP_PORT=8080 npx camofox-mcp
```

### Step 3: Configure OpenClaw

#### Option A: mcpServers Config (Recommended)

Add to your OpenClaw configuration:

```json
{
  "mcpServers": {
    "camofox": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

#### Option B: mcptoskill CLI

Convert MCP tools to OpenClaw skills:

```bash
npx @filiksyos/mcptoskill http://localhost:3000/mcp
```

#### Option C: MCPorter

Use MCPorter to bridge MCP servers to OpenClaw skills format.

#### Option D: Direct URL

Enter `http://localhost:3000/mcp` as a custom MCP server URL in OpenClaw settings.

## Available Tools (41)

CamoFox MCP provides 41 browser automation tools:

### Navigation
- `navigate` — Navigate to URL
- `navigate_and_snapshot` — Navigate + get accessibility snapshot
- `go_back` / `go_forward` — Browser history navigation

### Interaction
- `click` — Click element by ref or CSS selector
- `type_text` — Type text into element
- `fill_form` — Fill multiple form fields at once
- `camofox_hover` — Hover over element
- `camofox_press_key` — Press keyboard keys
- `scroll` / `scroll_and_snapshot` — Scroll page

### Content
- `snapshot` — Get accessibility tree (low token cost)
- `screenshot` — Take screenshot (high token cost)
- `camofox_wait_for_text` — Wait for text content to appear
- `get_links` — Get all links on page

### Search
- `web_search` — Search across 14 engines (Google, YouTube, Amazon, Reddit, etc.)

### Tab Management
- `create_tab` — Create new browser tab
- `close_tab` — Close tab
- `list_tabs` — List open tabs

### Downloads
- `list_downloads` — List downloaded files and filter by status/type/size
- `get_download` — Read download metadata and optional file content
- `delete_download` — Delete downloaded file from disk and registry
- `extract_resources` — Extract media/links/documents from a DOM scope
- `batch_download` — Extract and download resources in one call
- `resolve_blobs` — Resolve blob URLs to downloadable data

## Configuration Reference

| Variable | CLI Flag | Default | Description |
|----------|----------|---------|-------------|
| `CAMOFOX_TRANSPORT` | `--transport` | `stdio` | Transport: `stdio` or `http` |
| `CAMOFOX_HTTP_PORT` | `--http-port` | `3000` | HTTP port |
| `CAMOFOX_HTTP_HOST` | `--http-host` | `127.0.0.1` | Bind address |
| `CAMOFOX_HTTP_RATE_LIMIT` | `--http-rate-limit` | `60` | Requests/minute |
| `CAMOFOX_API_KEY` | `--api-key` | — | CamoFox Browser API key |
| `CAMOFOX_URL` | `--camofox-url` / `--url` | `http://localhost:9377` | CamoFox Browser server URL |
| `CAMOFOX_TIMEOUT` | `--timeout` | `30000` | Request timeout (ms) |

## Security

- HTTP mode binds to `127.0.0.1` by default (localhost only)
- Use `CAMOFOX_API_KEY` for CamoFox Browser authentication
- Rate limiting protects against abuse (60 req/min default)
- DNS rebinding protection enabled via MCP SDK
- For network exposure (`0.0.0.0`), ensure proper firewall rules

## Troubleshooting

### "Connection refused" errors
Ensure CamoFox Browser is running on the expected port (default: 9377).

### "Rate limit exceeded" (429)
Increase rate limit: `--http-rate-limit 120` or reduce request frequency.

### Tools not appearing in OpenClaw
Verify the MCP server URL is correct: `http://localhost:3000/mcp`
