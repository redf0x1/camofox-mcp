# Getting Started

Use this guide to install CamoFox MCP, connect it to `camofox-browser`, verify that the integration works, and run your first browser actions.

## Prerequisites

- Node.js 18 or newer for `npx` and local development.
- Docker if you prefer container-based setup.
- A running `camofox-browser` server. Use `camofox-browser` `2.4.7` or newer. Browser `2.4.7` adds the supported Windows x64 headless portable distribution and session-scoped navigation recovery; `2.4.6` pins the Camoufox-compatible Playwright protocol dependency, `2.4.5` introduced explicit browser auth modes, and `2.4.4` fixed first-tab reuse for persistent contexts.
- An MCP-compatible client such as Claude Desktop, VS Code, Cursor, or OpenClaw.
- `CAMOFOX_API_KEY` only if your browser server is configured to require authentication. Leave it unset when the browser runs with `CAMOFOX_AUTH_MODE=disabled`.

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
docker run -p 3000:8080 --rm \
  -e CAMOFOX_TRANSPORT=http \
  -e CAMOFOX_HTTP_HOST=0.0.0.0 \
  -e CAMOFOX_HTTP_API_KEY=replace-with-32-plus-random-chars \
  -e CAMOFOX_URL=http://host.docker.internal:9377 \
  ghcr.io/redf0x1/camofox-mcp:latest node dist/http.js
```

3. Point your HTTP-capable MCP client at `http://localhost:3000/mcp` and send `Authorization: Bearer replace-with-32-plus-random-chars`.

### Windows x64 browser server

`camofox-browser` 2.4.7 provides an official Windows x64 portable ZIP. Extract it to a writable directory, then start the bundled browser server from PowerShell or Command Prompt:

```powershell
.\camofox.cmd --version
.\camofox.cmd server start --background
.\camofox.cmd server status
```

The browser portable bundle includes its own Node.js runtime and keeps browser state under `data\home` inside the extracted directory. CamoFox MCP still requires Node.js 18 or newer when you run it with `npx`. The verified Windows browser contract is headless mode only; headed and virtual-display modes are not supported there.

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
| `CAMOFOX_API_KEY` | none | No | Outbound browser-server API key. Required only when the browser server enforces authentication; leave unset for browser `CAMOFOX_AUTH_MODE=disabled`. |
| `CAMOFOX_TIMEOUT` | `30000` | No | Request timeout in milliseconds. |
| `CAMOFOX_DEFAULT_USER_ID` | `default` | No | Default user/session identifier for tab creation. |
| `CAMOFOX_PROFILES_DIR` | `~/.camofox-mcp/profiles` | No | Directory used for saved session profiles. |
| `CAMOFOX_AUTO_SAVE` | `true` | No | Enables best-effort auto-save and auto-load for profiles. |
| `CAMOFOX_VIEWPORT` | none | No | Default viewport for new tabs in `WIDTHxHEIGHT` format, for example `1366x768`. Width must be `320..3840`; height must be `240..2160`. Explicit `create_tab.viewport` values override this default. |
| `CAMOFOX_TRANSPORT` | `stdio` | No | Set to `http` for remote MCP transport. |
| `CAMOFOX_HTTP_HOST` | `127.0.0.1` | No | Bind address for HTTP transport. |
| `CAMOFOX_HTTP_PORT` | `3000` | No | Port for HTTP transport. |
| `CAMOFOX_HTTP_RATE_LIMIT` | `60` | No | Request-per-minute limit for HTTP mode. |
| `CAMOFOX_HTTP_API_KEY` | none | Required for non-loopback HTTP bind | Inbound HTTP MCP Bearer token. Use at least 32 random characters. |
| `CAMOFOX_HTTP_ALLOWED_HOSTS` | none | No | Comma-separated Host header allowlist for HTTP transport. |

## CLI and MCP Session Sharing

The camofox CLI default session uses `userId: "cli-default"` and `sessionKey: "default"`.

CamoFox MCP defaults `CAMOFOX_DEFAULT_USER_ID` to `default`, and `create_tab` creates a new random `sessionKey` unless one is provided. To create an MCP-tracked tab in the same browser profile/context as the camofox CLI default session, pass both values explicitly:

```json
{
  "url": "http://localhost:8085",
  "userId": "cli-default",
  "sessionKey": "default",
  "viewport": { "width": 1366, "height": 768 }
}
```

This shares the browser context/profile, but it does not reliably attach MCP to a tab that the CLI already opened. Importing or adopting existing CLI tabs is future work. The `viewport` field controls the browser viewport/display size and is the supported way to avoid unexpectedly wide headed windows.

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

If your browser server requires authentication, add `CAMOFOX_API_KEY` to the `env` block in both the browser server and the MCP client. This is separate from `CAMOFOX_HTTP_API_KEY`, which protects inbound HTTP MCP clients.

For trusted private agent networks where clients cannot send browser bearer tokens, run the browser server with `CAMOFOX_AUTH_MODE=disabled` and leave `CAMOFOX_API_KEY` unset in CamoFox MCP. CamoFox MCP will send no outbound browser auth headers in that setup. Keep the browser endpoint on a trusted private network and do not expose it to untrusted clients.

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
2) If the browser server is reachable, call `create_tab` with `url: https://example.com`.
   A cold server can report no active browser session before the first tab is created.
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
