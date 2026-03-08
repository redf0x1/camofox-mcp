# Getting Started

Use this guide to install CamoFox MCP, connect it to `camofox-browser`, verify that the integration works, and run your first browser actions.

## Prerequisites

- Node.js 18 or newer for `npx` and local development.
- Docker if you prefer container-based setup.
- A running `camofox-browser` server.
- An MCP-compatible client such as Claude Desktop, VS Code, Cursor, or OpenClaw.
- `CAMOFOX_API_KEY` only if your browser server is configured to require authentication.

## Installation Methods

### `npx` with stdio

Use this for Claude Desktop, VS Code, Cursor, and other desktop MCP clients.

1. Start `camofox-browser`:

```bash
npx camofox-browser@latest
```

2. Configure your MCP client to launch CamoFox MCP with `npx -y camofox-mcp@latest`.
3. Set `CAMOFOX_URL=http://localhost:9377` unless your browser server listens elsewhere.

### Docker with HTTP transport

Use this when your MCP client connects to a remote MCP endpoint, such as OpenClaw.

1. Start the browser server:

```bash
docker run -d -p 9377:9377 --name camofox-browser ghcr.io/redf0x1/camofox-browser:latest
```

2. Start CamoFox MCP in HTTP mode:

```bash
docker run -p 3000:3000 --rm \
  -e CAMOFOX_TRANSPORT=http \
  -e CAMOFOX_URL=http://host.docker.internal:9377 \
  ghcr.io/redf0x1/camofox-mcp:latest node dist/http.js
```

3. Point your HTTP-capable MCP client at `http://localhost:3000/mcp`.

### Local development

Use this when working on the server locally.

```bash
npm install
npm run build
npm run dev
```

For HTTP mode in local development:

```bash
CAMOFOX_TRANSPORT=http node dist/http.js
```

## Configuration

These are the environment variables most users need first.

| Variable | Default | Required | Notes |
|---|---|---|---|
| `CAMOFOX_URL` | `http://localhost:9377` | Yes | Base URL for the `camofox-browser` server. |
| `CAMOFOX_API_KEY` | none | No | Required only when the browser server enforces authentication. |
| `CAMOFOX_TIMEOUT` | `30000` | No | Request timeout in milliseconds. |
| `CAMOFOX_DEFAULT_USER_ID` | `default` | No | Default user/session identifier for tab creation. |
| `CAMOFOX_PROFILES_DIR` | `~/.camofox-mcp/profiles` | No | Directory used for saved session profiles. |
| `CAMOFOX_AUTO_SAVE` | `true` | No | Enables best-effort auto-save and auto-load for profiles. |
| `CAMOFOX_TRANSPORT` | `stdio` | No | Set to `http` for remote MCP transport. |
| `CAMOFOX_HTTP_HOST` | `127.0.0.1` | No | Bind address for HTTP transport. |
| `CAMOFOX_HTTP_PORT` | `3000` | No | Port for HTTP transport. |
| `CAMOFOX_HTTP_RATE_LIMIT` | `60` | No | Request-per-minute limit for HTTP mode. |

## Client Configuration

### Claude Desktop

```json
{
  "mcpServers": {
    "camofox": {
      "command": "npx",
      "args": ["-y", "camofox-mcp@latest"],
      "env": {
        "CAMOFOX_URL": "http://localhost:9377"
      }
    }
  }
}
```

### VS Code

```json
{
  "servers": {
    "camofox": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "camofox-mcp@latest"],
      "env": {
        "CAMOFOX_URL": "http://localhost:9377"
      }
    }
  }
}
```

### Cursor

```json
{
  "mcpServers": {
    "camofox": {
      "command": "npx",
      "args": ["-y", "camofox-mcp@latest"],
      "env": {
        "CAMOFOX_URL": "http://localhost:9377"
      }
    }
  }
}
```

If your browser server requires authentication, add `CAMOFOX_API_KEY` to the `env` block in both the browser server and the MCP client.

## Verify Setup

1. Confirm the browser server responds:

```bash
curl -fsS http://localhost:9377/health
```

2. Restart your MCP client after adding the configuration.
3. Ask your agent to run this setup verification flow:

```text
Verify my CamoFox MCP setup.

1) Call `server_status`.
2) If connected, call `create_tab` with `url: https://example.com`.
3) Call `navigate_and_snapshot` and wait for the text "Example Domain".
4) Call `list_profiles`.
5) Call `close_tab` for the test tab.

Report pass or fail for each step and explain any failure.
```

4. If verification fails, check `CAMOFOX_URL`, confirm `camofox-browser` is running, and verify that `CAMOFOX_API_KEY` matches on both sides when auth is enabled.

## First Steps

Once setup works, these are the first three actions to try with your agent:

1. Navigate to a URL.

```text
Create a tab for https://example.com and tell me the tab ID.
```

2. Take a snapshot.

```text
Take a snapshot of that tab and summarize the visible interactive elements.
```

3. Click an element.

```text
Use the snapshot refs to click the main link on the page, then take another snapshot.
```

If snapshot refs are incomplete on a modern SPA, move to selector-based workflows with `camofox_wait_for_selector`, `camofox_query_selector`, or `camofox_get_page_html`.

## Next

- Continue at the [Documentation Hub](README.md).
- Read [OpenClaw Integration](openclaw.md) if you need HTTP transport.
- Use [Refs vs Selectors](guides/refs-vs-selectors.md) for difficult sites.
- Use [SPA and Dynamic Sites](guides/spa-dynamic-sites.md) for hydration and async-content workflows.