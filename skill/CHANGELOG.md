# Changelog

All notable changes to this ClawHub skill package will be documented in this file.

## [1.15.0] - 2026-08-13

- Updated package metadata from 1.14.5 to 1.15.0.
- Updated compatibility guidance to recommend `camofox-browser` 2.4.7+ and document Windows x64 headless portable support.
- Documented full-page screenshots and aligned `web_search` with the browser's 14 supported macros.

## [1.14.5] - 2026-06-17

- Updated package metadata from 1.14.4 to 1.14.5.
- Updated compatibility guidance to recommend `camofox-browser` 2.4.6+ so fresh installs use the Camoufox-compatible Playwright protocol dependency.

## [1.14.4] - 2026-05-25

- Updated package metadata from 1.14.3 to 1.14.4.
- Documented browser `CAMOFOX_AUTH_MODE=disabled` compatibility for trusted private networks where CamoFox MCP leaves `CAMOFOX_API_KEY` unset.

## [1.14.3] - 2026-05-24

- Documented `CAMOFOX_VIEWPORT` / `--viewport` default viewport configuration and bounds for new tabs.

## [1.14.2] - 2026-05-23

- Updated package metadata from 1.14.1 to 1.14.2.
- Updated compatibility guidance to require `camofox-browser` 2.4.4+ for first-tab persistent-context reuse.
- Clarified `create_tab` guidance for camofox CLI default context sharing with `userId: "cli-default"` and `sessionKey: "default"`, including the current limitation that MCP does not attach to an already-open CLI tab.
- Added viewport/display-size guidance for headed windows.

## [1.14.1] - 2026-05-13

- Updated package metadata from 1.14.0 to 1.14.1.
- Updated compatibility guidance to require `camofox-browser` 2.4.3+ for session-level proxy launch wiring.

## [1.14.0] - 2026-05-13

- Updated package metadata from 1.13.2 to 1.14.0.
- Updated the tool catalog from 46 to 47 tools.
- Added `extract_structured` to match camofox-browser structured extraction.
- Updated `create_tab` guidance for `sessionKey`, proxy, and geo overrides.

## [1.13.2] - 2026-05-12

- Updated package metadata from 1.10.0 to 1.13.2.
- Updated the tool catalog from 41 to 46 tools.
- Added current HTTP transport security guidance for inbound Bearer authentication.
- Updated release guidance to match the hardened HTTP transport and current runtime dependency baseline.

## [1.10.0] - 2026-02-25

- Initial ClawHub skill package release.
- Added `SKILL.md` with setup guidance, trigger phrases, and complete 41-tool catalog.
- Added MCP `manifest.yaml` with HTTP server declaration and all tool metadata.
- Added `setup.sh` helper script for launching CamoFox MCP in HTTP mode.
