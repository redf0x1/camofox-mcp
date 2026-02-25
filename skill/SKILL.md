---
name: skill
title: CamoFox MCP for OpenClaw
version: 1.10.0
description: Anti-detection browser automation MCP skill for OpenClaw agents with 41 tools for navigation, interaction, extraction, downloads, profiles, sessions, and stealth web search.
author: redf0x1
tags:
  - mcp
  - openclaw
  - browser-automation
  - anti-detection
  - camofox
  - web-scraping
  - ai-agent
license: MIT
homepage: https://github.com/redf0x1/camofox-mcp#readme
metadata:
  title: CamoFox MCP for OpenClaw
  version: 1.10.0
  author: redf0x1
  tags:
    - mcp
    - openclaw
    - browser-automation
    - anti-detection
    - camofox
    - web-scraping
    - ai-agent
  homepage: https://github.com/redf0x1/camofox-mcp#readme
---

# CamoFox MCP Skill

CamoFox MCP gives OpenClaw agents a production-ready anti-detection browser automation toolkit over MCP HTTP transport. It connects OpenClaw to CamoFox Browser so agents can browse, click, type, extract content, manage cookies/sessions, run stealth search workflows, and download resources without the high block rates common with standard automation stacks.

## Why this skill exists

Most browser automation flows eventually hit CAPTCHAs, fingerprint checks, or bot detection. CamoFox is purpose-built for that reality:

- Anti-detection fingerprinting per tab/session
- Better resilience on sites that aggressively detect automation
- Token-efficient accessibility snapshots for agent reasoning
- Session persistence via cookie/profile tools
- Built-in search macros across 14 engines

## Setup

### 1) Start CamoFox Browser

CamoFox Browser must be running first (default `http://localhost:9377`).

### 2) Start CamoFox MCP in HTTP mode

```bash
CAMOFOX_TRANSPORT=http npx camofox-mcp@1.10.0
```

Optional examples:

```bash
CAMOFOX_TRANSPORT=http CAMOFOX_API_KEY=your-key npx camofox-mcp@1.10.0
CAMOFOX_TRANSPORT=http CAMOFOX_HTTP_PORT=8080 npx camofox-mcp@1.10.0
```

### 3) Configure OpenClaw

Add this MCP server:

```json
{
  "mcpServers": {
    "camofox": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Alternative skill-generation flow:

```bash
npx @filiksyos/mcptoskill http://localhost:3000/mcp
```

## Trigger phrases

Use this skill when the user asks for tasks like:

- “Browse this site and extract the data”
- “Automate this login/search/form flow”
- “Use a stealth or anti-detection browser”
- “Take a snapshot and click/type through this workflow”
- “Collect all links/images/PDFs from this page section”
- “Persist session cookies and restore later”
- “Run web search in browser and summarize results”
- “Download files and return metadata/content”

## Tool catalog (41 tools)

### Health (1)

- `server_status` — Check CamoFox server health and browser connection. Call first to verify server is running. Returns version, browser status, and active tab count.

### Tabs (3)

- `create_tab` — Create a new browser tab with anti-detection fingerprinting. Each tab gets a unique fingerprint. Optionally provide a URL and userId for session isolation. Returns the tab ID for subsequent operations.
- `close_tab` — Close a browser tab and release resources. Always close tabs when done to free memory.
- `list_tabs` — List all open browser tabs with URLs and titles. Use to discover available tabs or verify tab state.

### Navigation (4)

- `navigate` — Navigate a tab to a URL. Waits for page load. Use create_tab first, then navigate. Returns final URL (may differ due to redirects).
- `go_back` — Navigate backward in browser history (Back button). Returns new page URL.
- `go_forward` — Navigate forward in browser history (Forward button). Returns new page URL.
- `refresh` — Reload the current page. Useful when page state is stale or after changes.

### Interaction (8)

- `click` — Click an element. Provide either ref (from snapshot) or CSS selector. Use snapshot first to discover element refs.
- `type_text` — Type text into an input field. Provide either a ref (from snapshot) or a CSS selector. Use ref when available; otherwise use selector when snapshot doesn't assign refs (common with combobox/autocomplete inputs). Call snapshot first to find target element.
- `scroll` — Scroll page up or down by pixel amount. Use to reveal content below the fold or navigate long pages.
- `camofox_scroll_element` — Scroll a specific container element (modal dialog, scrollable div, sidebar). Use when page-level scroll doesn't reach content inside modals or overflow containers. Returns scroll position metadata to track progress.
- `camofox_evaluate_js` — Execute JavaScript in the browser page context. Runs in isolated scope (invisible to page scripts — safe for anti-detection). Use for: extracting data not visible in accessibility snapshot, checking element properties, reading computed styles, manipulating DOM elements. Requires CAMOFOX_API_KEY to be configured.
- `camofox_hover` — Hover over an element to trigger tooltips, dropdown menus, or hover states. Use ref from snapshot or CSS selector.
- `camofox_wait_for` — Wait for page to be fully ready (DOM loaded, network idle, framework hydration complete). Use after navigation or actions that trigger page changes.
- `camofox_press_key` — Press a keyboard key. Use after type_text to submit forms (Enter), navigate between elements (Tab), move through suggestions (ArrowDown/ArrowUp), or dismiss dialogs (Escape). Common keys: Enter, Tab, Escape, ArrowDown, ArrowUp, Backspace, Space.

### Observation (4)

- `snapshot` — Get accessibility tree snapshot — the PRIMARY way to read page content. Returns element refs, roles, names and values. Token-efficient. Always prefer over screenshot. Element refs are used with click and type_text.
- `screenshot` — Take visual screenshot in base64 PNG. Use ONLY for visual verification (CSS, layout, proof). Prefer snapshot for most tasks — much more token-efficient.
- `get_links` — Get all hyperlinks on page with URLs and text. Useful for navigation discovery and site mapping.
- `camofox_wait_for_text` — Wait for specific text to appear on the page. Useful for waiting for search results, form submissions, or dynamic content loading.

### Downloads (3)

- `list_downloads` — List downloaded files with optional filtering by tab, status, extension, MIME type, and size range. Each download includes contentUrl for direct file retrieval.
- `get_download` — Get a downloaded file. Images are always returned as viewable images. Recommended for AI agents: set includeContent=true to get non-image file content as base64 inline (max 256KB). Otherwise returns metadata only (including contentUrl).
- `delete_download` — Delete a downloaded file from disk and registry.

### Extraction (3)

- `extract_resources` — Extract resources (images, links, media, documents) from a specific DOM container. Use a CSS selector or element ref from snapshot to scope extraction to a particular section of the page. This is useful for extracting all images from a specific post, all links from a table, etc.
- `batch_download` — Extract resources from a DOM container and download them all. Combines extract_resources + download in one call. Useful for downloading all images from a chat, all PDFs from a table, etc.
- `resolve_blobs` — Resolve blob: URLs to downloadable base64 data. Blob URLs are temporary browser objects (common in Telegram, WhatsApp, Discord) that cannot be downloaded directly. This tool converts them to base64 data URIs.

### Search (1)

- `web_search` — Search the web via 14 engines: google, youtube, amazon, bing, duckduckgo, reddit, github, stackoverflow, wikipedia, twitter, linkedin, facebook, instagram, tiktok. Call snapshot after to read results.

### Session (3)

- `import_cookies` — Import cookies for authenticated sessions. Provide cookies in a JSON string array. Restores login sessions without re-auth. Requires userId.
- `get_stats` — Get session statistics: request counts, active tabs, uptime, performance metrics.
- `camofox_close_session` — Close all browser tabs for a user session. Use for complete cleanup when done with a browsing session.

### Batch workflows (6)

- `fill_form` — Fill multiple form fields in one call. Provide an array of field entries, each with a ref or CSS selector and the text to type. Optionally specify a submit button to click after filling.
- `type_and_submit` — Type text into a field and press a key (default: Enter). Useful for search boxes and single-field forms.
- `navigate_and_snapshot` — Navigate to a URL and return the page snapshot. Combines navigate + wait + snapshot into one call.
- `scroll_and_snapshot` — Scroll the page and take a snapshot. Useful for revealing content below the fold.
- `camofox_scroll_element_and_snapshot` — Scroll a container element AND take a snapshot. Combines scroll_element + snapshot in one call. Perfect for incrementally loading lazy content in modals (e.g. Facebook group post comments). Returns both scroll position and page snapshot.
- `batch_click` — Click multiple elements sequentially. Continues on error (clicks are independent). Returns per-click results.

### Profiles (4)

- `save_profile` — Save browser cookies from an active tab to a named profile on disk. Enables session persistence across restarts. Use after login to save authenticated state.
- `load_profile` — Load a saved profile's cookies into an active browser tab. Restores login sessions without re-authentication. Use after create_tab to restore saved state.
- `list_profiles` — List all saved browser profiles with metadata. Shows profile names, cookie counts, save dates, and descriptions.
- `delete_profile` — Delete a saved browser profile from disk. Removes the profile's cookie data permanently.

### Presets (1)

- `list_presets` — List all available geo presets supported by the CamoFox server. Presets include locale, timezone, and optional geolocation.

## What makes CamoFox unique

- Stealth-first architecture for AI agents that need reliability on hostile sites
- Rich tool surface (41 tools) combining low-level controls + high-level workflows
- Snapshot-first design that reduces token burn while preserving actionable context
- Built-in profile/session controls for long-running authenticated automations
- Native HTTP MCP endpoint for OpenClaw and remote MCP-compatible clients
