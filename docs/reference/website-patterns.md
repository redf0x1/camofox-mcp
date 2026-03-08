# Website Patterns - Tested Sites & Recommended Approaches

## Overview

Different site classes expose very different amounts of accessible structure. In CamoFox, that usually determines whether refs from `snapshot` are enough on their own, or whether you should pivot to CSS selectors and live-DOM tools.

The recommendations below use verified test evidence captured on 2026-03-08. Where the test evidence reported qualitative coverage rather than an exact percentage, this page preserves that wording instead of inventing a number.

## Working Rules by Site Type

- Start with `snapshot` on every site. It is the cheapest read path and gives you refs when the accessibility tree is strong.
- Switch to CSS selectors when key inputs or controls are missing from the snapshot, especially on combobox-heavy or custom-component UIs.
- Re-snapshot after major UI transitions, SPA route changes, modal opens, or infinite-scroll loads because ref positions can drift.
- Use `camofox_wait_for_selector`, `camofox_wait_for_text`, or `camofox_wait_for` before interacting with lazy or hydrated content.
- Use download and extraction tools directly on media-heavy sites instead of scripting every individual click.

## Site Matrix

### example.com (example.com)

- **Type**: Static HTML
- **Ref Coverage**: 20% (about 1 of 5 key elements)
- **Key Elements**: Main example link has a working ref; most surrounding content is plain text
- **Recommended Approach**:
  - Read content with `snapshot`
  - Use the link ref when it is present
  - Prefer CSS selectors for any precise targeting beyond the primary link
- **Known Issues**: Very low ref density; limited benefit from ref-driven workflows
- **Best Tools**: `snapshot` -> `click(ref)` or `click(selector)`
- **Verification Notes**: Ref interaction succeeded on the available link
- **Last Tested**: CamoFox Browser v2.1.0 on 2026-03-08

### Google (google.com)

- **Type**: Search Engine
- **Ref Coverage**: 74% (20 of about 27 tested elements)
- **Key Elements**: Navigation links are generally covered; the main search combobox was the important gap in the test run
- **Recommended Approach**:
  - Use `snapshot` first for links, buttons, and top-level navigation
  - Treat the search box as a likely CSS-selector fallback target on current builds
  - Re-snapshot after the results page loads
- **Known Issues**: Combobox/select-style controls consistently lacked refs in the real-world test set
- **Best Tools**: `snapshot` -> `type_text(selector)` -> `camofox_press_key("Enter")` -> `snapshot`
- **Verification Notes**: Overall ref coverage was strong, but the key search input did not have a usable ref in the captured test evidence
- **Last Tested**: CamoFox Browser v2.1.0 on 2026-03-08

### React (react.dev)

- **Type**: React SPA
- **Ref Coverage**: About 50% (99 refs across 200+ tested elements)
- **Key Elements**: Search box had a working ref; many app-level controls were accessible, but not every rendered node mapped cleanly
- **Recommended Approach**:
  - Start with `snapshot` and use refs for obvious controls like search
  - For deeply nested UI, inspect with CSS selectors and live DOM helpers
  - Re-snapshot after client-side navigation or layout changes
- **Known Issues**: SPA re-renders can make role-plus-name based refs fragile over time
- **Best Tools**: `snapshot` -> `type_text(ref)` -> `camofox_press_key` -> `snapshot`; fallback to `camofox_wait_for_selector` + selector-based interaction when needed
- **Verification Notes**: Ref interaction succeeded on the search box
- **Last Tested**: CamoFox Browser v2.1.0 on 2026-03-08

### GitHub (github.com)

- **Type**: Dynamic Web App
- **Ref Coverage**: High (106 refs across 200+ tested elements)
- **Key Elements**: Textbox interactions were covered; navigation and major controls were broadly represented in the accessibility tree
- **Recommended Approach**:
  - Use `snapshot` as the primary read and action surface
  - Use refs for search, top navigation, and common buttons
  - Keep CSS fallback ready for dynamic overlays, autocompletes, or SPA transitions
- **Known Issues**: Large pages can still hit snapshot truncation and ref drift after dynamic updates
- **Best Tools**: `snapshot` -> `click(ref)` / `type_text(ref)` -> `camofox_wait_for` -> `snapshot`
- **Verification Notes**: Key textbox ref interaction succeeded
- **Last Tested**: CamoFox Browser v2.1.0 on 2026-03-08

### Amazon (amazon.com)

- **Type**: E-commerce
- **Ref Coverage**: Good (304 refs across 500+ tested elements)
- **Key Elements**: Search box was indexed; many product-grid and navigation elements were accessible even on a very large page
- **Recommended Approach**:
  - Use `snapshot` for search, nav, and visible product controls
  - Expect truncation on large catalog pages and paginate snapshots with `offset`
  - Re-snapshot after filters, sort changes, or pagination
- **Known Issues**: Large pages can exceed snapshot limits; some late-loaded content may need another read pass
- **Best Tools**: `snapshot` -> `type_text(ref)` -> `camofox_press_key` -> `scroll_and_snapshot` or paged `snapshot(offset)`
- **Verification Notes**: Search-box ref interaction succeeded
- **Last Tested**: CamoFox Browser v2.1.0 on 2026-03-08

## Cross-Site Findings From The 2026-03-08 Test Run

- Combobox and select-style controls were the most consistent ref gap across the tested sites.
- Static pages can expose very few refs even when interaction is simple.
- React and other SPA frameworks usually give workable but incomplete ref coverage.
- Large, dynamic pages can produce many refs and still require pagination or re-snapshotting after UI changes.
- CSS-selector fallback is not a backup-only feature; it is a normal part of reliable workflows on modern sites.

## Website Archetypes

### Static HTML Sites

- **Typical Ref Pattern**: Low ref density
- **Primary Strategy**: Read with `snapshot`, target with CSS selectors when precision matters
- **Common Failure Mode**: Important content is visible as text but not assigned an actionable ref
- **Recommended Sequence**: `snapshot` -> `camofox_get_page_html` or `camofox_query_selector` -> `click(selector)`

### Search Engines

- **Typical Ref Pattern**: Good overall top-level coverage, but search inputs may still be combobox-shaped gaps
- **Primary Strategy**: Snapshot for buttons and links, selector fallback for the search field when needed
- **Common Failure Mode**: Main search box is visible but not ref-addressable
- **Recommended Sequence**: `snapshot` -> `type_text(ref or selector)` -> `camofox_press_key("Enter")` -> `snapshot`

### React/Vue SPAs

- **Typical Ref Pattern**: Moderate coverage with occasional stale refs after rerender
- **Primary Strategy**: Use refs for first-pass actions, then switch to selector waits and re-snapshot after transitions
- **Common Failure Mode**: Refs become unstable after client-side route updates or state-heavy reflows
- **Recommended Sequence**: `snapshot` -> action by `ref` -> `camofox_wait_for_selector` or `camofox_wait_for` -> `snapshot`

### E-commerce Sites

- **Typical Ref Pattern**: Good coverage on search and visible product controls; very large page volume
- **Primary Strategy**: Snapshot-first with pagination and scroll helpers
- **Common Failure Mode**: Snapshot truncation on category, search, or product-list pages
- **Recommended Sequence**: `snapshot` -> `type_text(ref)` -> `camofox_press_key` -> `snapshot(offset)` or `scroll_and_snapshot`

### Social Media / Infinite Scroll

- **Typical Ref Pattern**: Changing coverage as new content is loaded
- **Primary Strategy**: Scroll incrementally and re-snapshot often
- **Common Failure Mode**: Refs from earlier snapshots no longer map cleanly after feed updates
- **Recommended Sequence**: `snapshot` -> `scroll_and_snapshot` or `camofox_scroll_element_and_snapshot` -> interact only on the latest snapshot

### News Sites / Lazy-Loaded Media

- **Typical Ref Pattern**: Moderate ref quality with delayed content blocks and ads
- **Primary Strategy**: Wait for key selectors or text before extracting
- **Common Failure Mode**: Article body or media block appears after initial interaction attempt
- **Recommended Sequence**: `navigate` -> `camofox_wait_for_selector` -> `snapshot` -> `extract_resources`

### Auth Dashboards

- **Typical Ref Pattern**: Usually good once authenticated, but many flows depend on persisted sessions
- **Primary Strategy**: Use profiles and cookie import first, then snapshot-driven interaction
- **Common Failure Mode**: Session reset after browser restarts or display-mode changes
- **Recommended Sequence**: `create_tab` -> `load_profile` or `import_cookies` -> `navigate` -> `snapshot`

### Download Portals

- **Typical Ref Pattern**: Mixed; download links may be easy, file metadata often needs extraction tools
- **Primary Strategy**: Use extraction plus download registry tools instead of scraping filenames manually
- **Common Failure Mode**: Blob URLs and generated downloads are not directly usable from page HTML alone
- **Recommended Sequence**: `extract_resources` -> `batch_download` -> `list_downloads` -> `get_download`

## Approach By Archetype

| Archetype | Ref Reliability | Preferred First Move | Fallback Trigger | Recommended Tool Sequence |
| --- | --- | --- | --- | --- |
| Static HTML | Low | `snapshot` | Missing actionable refs | `snapshot` -> `camofox_query_selector` -> `click(selector)` |
| Search Engine | Moderate to high overall | `snapshot` | Search input has no ref | `snapshot` -> `type_text(selector)` -> `camofox_press_key` -> `snapshot` |
| React/Vue SPA | Moderate | `snapshot` | Rerender or hydrated control mismatch | `snapshot` -> action -> `camofox_wait_for_selector` -> `snapshot` |
| E-commerce | Good but large-page heavy | `snapshot` | Truncation or late-loaded products | `snapshot` -> `snapshot(offset)` or `scroll_and_snapshot` |
| Social / Infinite Scroll | Variable | `snapshot` | New items appear after feed update | `scroll_and_snapshot` -> latest `snapshot` -> interact |
| News / Lazy Load | Moderate | `camofox_wait_for_selector` | Body/media not fully loaded | `navigate` -> `camofox_wait_for_selector` -> `snapshot` |
| Auth Dashboard | Good after login | `load_profile` or `import_cookies` | Session reset or expired auth | session restore -> `navigate` -> `snapshot` |
| Download Portal | Mixed | `extract_resources` | Blob/generated files | `extract_resources` -> `batch_download` -> `get_download` |

## Practical Guidance

- If the key control is a combobox, autocomplete, or custom div-based widget, expect selector fallback.
- If the page is large, watch for `snapshot` truncation metadata and continue with `offset` instead of assuming the page is fully represented.
- If a workflow changes the DOM significantly, treat old refs as stale and capture a fresh snapshot before the next action.
- If you are authenticated, preserve the session with `save_profile`, `load_profile`, or `import_cookies` instead of re-logging repeatedly.
