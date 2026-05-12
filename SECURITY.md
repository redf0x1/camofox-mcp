# Security Policy

## Reporting a Vulnerability

Do not open a public issue with exploit details, credentials, tokens, private data, or weaponized proof-of-concept code.

Report suspected vulnerabilities through GitHub Private Vulnerability Reporting for this repository:

https://github.com/redf0x1/camofox-mcp/security/advisories/new

Include:

- affected version or commit
- affected transport or tool
- deployment assumptions, such as stdio, HTTP loopback, Docker, or public HTTP bind
- impact and preconditions
- minimal reproduction steps or a non-destructive proof of concept

We will triage privately, coordinate a fix, and publish public details only after users have a safe upgrade path.

## Supported Versions

Security fixes target the current release line and `main`.

## Security Boundaries

CamoFox MCP exposes browser-control tools to MCP clients. Treat HTTP transport as a control surface:

- keep stdio for local desktop clients when possible
- keep HTTP transport bound to loopback unless a remote MCP client requires network access
- set `CAMOFOX_HTTP_API_KEY` for inbound HTTP MCP clients when binding beyond loopback
- set `CAMOFOX_API_KEY` separately when the CamoFox Browser server requires authentication
- protect saved profiles because they can contain sensitive cookies
