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

**CamoFox MCP** wraps the [CamoFox anti-detection browser](https://github.com/jo-inc/camofox-browser) as an MCP server, giving your AI agent:

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
| Tools | 22 | 1 | 33 |
| Architecture | REST API client | Direct browser | Direct browser |
| Session persistence | ✅ | ❌ (destroyed per request) | ✅ |
| Token efficiency | High (snapshots) | Low (raw HTML) | High (snapshots) |
| Search macros | ✅ (14 engines) | ❌ | ❌ |
| CSS selector fallback | ✅ | ❌ | ❌ |
| Active maintenance | ✅ | ❌ (stale 8mo) | ✅ |
| Press key support | ✅ | ❌ | ✅ |

## Quick Start

### 1. Install CamoFox Browser

Download from [CamoFox releases](https://github.com/jo-inc/camofox-browser/releases) and start:

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

## Tools (22)

### Tab Management
| Tool | Description |
|------|-------------|
| `create_tab` | Create a new tab with anti-detection fingerprinting |
| `close_tab` | Close a tab and release resources |
| `list_tabs` | List all open tabs with URLs and titles |

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
| `press_key` | Press keyboard keys (Enter, Tab, Escape, etc.) |
| `scroll` | Scroll page up or down by pixel amount |

### Observation
| Tool | Description |
|------|-------------|
| `snapshot` | Get accessibility tree — PRIMARY way to read pages. Token-efficient |
| `screenshot` | Take visual screenshot as base64 PNG |
| `get_links` | Get all hyperlinks with URLs and text |

### Search
| Tool | Description |
|------|-------------|
| `web_search` | Search via 14 engines: Google, YouTube, Amazon, Bing, DuckDuckGo, Reddit, GitHub, StackOverflow, Wikipedia, Twitter, LinkedIn, Facebook, Instagram, TikTok |

### Session
| Tool | Description |
|------|-------------|
| `import_cookies` | Import cookies for authenticated sessions |
| `get_stats` | Get session statistics and performance metrics |
| `server_status` | Check CamoFox server health and connection |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CAMOFOX_URL` | `http://localhost:9377` | CamoFox server URL |
| `CAMOFOX_TIMEOUT` | `30000` | Request timeout in ms |
| `CAMOFOX_API_KEY` | — | API key (if CamoFox requires auth) |

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

CamoFox (via [Camoufox](https://github.com/jo-inc/camofox-browser)) provides:

- ✅ Unique browser fingerprint per tab
- ✅ Human-like user agent rotation
- ✅ WebGL fingerprint spoofing
- ✅ Canvas fingerprint protection
- ✅ Screen resolution randomization
- ✅ Font enumeration protection
- ✅ Navigator properties masking
- ✅ Timezone/locale consistency

## Contributing

Contributions are welcome! Please open an issue or submit a PR.

## License

[MIT](LICENSE)

## Acknowledgments

- [CamoFox Browser](https://github.com/jo-inc/camofox-browser) — The anti-detection browser this MCP wraps
- [Camoufox](https://camoufox.com/) — Firefox-based anti-detection browser engine
- [Model Context Protocol](https://modelcontextprotocol.io/) — The protocol standard by Anthropic
