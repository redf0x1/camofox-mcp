# 🦊 CamoFox MCP

**The anti-detection browser MCP server for AI agents.** Navigate, interact, and automate the web without getting blocked.

[![CI](https://github.com/redf0x1/camofox-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/redf0x1/camofox-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/camofox-mcp)](https://www.npmjs.com/package/camofox-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)

> **New to CamoFox?** Skip the docs — [paste this prompt](#3-verify-setup) into your AI agent and it’ll verify your setup end-to-end.

**How it works (TL;DR)**

```
Your AI Agent ──(MCP)──> camofox-mcp ──(REST)──> camofox-browser ──> Camoufox (anti-detection Firefox)
```

CamoFox has **2 components** — you need both running:

- `camofox-browser` is the headless browser server (anti-detection)
- `camofox-mcp` is the MCP bridge your AI agent connects to

---

## Why CamoFox MCP?

AI agents using Playwright get **blocked constantly**. CAPTCHAs, fingerprint detection, IP bans — the web fights back against automation.

**CamoFox MCP** wraps the [CamoFox Browser Server](https://github.com/redf0x1/camofox-browser) as an MCP server, giving your AI agent:

- 🛡️ **Anti-detection fingerprinting** — Each tab gets a unique, human-like browser fingerprint
- ⚡ **Fast, token-efficient snapshots** — Accessibility tree snapshots use 90% fewer tokens than screenshots
- 🔍 **Built-in search** — Search Google, YouTube, Amazon + 11 more engines without getting blocked  
- 🍪 **Session persistence** — Import cookies, maintain login state across interactions
- 🎯 **CSS selector fallback** — Target elements even when accessibility refs aren't available
- 📝 **YouTube transcript extraction** — Extract video transcripts with language selection
- 📄 **Snapshot pagination for large pages** — Use `offset` with truncation metadata to continue reading content
- ❤️ **Enhanced health monitoring** — `server_status` includes `consecutiveFailures` and `activeOps`

### CamoFox MCP vs Playwright MCP

| Feature | CamoFox MCP | Playwright MCP |
|---------|:-----------:|:--------------:|
| Anti-detection fingerprinting | ✅ | ❌ |
| Passes bot detection tests | ✅ | ❌ |
| Search engine macros (14 engines) | ✅ | ❌ |
| Accessibility snapshots | ✅ | ✅ |
| Cookie import/export | ✅ | Limited |
| Headless support | ✅ | ✅ |
| Setup complexity | Medium | Easy |
| Token efficiency | High | High |

### CamoFox MCP vs Other Camoufox MCPs

| Feature | CamoFox MCP | whit3rabbit/camoufox-mcp | baixianger/camoufox-mcp |
|---------|:-----------:|:-----------------------:|:-----------------------:|
| Tools | 43 | 1 | 33 |
| Architecture | REST API client | Direct browser | Direct browser |
| Session persistence | ✅ | ❌ (destroyed per request) | ✅ |
| Token efficiency | High (snapshots) | Low (raw HTML) | High (snapshots) |
| Search macros | ✅ (14 engines) | ❌ | ❌ |
| CSS selector fallback | ✅ | ❌ | ❌ |
| Active maintenance | ✅ | ❌ (stale 8mo) | ✅ |
| Press key support | ✅ | ❌ | ✅ |

## Prerequisites

- **Pick one:**
  - **Docker** (recommended) — easiest “zero-to-hero” setup
  - **Node.js 18+** ([download](https://nodejs.org/)) — needed for the `npx` setup
- **CamoFox Browser Server** must be running (it is **not** a downloadable desktop binary — use Docker, `npx`, or build from source)
- **An MCP-compatible client**: VS Code (Copilot), Cursor, Claude Desktop, or any MCP client

## Quick Start

Pick ONE option below.

### Option A: Docker (Recommended — Easiest)

**1) Start CamoFox Browser**

```bash
docker run -d -p 9377:9377 --name camofox-browser ghcr.io/redf0x1/camofox-browser:latest
```

**2) Verify it’s running**

```bash
curl http://localhost:9377/health
```

**3) Add MCP config to your editor** (see configs below)

**4) Paste the verification prompt into your AI agent** (see below)

### Option B: npx (Quick — Needs Node.js 18+)

**1) Start CamoFox Browser (keep this terminal open)**

```bash
npx camofox-browser@latest
```

**2) In another terminal, verify:**

```bash
curl http://localhost:9377/health
```

**3) Add MCP config to your editor** (see configs below)

**4) Paste the verification prompt into your AI agent**

### Option C: From Source (Developers)

**1) Clone and start CamoFox Browser**

```bash
git clone https://github.com/redf0x1/camofox-browser.git
cd camofox-browser && npm install && npm run build && npm start
```

**2) Clone and build CamoFox MCP**

```bash
git clone https://github.com/redf0x1/camofox-mcp.git
cd camofox-mcp && npm install && npm run build
```

**3) Add MCP config** (see configs below — use `node` path instead of `npx`)

**4) Paste the verification prompt**

### MCP Client Configuration

#### VS Code (Copilot)

- File: `.vscode/mcp.json` (in your workspace root)
- Create the file if it doesn't exist

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

#### Claude Desktop

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

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

Note: Claude Desktop uses `"mcpServers"` not `"servers"`.

#### Cursor

- File: `~/.cursor/mcp.json`

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

#### From Source (use `node` instead of `npx`)

```json
{
  "servers": {
    "camofox": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/camofox-mcp/dist/index.js"],
      "env": {
        "CAMOFOX_URL": "http://localhost:9377"
      }
    }
  }
}
```

Note: This example is for VS Code. For Claude Desktop or Cursor, use `"mcpServers"` instead of `"servers"`.

### 3. Verify Setup

> After configuring your MCP client, restart your editor. Then paste this prompt into your AI agent:

```text
Verify my CamoFox MCP setup. Run these checks and report results:

1) Call `server_status` — is the browser server connected?
2) If connected: `create_tab` with url `https://example.com`
3) `navigate_and_snapshot` on that tab (wait for text: "Example Domain")
4) `list_profiles` to confirm profile storage is accessible
5) `close_tab` for the test tab

If any step fails, diagnose the issue and suggest a fix.
Report: ✅ pass or ❌ fail for each step, plus overall status.
```

> **Prerequisites:** You must configure your MCP client first (Step 2 above). The AI agent can do everything else.

**Manual verification (optional):**

```bash
curl http://localhost:9377/health
# Expected: {"ok":true,"browserConnected":true}
```

### Docker

#### Quick Start with Docker

```bash
# Standalone (connect to an existing CamoFox browser server running on the host)
docker run -i --rm -e CAMOFOX_URL=http://host.docker.internal:9377 ghcr.io/redf0x1/camofox-mcp:latest

# Browser only (recommended): starts the CamoFox browser server in the background
docker compose up -d

# MCP (stdio): start the browser with compose, then launch the MCP container on-demand
# Option A: plain docker (attach stdin; uses the compose network)
docker run -i --rm --network=camofox-mcp_default -e CAMOFOX_URL=http://camofox-browser:9377 ghcr.io/redf0x1/camofox-mcp:latest

# Option B: compose run (no TTY; attaches stdin/stdout for JSON-RPC)
docker compose run --rm -T camofox-mcp
```

Note: `docker compose up -d` detaches and does not provide stdin, so it can only be used to run the browser service.
Your MCP client should launch the MCP container separately (using `docker run -i ...` or `docker compose run -T ...`).

#### VS Code MCP Configuration (Docker)

```json
{
  "servers": {
    "camofox": {
      "type": "stdio",
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "CAMOFOX_URL=http://host.docker.internal:9377", "ghcr.io/redf0x1/camofox-mcp:latest"]
    }
  }
}
```

#### Claude Desktop Configuration (Docker)

```json
{
  "mcpServers": {
    "camofox": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "CAMOFOX_URL=http://host.docker.internal:9377", "ghcr.io/redf0x1/camofox-mcp:latest"],
      "type": "stdio"
    }
  }
}
```

IMPORTANT: Do NOT use `-t` flag — TTY corrupts the JSON-RPC stdio stream.

## HTTP Transport (OpenClaw & Remote)

CamoFox MCP now supports Streamable HTTP transport for integration with OpenClaw and other HTTP-based MCP clients.

### Quick Start

```bash
# Start in HTTP mode
CAMOFOX_TRANSPORT=http npx camofox-mcp

# Or with CLI flags
npx camofox-mcp --transport http --http-port 3000

# With custom settings
CAMOFOX_TRANSPORT=http CAMOFOX_HTTP_PORT=8080 CAMOFOX_HTTP_HOST=0.0.0.0 npx camofox-mcp
```

### Configuration

| Variable | CLI Flag | Default | Description |
|----------|----------|---------|-------------|
| `CAMOFOX_TRANSPORT` | `--transport` | `stdio` | Transport mode: `stdio` or `http` |
| `CAMOFOX_HTTP_PORT` | `--http-port` | `3000` | HTTP server port |
| `CAMOFOX_HTTP_HOST` | `--http-host` | `127.0.0.1` | HTTP server bind address |
| `CAMOFOX_HTTP_RATE_LIMIT` | `--http-rate-limit` | `60` | Max requests per minute |

### Security Notes

- Default bind address is `127.0.0.1` (localhost only)
- To expose on network, use `--http-host 0.0.0.0` (ensure proper firewall/auth)
- Rate limiting enabled by default (60 req/min)
- Set `CAMOFOX_API_KEY` for CamoFox Browser authentication

## OpenClaw Integration

CamoFox MCP integrates with [OpenClaw](https://github.com/openclaw/openclaw) via HTTP transport, providing anti-detection browser automation as an MCP tool server.

### Method 1: MCP Server Config (Recommended)

Add to your OpenClaw `mcpServers` configuration:

```json
{
  "mcpServers": {
    "camofox": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Then start CamoFox MCP in HTTP mode:

```bash
CAMOFOX_TRANSPORT=http CAMOFOX_API_KEY=your-key npx camofox-mcp
```

### Method 2: mcptoskill CLI

```bash
npx @filiksyos/mcptoskill http://localhost:3000/mcp
```

### Method 3: Direct URL

Use `http://localhost:3000/mcp` as a direct MCP server URL in OpenClaw settings.

### Why CamoFox for OpenClaw?

OpenClaw's built-in browser uses standard headless Chrome which is easily detected by anti-bot systems. CamoFox provides:
- **C++ level fingerprint spoofing** — undetectable by bot detection
- **43 browser automation tools** — navigation, clicks, forms, screenshots, search across 14 engines
- **Anti-detection by default** — no configuration needed

## Tools (43)

### Tab Management
| Tool | Description |
|------|-------------|
| `create_tab` | Create a new tab with anti-detection fingerprinting |
| `close_tab` | Close a tab and release resources |
| `list_tabs` | List all open tabs with URLs and titles |

### Presets
| Tool | Description |
|------|-------------|
| `list_presets` | List all available geo presets supported by the connected CamoFox browser server |

### Geo Presets

`create_tab` supports optional regional configuration via a named `preset`, plus per-field overrides:

- `preset` — preset name (e.g., `japan`, `vietnam`, `uk`)
- `locale` — BCP-47 locale (e.g., `ja-JP`)
- `timezoneId` — IANA timezone (e.g., `Asia/Tokyo`)
- `geolocation` — `{ latitude, longitude }`
- `viewport` — `{ width, height }`

Resolution order: `preset` defaults → individual field overrides → server defaults.

Built-in presets (when supported by your camofox-browser server):

| Preset | Locale | Timezone | Location |
|--------|--------|----------|----------|
| `us-east` | en-US | America/New_York | New York |
| `us-west` | en-US | America/Los_Angeles | Los Angeles |
| `japan` | ja-JP | Asia/Tokyo | Tokyo |
| `uk` | en-GB | Europe/London | London |
| `germany` | de-DE | Europe/Berlin | Berlin |
| `vietnam` | vi-VN | Asia/Ho_Chi_Minh | Ho Chi Minh City |
| `singapore` | en-SG | Asia/Singapore | Singapore |
| `australia` | en-AU | Australia/Sydney | Sydney |

Example:

```json
{
  "userId": "agent1",
  "url": "https://example.com",
  "preset": "japan",
  "viewport": { "width": 1920, "height": 1080 }
}
```

Tip: call `list_presets` to discover what presets the connected server supports (including any custom preset file configured server-side).

### Navigation
| Tool | Description |
|------|-------------|
| `navigate` | Navigate to a URL, waits for page load |
| `go_back` | Browser back button |
| `go_forward` | Browser forward button |
| `refresh` | Reload current page |

### Interaction
| Tool | Description |
|------|-------------|
| `click` | Click element by ref (from snapshot) or CSS selector |
| `type_text` | Type text into input fields by ref or CSS selector. Supports unlimited text length; for text >= 400 chars, automatically uses JavaScript injection and requires `selector` instead of ref. If the JS fallback is auth-restricted, set `CAMOFOX_API_KEY` |
| `camofox_press_key` | Press keyboard keys (Enter, Tab, Escape, etc.) |
| `scroll` | Scroll page up or down by pixel amount |
| `camofox_scroll_element` | Scroll inside a container element (modal, sidebar, scrollable div) |
| `camofox_hover` | Hover over an element to trigger tooltips, dropdowns, or hover states |
| `camofox_wait_for` | Wait for page readiness after navigation or dynamic updates |
| `camofox_evaluate_js` | Execute JavaScript in page context (may require API key) |

Long text entry has no character limit. `type_text` and batch `type` actions keep short text as normal keystrokes for anti-detection, then switch to DOM insertion for longer input.

### Batch / Composite
| Tool | Description |
|------|-------------|
| `fill_form` | Fill multiple form fields in one call, with optional submit click |
| `type_and_submit` | Type into a field and press a key (default: Enter) |
| `navigate_and_snapshot` | Navigate to a URL, wait for readiness, and return a snapshot |
| `scroll_and_snapshot` | Scroll then capture a fresh snapshot |
| `camofox_scroll_element_and_snapshot` | Scroll inside a container element, then take a snapshot |
| `batch_click` | Click multiple elements sequentially with per-click results |

### Observation
| Tool | Description |
|------|-------------|
| `snapshot` | Get accessibility tree — PRIMARY way to read pages. Token-efficient, supports `offset` pagination for large pages |
| `screenshot` | Take visual screenshot as base64 PNG |
| `get_links` | Get all hyperlinks with URLs and text |
| `youtube_transcript` | Extract transcript from a YouTube video with language selection |
| `camofox_get_page_html` | Retrieve the live rendered DOM HTML via JavaScript. Useful when snapshot refs miss dynamically rendered SPA/custom-component content. Requires `CAMOFOX_API_KEY` |
| `camofox_query_selector` | Query a CSS selector in the live DOM and return element details or a specific attribute. Useful for targeted inspection without writing raw JavaScript. Requires `CAMOFOX_API_KEY` |
| `camofox_wait_for_text` | Wait for specific text to appear on the page |
| `camofox_wait_for_selector` | Poll until a CSS selector matches an element, with configurable timeout. Useful for SPA hydration and async content loading. Requires `CAMOFOX_API_KEY` |

### Search
| Tool | Description |
|------|-------------|
| `web_search` | Search via 14 engines: Google, YouTube, Amazon, Bing, DuckDuckGo, Reddit, GitHub, StackOverflow, Wikipedia, Twitter, LinkedIn, Facebook, Instagram, TikTok |

### Session
| Tool | Description |
|------|-------------|
| `import_cookies` | Import cookies for authenticated sessions |
| `get_stats` | Get session statistics and performance metrics |
| `camofox_close_session` | Close all browser tabs for a user session |
| `toggle_display` | Toggle browser display mode between headed/headless/virtual (restarts browser context; tabs invalidated, cookies/auth persist) |

### Session Profiles
| Tool | Description |
|------|-------------|
| `save_profile` | Save cookies from an active tab to a named on-disk profile |
| `load_profile` | Load a saved profile's cookies into an active tab (restores login sessions) |
| `list_profiles` | List saved profiles with metadata (cookie count, save date, description) |
| `delete_profile` | Delete a saved profile from disk |

### Health
| Tool | Description |
|------|-------------|
| `server_status` | Check CamoFox server health and connection |

## Session Profiles

Session Profiles let you persist authenticated browser state across MCP restarts by saving/loading cookies to/from disk.

### Tools

- `save_profile` — export cookies from an active tab and save them under a profile name
- `load_profile` — load a saved profile into an active tab (imports cookies)
- `list_profiles` — list all saved profiles and metadata
- `delete_profile` — delete a saved profile permanently

### Configuration

- `CAMOFOX_PROFILES_DIR` — directory used to store profiles (default: `~/.camofox-mcp/profiles/`)
- `CAMOFOX_AUTO_SAVE` — enable auto-save/auto-load of an "auto profile" (default: `true`). Set to `false` to disable.

### Auto-save / auto-load

By default, CamoFox MCP will persist sessions automatically:

- On `close_tab` and `camofox_close_session`, cookies are exported and saved to `_auto_{userId}` (best-effort; 5-second timeout).
- On `create_tab`, if `_auto_{userId}` exists, it is loaded automatically (best-effort; 5-second timeout).

Note: auto-load imports cookies, which may require `CAMOFOX_API_KEY` if the CamoFox browser server enforces authentication. For local setups, auto-load works without a key.

### Example flow

1. `create_tab`
2. Navigate + login interactively
3. `save_profile` (from the logged-in tab)
4. Restart your MCP client/server
5. `create_tab`
6. `load_profile`
7. `navigate` — you should already be authenticated

### Docker persistence

Mount a volume so profiles survive container restarts:

```bash
docker run -i --rm \
  -e CAMOFOX_URL=http://host.docker.internal:9377 \
  -v "$HOME/.camofox-mcp/profiles:/root/.camofox-mcp/profiles" \
  ghcr.io/redf0x1/camofox-mcp:latest
```

## API Key Setup

The API key is **optional**. All 43 tools work without a key when the CamoFox browser server doesn't enforce authentication (the default for local setups).

If your CamoFox browser server **has authentication enabled**, these tools need a matching key:

- `import_cookies`
- `camofox_evaluate_js`
- `load_profile` (imports cookies)
- Auto-save / auto-load session profiles (imports cookies on `create_tab`)

Without a matching key, these tools return a clear "API key required" error with setup instructions.

### How it works

The key is a **shared secret** between **both** servers and must match exactly:

```
AI Agent -> (MCP tool call) -> CamoFox MCP (sends CAMOFOX_API_KEY) -> (HTTP) -> CamoFox Browser Server (validates key)
```

### Set the key on both servers

**1) Start CamoFox Browser Server with a key** (exact flags may vary by camofox-browser version):

```bash
export CAMOFOX_API_KEY="your_shared_secret"
./camofox-browser
```

Or (if supported by your camofox-browser build):

```bash
./camofox-browser --api-key "your_shared_secret"
```

**2) Configure your MCP client to pass the same key**:

```json
{
  "servers": {
    "camofox": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "camofox-mcp@latest"],
      "env": {
        "CAMOFOX_URL": "http://localhost:9377",
        "CAMOFOX_API_KEY": "your_shared_secret"
      }
    }
  }
}
```

Note: This example is for VS Code. For Claude Desktop or Cursor, use `"mcpServers"` instead of `"servers"`.

### What happens without an API key?

**All tools work** when the CamoFox browser server doesn't require authentication (default for local/Docker setups).

If the browser server **does** enforce auth and no key is set, cookie import, profile load, and JS evaluation return a clear error: "CamoFox server requires authentication. Set CAMOFOX_API_KEY environment variable."

⚠️ **Key mismatch** between MCP and browser server → affected tools return **"Forbidden"**. Ensure the **same** key is set on both servers.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CAMOFOX_URL` | `http://localhost:9377` | CamoFox server URL |
| `CAMOFOX_TIMEOUT` | `30000` | Request timeout in ms |
| `CAMOFOX_API_KEY` | — | Shared secret for authenticated operations. Only needed if the CamoFox browser server enforces auth |
| `CAMOFOX_LONG_TEXT_THRESHOLD` | `400` | Character count where `type_text` switches from keystrokes to DOM insertion for long text |
| `CAMOFOX_PROFILES_DIR` | `~/.camofox-mcp/profiles` | Directory to store persistent session profiles |
| `CAMOFOX_AUTO_SAVE` | `true` | Auto-save on close + auto-load on create via `_auto_{userId}` |
| `CAMOFOX_DEFAULT_USER_ID` | `default` | Default userId for new tabs when none specified |
| `CAMOFOX_TAB_TTL_MS` | `1800000` | Tab TTL in milliseconds (30min). Set to 0 to disable auto-eviction |
| `CAMOFOX_MAX_TABS` | `100` | Maximum tracked tabs |
| `CAMOFOX_VISITED_URLS_LIMIT` | `50` | Max URLs to keep in tab history |
| `CAMOFOX_SWEEP_INTERVAL_MS` | `60000` | Sweep interval in milliseconds (1min) |

## Architecture

```
AI Agent (Claude, GPT, etc.)
       │
       │ MCP Protocol (stdio)
       ▼
┌─────────────────┐
│  CamoFox MCP    │  ← This package
│  (TypeScript)   │
└────────┬────────┘
         │
         │ REST API (HTTP)
         ▼
┌─────────────────┐
│  CamoFox Server │  ← Anti-detection browser
│  (Port 9377)    │
└────────┬────────┘
         │
         │ Browser Engine
         ▼
┌─────────────────┐
│  Camoufox       │  ← Firefox-based, fingerprint spoofing
│  (Firefox)      │
└─────────────────┘
```

## How It Works

1. **Your AI agent** sends MCP tool calls (e.g., `create_tab`, `navigate`, `snapshot`)
2. **CamoFox MCP** translates these into REST API calls to the CamoFox server
3. **CamoFox server** manages a Camoufox browser with anti-detection features
4. **Each tab** gets a unique fingerprint — different user agent, screen size, WebGL, fonts, etc.
5. **Websites see** what appears to be a normal human browser, not automation

## Anti-Detection Features

CamoFox (via [Camoufox](https://github.com/daijro/camoufox)) provides:

- ✅ Unique browser fingerprint per tab
- ✅ Human-like user agent rotation
- ✅ WebGL fingerprint spoofing
- ✅ Canvas fingerprint protection
- ✅ Screen resolution randomization
- ✅ Font enumeration protection
- ✅ Navigator properties masking
- ✅ Timezone/locale consistency

## Related Projects

| Project | Description |
|---------|-------------|
| [CamoFox Browser Server](https://github.com/redf0x1/camofox-browser) | Anti-detection browser server (required) |
| [Camoufox](https://github.com/daijro/camoufox) | Firefox fork with C++ fingerprint spoofing |

## Troubleshooting

**Quick troubleshoot (paste into your AI agent):**

```text
Something isn't working with my CamoFox setup. Please diagnose:

1) Call `server_status` — check browser server connection
2) If connected, try `create_tab` and navigate to any URL
3) If that works, try `import_cookies` with a simple test cookie
4) Report what's working and what's failing
5) Suggest specific fixes for any issues found
```

- **Connection refused** (curl fails / `server_status` fails) -> CamoFox Browser Server is not running or `CAMOFOX_URL` is wrong. Verify with:
  ```bash
  curl http://localhost:9377/health
  ```
- **"Forbidden" on `import_cookies` / profile load / `camofox_evaluate_js`** -> API key mismatch. Ensure the **same** `CAMOFOX_API_KEY` is set on both servers.
- **"API key required"** -> The CamoFox browser server requires authentication. Set `CAMOFOX_API_KEY` on both servers (see API Key Setup).
- **Session profiles not auto-restoring** -> Auto-load imports cookies, which requires `CAMOFOX_API_KEY` if the browser server enforces auth. Also confirm `CAMOFOX_AUTO_SAVE` is not set to `false`.
- **Not sure if setup is working?** -> Run the health check above, then ask your agent to call `server_status`, then try the Quick Start smoke test.

## Contributing

Contributions are welcome! Please open an issue or submit a PR.

## Security

### URL Navigation (SSRF Awareness)

CamoFox MCP forwards URLs to the CamoFox Browser Server for navigation. This is core functionality — the browser visits whatever URL you provide.

**In trusted environments** (local development, single-user): No special precautions needed.

**In shared/cloud environments**: Be aware that the browser can access any URL reachable from its host, including internal network services. Consider:

- Running the browser server in an isolated network (Docker network, VPC)
- Using firewall rules to restrict outbound access from the browser container
- Not exposing the MCP server to untrusted clients

### API Key

When `CAMOFOX_API_KEY` is set, all sensitive operations (cookie import/export, JavaScript evaluation) require authentication. Always set an API key in production environments.

### Profile Storage

Session profiles are stored locally at `~/.camofox-mcp/profiles/` with restricted file permissions (`0o600`). Profiles contain cookies which may include authentication tokens — treat them as sensitive data.

## License

[MIT](LICENSE)

## Acknowledgments

- [CamoFox Browser Server](https://github.com/redf0x1/camofox-browser) — The anti-detection browser server this MCP wraps
- [Camoufox](https://github.com/daijro/camoufox) — Firefox fork with C++ fingerprint spoofing
- [Model Context Protocol](https://modelcontextprotocol.io/) — The protocol standard by Anthropic
