# CamoFox MCP

AI-powered anti-detection browser automation for MCP-compatible AI agents.

CamoFox MCP connects MCP clients such as Claude Desktop, VS Code, Cursor, and OpenClaw to the CamoFox browser server. It gives agents a practical browser toolset for navigation, interaction, search, extraction, downloads, and session reuse while relying on Camoufox-based anti-detection behavior underneath.

## Key Features

- 47 browser automation tools across navigation, interaction, observation, search, downloads, sessions, and batch workflows.
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
docker run -p 3000:8080 --rm \
  -e CAMOFOX_TRANSPORT=http \
  -e CAMOFOX_HTTP_HOST=0.0.0.0 \
  -e CAMOFOX_HTTP_API_KEY=replace-with-32-plus-random-chars \
  -e CAMOFOX_URL=http://host.docker.internal:9377 \
  ghcr.io/redf0x1/camofox-mcp:latest node dist/http.js
```

Configure your HTTP MCP client to connect to `http://localhost:3000/mcp` with
`Authorization: Bearer replace-with-32-plus-random-chars`.

Full client configuration examples live in [docs/getting-started.md](docs/getting-started.md).

## Quick Verify

Use `camofox-browser` `2.4.7` or newer. Browser `2.4.7` adds the supported Windows x64 headless portable distribution and hardens session-scoped navigation recovery without changing the MCP-facing REST request shapes used here. Browser `2.4.6` pins the Camoufox-compatible Playwright protocol dependency for fresh installs, `2.4.5` adds explicit browser auth modes including `CAMOFOX_AUTH_MODE=disabled` for trusted private agent networks, and `2.4.4` fixes the persistent-context cold-start `about:blank` page reuse path.

Verify the browser server is reachable:

```bash
curl -fsS http://localhost:9377/health
```

Expected response includes `"ok":true` and `"running":true`.
On a cold server with no active tabs yet, `browserConnected` can be `false`; create a tab to start a browser session.

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
- MCP can share the camofox CLI default browser profile/context when `create_tab` uses `userId: "cli-default"` and `sessionKey: "default"`, but it cannot reliably attach to a tab the CLI already opened. Importing/adopting existing CLI tabs is a future feature.
- Headed browser window size follows browser viewport/display-size behavior. Pass `viewport`, for example `{ "width": 1366, "height": 768 }`, or set `CAMOFOX_VIEWPORT=1366x768` / `--viewport 1366x768` for a default new-tab size. Supported defaults use width `320..3840` and height `240..2160`.
- On Windows x64, `camofox-browser` 2.4.7 supports the portable distribution in `headless=true` mode. Headed and virtual-display modes remain unsupported on Windows; `toggle_display` will reject those modes there.
- Accessibility-tree refs are the primary interaction model, but SPA and custom-component sites can require CSS selectors or rendered HTML tools.
- If the browser server enforces authentication, API-key-gated operations need the same `CAMOFOX_API_KEY` on both sides.
- For trusted private-network browser deployments using `CAMOFOX_AUTH_MODE=disabled`, leave `CAMOFOX_API_KEY` unset in CamoFox MCP. MCP then sends no outbound browser auth headers. Keep both browser and MCP access on a trusted private network.
- If HTTP transport is exposed beyond loopback, set `CAMOFOX_HTTP_API_KEY` and require clients to send it as a Bearer token.
- HTTP transport is mainly for remote MCP clients. Desktop MCP clients usually work best with stdio configuration.

## Security

Treat this as a browser control surface. In shared or networked environments, isolate the browser server, avoid exposing MCP endpoints broadly, and use `CAMOFOX_HTTP_API_KEY` for inbound HTTP MCP clients plus `CAMOFOX_API_KEY` when the browser server requires authentication. If the browser server runs `CAMOFOX_AUTH_MODE=disabled`, leave `CAMOFOX_API_KEY` unset and keep that browser endpoint on a trusted private network. Session profiles can contain sensitive cookies and should be stored accordingly.

## Documentation

Start at [docs/README.md](docs/README.md) for the documentation hub, then use [docs/getting-started.md](docs/getting-started.md) for setup, verification, and first workflow examples.

## Contributing + License

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines, [SECURITY.md](SECURITY.md) for private vulnerability reporting, and [LICENSE](LICENSE) for the MIT license.
