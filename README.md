# 🦊 CamoFox MCP

**The anti-detection browser MCP server for AI agents.** Navigate, interact, and automate the web without getting blocked.

[![CI](https://github.com/redf0x1/camofox-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/redf0x1/camofox-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/camofox-mcp)](https://www.npmjs.com/package/camofox-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)

---

## Why CamoFox MCP?

AI agents using Playwright get **blocked constantly**. CAPTCHAs, fingerprint detection, IP bans — the web fights back against automation.

**CamoFox MCP** wraps the [CamoFox Browser Server](https://github.com/redf0x1/camofox-browser) as an MCP server, giving your AI agent:

- 🛡️ **Anti-detection fingerprinting** — Each tab gets a unique, human-like browser fingerprint
- ⚡ **Fast, token-efficient snapshots** — Accessibility tree snapshots use 90% fewer tokens than screenshots
- 🔍 **Built-in search** — Search Google, YouTube, Amazon + 11 more engines without getting blocked  
- 🍪 **Session persistence** — Import cookies, maintain login state across interactions
- 🎯 **CSS selector fallback** — Target elements even when accessibility refs aren't available

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
| Tools | 32 | 1 | 33 |
| Architecture | REST API client | Direct browser | Direct browser |
| Session persistence | ✅ | ❌ (destroyed per request) | ✅ |
| Token efficiency | High (snapshots) | Low (raw HTML) | High (snapshots) |
| Search macros | ✅ (14 engines) | ❌ | ❌ |
| CSS selector fallback | ✅ | ❌ | ❌ |
| Active maintenance | ✅ | ❌ (stale 8mo) | ✅ |
| Press key support | ✅ | ❌ | ✅ |

## Quick Start

### 1. Install CamoFox Browser

Download from [CamoFox Browser Server releases](https://github.com/redf0x1/camofox-browser/releases) (v2.0.0+) and start:

If you want **per-session geo presets** (locale/timezone/geolocation/viewport), ensure your camofox-browser server supports `preset` on tab creation and exposes `GET /presets` (v2.0.0+).

```bash
./camofox-browser   # Starts on port 9377
```

### 2. Configure MCP Client

#### VS Code / Cursor (Recommended)

Add to your MCP settings (`settings.json` or `.vscode/mcp.json`):

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

Add to `claude_desktop_config.json`:

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

#### From Source (Development)

```bash
git clone https://github.com/redf0x1/camofox-mcp.git
cd camofox-mcp
npm install && npm run build
```

Then configure:
```json
{
  "servers": {
    "camofox": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/camofox-mcp/dist/index.js"],
      "env": {
        "CAMOFOX_URL": "http://localhost:9377"
      }
    }
  }
}
```

### Docker

#### Quick Start with Docker

```bash
# Standalone (connect to an existing CamoFox browser server running on the host)
docker run -i --rm -e CAMOFOX_URL=http://host.docker.internal:9377 redf0x1/camofox-mcp

# Browser only (recommended): starts the CamoFox browser server in the background
docker compose up -d

# MCP (stdio): start the browser with compose, then launch the MCP container on-demand
# Option A: plain docker (attach stdin; uses the compose network)
docker run -i --rm --network=camofox-mcp_default -e CAMOFOX_URL=http://camofox-browser:9377 redf0x1/camofox-mcp

# Option B: compose run (no TTY; attaches stdin/stdout for JSON-RPC)
docker compose run --rm -T camofox-mcp
```

Note: `docker compose up -d` detaches and does not provide stdin, so it can only be used to run the browser service.
Your MCP client should launch the MCP container separately (using `docker run -i ...` or `docker compose run -T ...`).

#### VS Code MCP Configuration (Docker)

```json
{
  "camofox": {
    "command": "docker",
    "args": ["run", "-i", "--rm", "-e", "CAMOFOX_URL=http://host.docker.internal:9377", "redf0x1/camofox-mcp"],
    "type": "stdio"
  }
}
```

#### Claude Desktop Configuration (Docker)

```json
{
  "mcpServers": {
    "camofox": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "CAMOFOX_URL=http://host.docker.internal:9377", "redf0x1/camofox-mcp"],
      "type": "stdio"
    }
  }
}
```

IMPORTANT: Do NOT use `-t` flag — TTY corrupts the JSON-RPC stdio stream.

## Tools (32)

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
| `type_text` | Type text into input fields by ref or CSS selector |
| `camofox_press_key` | Press keyboard keys (Enter, Tab, Escape, etc.) |
| `scroll` | Scroll page up or down by pixel amount |
| `camofox_hover` | Hover over an element to trigger tooltips, dropdowns, or hover states |
| `camofox_wait_for` | Wait for page readiness after navigation or dynamic updates |

### Batch / Composite
| Tool | Description |
|------|-------------|
| `fill_form` | Fill multiple form fields in one call, with optional submit click |
| `type_and_submit` | Type into a field and press a key (default: Enter) |
| `navigate_and_snapshot` | Navigate to a URL, wait for readiness, and return a snapshot |
| `scroll_and_snapshot` | Scroll then capture a fresh snapshot |
| `batch_click` | Click multiple elements sequentially with per-click results |

### Observation
| Tool | Description |
|------|-------------|
| `snapshot` | Get accessibility tree — PRIMARY way to read pages. Token-efficient |
| `screenshot` | Take visual screenshot as base64 PNG |
| `get_links` | Get all hyperlinks with URLs and text |
| `camofox_wait_for_text` | Wait for specific text to appear on the page |

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

Note: auto-load requires `CAMOFOX_API_KEY` because importing cookies requires an API key.

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
  redf0x1/camofox-mcp
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CAMOFOX_URL` | `http://localhost:9377` | CamoFox server URL |
| `CAMOFOX_TIMEOUT` | `30000` | Request timeout in ms |
| `CAMOFOX_API_KEY` | — | API key (if CamoFox requires auth) |
| `CAMOFOX_PROFILES_DIR` | `~/.camofox-mcp/profiles` | Directory to store persistent session profiles |
| `CAMOFOX_AUTO_SAVE` | `true` | Auto-save on close + auto-load on create via `_auto_{userId}` |
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

## Contributing

Contributions are welcome! Please open an issue or submit a PR.

## License

[MIT](LICENSE)

## Acknowledgments

- [CamoFox Browser Server](https://github.com/redf0x1/camofox-browser) — The anti-detection browser server this MCP wraps
- [Camoufox](https://github.com/daijro/camoufox) — Firefox fork with C++ fingerprint spoofing
- [Model Context Protocol](https://modelcontextprotocol.io/) — The protocol standard by Anthropic
