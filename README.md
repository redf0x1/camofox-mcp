# CamoFox MCP

AI-powered anti-detection browser automation for MCP-compatible AI agents.

CamoFox MCP connects MCP clients such as Claude Desktop, VS Code, Cursor, and OpenClaw to the CamoFox browser server. It gives agents a practical browser toolset for navigation, interaction, search, extraction, downloads, and session reuse while relying on Camoufox-based anti-detection behavior underneath.

## Key Features

- 46 browser automation tools across navigation, interaction, observation, search, downloads, sessions, and batch workflows.
- Anti-detection browser automation built on top of the CamoFox browser server and Camoufox.
- Multi-tab workflows with tracked state, history, and cleanup.
- Session persistence with cookie import, saved profiles, and optional auto-save.
- Token-efficient accessibility snapshots with CSS-selector fallbacks for difficult SPA flows.
- OpenClaw-compatible HTTP transport, plus standard stdio support for desktop MCP clients.

## Quick Install

You need both components running:

1. `camofox-browser` handles the anti-detection browser.
2. `camofox-mcp` exposes that browser to your MCP client.

### Option A: `npx` + stdio

Start the browser server:

```bash
npx camofox-browser@latest
```

Add CamoFox MCP to your MCP client:

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

### Option B: Docker

Start the browser server:

```bash
docker run -d -p 9377:9377 --name camofox-browser ghcr.io/redf0x1/camofox-browser:latest
```

Run CamoFox MCP in HTTP mode for remote MCP clients such as OpenClaw:

```bash
docker run -p 3000:3000 --rm \
  -e CAMOFOX_TRANSPORT=http \
  -e CAMOFOX_URL=http://host.docker.internal:9377 \
  ghcr.io/redf0x1/camofox-mcp:latest node dist/http.js
```

Full client configuration examples live in [docs/getting-started.md](docs/getting-started.md).

## Quick Verify

Verify the browser server is reachable:

```bash
curl -fsS http://localhost:9377/health
```

Expected response includes `"ok":true` and `"browserConnected":true`.

## Tool Categories

| Category | Tool count | Docs |
|---|---:|---|
| Health | 1 | [Health](docs/tool-reference/health.md) |
| Tabs | 3 | [Tabs](docs/tool-reference/tabs.md) |
| Navigation | 4 | [Navigation](docs/tool-reference/navigation.md) |
| Interaction | 8 | [Interaction](docs/tool-reference/interaction.md) |
| Observation | 8 | [Observation](docs/tool-reference/observation.md) |
| Search | 1 | [Search](docs/tool-reference/search.md) |
| Session | 4 | [Session](docs/tool-reference/session.md) |
| Profiles | 4 | [Profiles](docs/tool-reference/profiles.md) |
| Downloads | 3 | [Downloads](docs/tool-reference/downloads.md) |
| Extraction | 3 | [Extraction](docs/tool-reference/extraction.md) |
| Batch workflows | 6 | [Batch](docs/tool-reference/batch.md) |
| Presets | 1 | [Presets](docs/tool-reference/presets.md) |

## Top Limitations

- CamoFox MCP is not a standalone browser. You must run a compatible `camofox-browser` server separately.
- Accessibility-tree refs are the primary interaction model, but SPA and custom-component sites can require CSS selectors or rendered HTML tools.
- If the browser server enforces authentication, API-key-gated operations need the same `CAMOFOX_API_KEY` on both sides.
- HTTP transport is mainly for remote MCP clients. Desktop MCP clients usually work best with stdio configuration.

## Security

Treat this as a browser control surface. In shared or networked environments, isolate the browser server, avoid exposing MCP endpoints broadly, and use `CAMOFOX_API_KEY` when authentication is enabled. Session profiles can contain sensitive cookies and should be stored accordingly.

## Documentation

Start at [docs/README.md](docs/README.md) for the documentation hub, then use [docs/getting-started.md](docs/getting-started.md) for setup, verification, and first workflow examples.

## Contributing + License

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [LICENSE](LICENSE) for the MIT license.
