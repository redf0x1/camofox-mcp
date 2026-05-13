# Changelog

All notable changes to this ClawHub skill package will be documented in this file.

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
