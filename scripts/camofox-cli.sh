#!/usr/bin/env bash
# CamoFox CLI — Interactive API testing tool for camofox-mcp developers
# Usage: ./scripts/camofox-cli.sh [--url URL] [--port PORT]

set -euo pipefail

CAMOFOX_PORT="${CAMOFOX_PORT:-9377}"
CAMOFOX_URL="http://localhost:${CAMOFOX_PORT}"
TAB_ID=""
SESSION_KEY=$(uuidgen | tr '[:upper:]' '[:lower:]')
USER_ID="${CAMOFOX_USER_ID:-cli-user}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse args
URL=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --url) URL="${2:-}"; shift 2 ;;
    --port)
      CAMOFOX_PORT="${2:-}";
      CAMOFOX_URL="http://localhost:${CAMOFOX_PORT}";
      shift 2
      ;;
    --help|-h)
      echo "CamoFox CLI — Interactive API testing tool"
      echo "Usage: $0 [--url URL] [--port PORT]"
      echo ""
      echo "Env:"
      echo "  CAMOFOX_PORT     Port override (default: 9377)"
      echo "  CAMOFOX_USER_ID  userId passed to the API (default: cli-user)"
      echo "  CAMOFOX_API_KEY  Optional; only used for session cookie import fallback"
      echo ""
      echo "Options:"
      echo "  --url URL    Open this URL in a new tab"
      echo "  --port PORT  CamoFox port (default: 9377)"
      echo ""
      echo "Commands (interactive):"
      echo "  open URL               Open URL in new tab"
      echo "  snap                   Take snapshot (accessibility tree)"
      echo "  type REF TEXT          Type text into element"
      echo "  click REF              Click element"
      echo "  cookies                Export cookies to file"
      echo "  cookies export [FILE]  Export cookies (optional filename)"
      echo "  cookies import FILE    Import cookies from file"
      echo "  close                  Close current tab"
      echo "  quit                   Exit"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# --- helpers ---
API_STATUS=""
API_BODY=""

json_string() {
  python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "${1-}"
}

api_request() {
  local method="$1"
  local path="$2"
  local body="${3-}"
  local content_type="${4-application/json}"
  local url="${CAMOFOX_URL}${path}"

  local tmp
  tmp=$(mktemp)

  local status
  if [[ -n "$body" ]]; then
    status=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
      -H "Content-Type: ${content_type}" \
      --data-binary "$body" \
      "$url" || echo "000")
  else
    status=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
      "$url" || echo "000")
  fi

  API_STATUS="$status"
  API_BODY=$(cat "$tmp")
  rm -f "$tmp"
}

require_tab() {
  if [[ -z "$TAB_ID" ]]; then
    echo -e "${RED}No tab open. Use 'open URL' first.${NC}"
    return 1
  fi
}

# Check CamoFox is running
check_health() {
  api_request GET "/health"
  if [[ "$API_STATUS" != "200" ]]; then
    echo -e "${RED}Error: CamoFox not running on ${CAMOFOX_URL}${NC}"
    echo "Start CamoFox browser first."
    if [[ -n "$API_BODY" ]]; then
      echo ""
      echo "$API_BODY"
    fi
    exit 1
  fi
  echo -e "${GREEN}CamoFox connected${NC}"
}

# Create tab
open_tab() {
  local url="$1"
  if [[ -z "$url" ]]; then
    echo -e "${RED}Usage: open URL${NC}"
    return 1
  fi

  local payload
  payload=$(printf '{"url":%s,"sessionKey":%s,"userId":%s}' \
    "$(json_string "$url")" \
    "$(json_string "$SESSION_KEY")" \
    "$(json_string "$USER_ID")")

  api_request POST "/tabs" "$payload"

  if [[ "$API_STATUS" != "200" && "$API_STATUS" != "201" ]]; then
    echo -e "${RED}Failed to create tab (HTTP $API_STATUS)${NC}"
    echo "$API_BODY"
    return 1
  fi

  TAB_ID=$(printf '%s' "$API_BODY" | python3 -c 'import json,sys
try:
  d=json.load(sys.stdin)
except Exception:
  print("")
  raise SystemExit(0)
print(d.get("tabId") or d.get("id") or (d.get("tab") or {}).get("id") or "")' 2>/dev/null || true)

  if [[ -z "$TAB_ID" ]]; then
    echo -e "${RED}Failed to parse tab ID from response:${NC}"
    echo "$API_BODY"
    return 1
  fi

  echo -e "${GREEN}Tab created: ${TAB_ID}${NC}"
  echo -e "${CYAN}URL: ${url}${NC}"
  sleep 2
}

# Snapshot
take_snapshot() {
  require_tab || return 1

  echo -e "${BLUE}--- Snapshot ---${NC}"
  api_request GET "/tabs/${TAB_ID}/snapshot?userId=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$USER_ID")"

  if [[ "$API_STATUS" != "200" ]]; then
    echo -e "${RED}Snapshot failed (HTTP $API_STATUS)${NC}"
    echo "$API_BODY"
    return 1
  fi

  echo "$API_BODY"
  echo -e "${BLUE}--- End ---${NC}"
}

# Type text
type_text() {
  local ref="$1"
  local text="$2"
  require_tab || return 1

  if [[ -z "$ref" || -z "$text" ]]; then
    echo -e "${RED}Usage: type REF TEXT${NC}"
    return 1
  fi

  local payload
  payload=$(printf '{"ref":%s,"text":%s,"userId":%s}' \
    "$(json_string "$ref")" \
    "$(json_string "$text")" \
    "$(json_string "$USER_ID")")

  api_request POST "/tabs/${TAB_ID}/type" "$payload"
  if [[ "$API_STATUS" != "200" && "$API_STATUS" != "204" ]]; then
    echo -e "${RED}Type failed (HTTP $API_STATUS)${NC}"
    echo "$API_BODY"
    return 1
  fi
}

# Click
click_element() {
  local ref="$1"
  require_tab || return 1

  if [[ -z "$ref" ]]; then
    echo -e "${RED}Usage: click REF${NC}"
    return 1
  fi

  local payload
  payload=$(printf '{"ref":%s,"userId":%s}' \
    "$(json_string "$ref")" \
    "$(json_string "$USER_ID")")

  api_request POST "/tabs/${TAB_ID}/click" "$payload"
  if [[ "$API_STATUS" != "200" ]]; then
    echo -e "${RED}Click failed (HTTP $API_STATUS)${NC}"
    echo "$API_BODY"
    return 1
  fi

  echo "$API_BODY"
}

# Export cookies
export_cookies() {
  local filename="${1-}"
  require_tab || return 1

  if [[ -z "$filename" ]]; then
    filename="cookies-${TAB_ID}-$(date +%s).json"
  fi

  api_request GET "/tabs/${TAB_ID}/cookies?userId=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$USER_ID")"

  if [[ "$API_STATUS" != "200" ]]; then
    echo -e "${RED}Cookie export failed (HTTP $API_STATUS)${NC}"
    echo "$API_BODY"
    return 1
  fi

  printf '%s' "$API_BODY" > "$filename"
  echo -e "${GREEN}Cookies saved to ${filename}${NC}"
}

# Import cookies
import_cookies() {
  local file="$1"
  require_tab || return 1

  if [[ -z "$file" || ! -f "$file" ]]; then
    echo -e "${RED}Usage: cookies import FILE${NC}"
    return 1
  fi

  local raw
  raw=$(cat "$file")

  # Try tab-scoped cookies endpoint first (if supported by the browser API)
  api_request POST "/tabs/${TAB_ID}/cookies" "$raw"

  if [[ "$API_STATUS" == "200" || "$API_STATUS" == "204" ]]; then
    echo -e "${GREEN}Cookies imported into tab${NC}"
    return 0
  fi

  # Some CamoFox builds use a session-scoped import that requires an API key.
  if [[ -n "${CAMOFOX_API_KEY:-}" ]]; then
    local payload
    payload=$(printf '{"cookies":%s}' "$(json_string "$raw")")

    # Include API key headers.
    local tmp
    tmp=$(mktemp)
    local status
    status=$(curl -sS -o "$tmp" -w "%{http_code}" -X POST \
      -H "Content-Type: application/json" \
      -H "x-api-key: ${CAMOFOX_API_KEY}" \
      -H "authorization: Bearer ${CAMOFOX_API_KEY}" \
      --data-binary "$payload" \
      "${CAMOFOX_URL}/sessions/${USER_ID}/cookies" || echo "000")

    local resp
    resp=$(cat "$tmp")
    rm -f "$tmp"

    if [[ "$status" == "200" || "$status" == "204" ]]; then
      echo -e "${GREEN}Cookies imported into session (${USER_ID})${NC}"
      return 0
    fi

    echo -e "${RED}Cookie import failed (tab HTTP $API_STATUS; session HTTP $status)${NC}"
    echo "$resp"
    return 1
  fi

  echo -e "${RED}Cookie import failed (HTTP $API_STATUS)${NC}"
  echo "$API_BODY"
  echo ""
  echo "Note: If your CamoFox build uses /sessions/:userId/cookies, set CAMOFOX_API_KEY and retry."
  return 1
}

# Close tab
close_tab() {
  require_tab || return 1

  local payload
  payload=$(printf '{"userId":%s}' "$(json_string "$USER_ID")")

  api_request DELETE "/tabs/${TAB_ID}" "$payload"

  if [[ "$API_STATUS" != "200" && "$API_STATUS" != "204" ]]; then
    echo -e "${RED}Close failed (HTTP $API_STATUS)${NC}"
    echo "$API_BODY"
    return 1
  fi

  echo -e "${GREEN}Tab closed${NC}"
  TAB_ID=""
}

# Main
check_health

if [[ -n "$URL" ]]; then
  open_tab "$URL"
  take_snapshot || true
fi

# Interactive loop
echo -e "${YELLOW}CamoFox CLI ready. Type 'help' for commands.${NC}"
while true; do
  echo -ne "${CYAN}camofox> ${NC}"
  if ! read -r cmd args; then
    echo ""
    break
  fi

  case "$cmd" in
    open)
      if [[ -n "$TAB_ID" ]]; then close_tab || true; fi
      open_tab "${args:-}" && take_snapshot || true
      ;;
    snap|snapshot)
      take_snapshot || true
      ;;
    type)
      ref=$(printf '%s' "${args:-}" | awk '{print $1}')
      text=$(printf '%s' "${args:-}" | cut -d' ' -f2-)
      type_text "${ref:-}" "${text:-}" || true
      ;;
    click)
      click_element "${args:-}" || true
      ;;
    cookies)
      sub=$(printf '%s' "${args:-}" | awk '{print $1}')
      rest=$(printf '%s' "${args:-}" | cut -d' ' -f2-)

      case "$sub" in
        ""|export)
          export_cookies "${rest:-}" || true
          ;;
        import)
          import_cookies "${rest:-}" || true
          ;;
        *)
          echo -e "${RED}Usage: cookies [export [FILE]] | cookies import FILE${NC}"
          ;;
      esac
      ;;
    close)
      close_tab || true
      ;;
    help)
      echo "Commands:"
      echo "  open URL               Open URL in new tab"
      echo "  snap                   Take page snapshot"
      echo "  type REF TEXT          Type text into element ref"
      echo "  click REF              Click element ref"
      echo "  cookies                Export cookies to file"
      echo "  cookies export [FILE]  Export cookies (optional filename)"
      echo "  cookies import FILE    Import cookies from file"
      echo "  close                  Close current tab"
      echo "  quit                   Exit"
      ;;
    quit|exit|q)
      if [[ -n "$TAB_ID" ]]; then close_tab || true; fi
      echo -e "${GREEN}Bye!${NC}"
      exit 0
      ;;
    "")
      continue
      ;;
    *)
      echo -e "${RED}Unknown command: ${cmd}. Type 'help' for commands.${NC}"
      ;;
  esac
done

if [[ -n "$TAB_ID" ]]; then
  close_tab || true
fi
