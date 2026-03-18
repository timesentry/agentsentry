#!/bin/bash
# AgentSentry Plugin — Configuration script
# Called by the /agentsentry skill to manage the .agentsentry config file.
#
# Usage:
#   configure.sh                         → check status
#   configure.sh --apiKey tsk_xxx        → set API key (+ optional --apiUrl)
#   configure.sh --apiUrl http://...     → set server URL only
#   configure.sh status                  → show current config
#   configure.sh reset                   → delete config

set -euo pipefail

CONFIG_FILE=".agentsentry"
GITIGNORE=".gitignore"

# ── Helpers ───────────────────────────────────────────────────────────────────

ensure_gitignore() {
  if [ -f "$GITIGNORE" ]; then
    if ! grep -qxF '.agentsentry' "$GITIGNORE" 2>/dev/null; then
      echo '.agentsentry' >> "$GITIGNORE"
    fi
  else
    echo '.agentsentry' > "$GITIGNORE"
  fi
}

show_config() {
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "No .agentsentry config found."
    return
  fi
  echo "TimeSentry Config:"
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    # Mask API key
    if [[ "$key" == "AGENTSENTRY_API_KEY" ]]; then
      echo "  ${key}=${value:0:8}...${value: -4}"
    else
      echo "  ${key}=${value}"
    fi
  done < "$CONFIG_FILE"
}

# ── Parse args ────────────────────────────────────────────────────────────────

API_KEY=""
API_URL=""
COMMAND=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apiKey)
      API_KEY="$2"
      shift 2
      ;;
    --apiUrl)
      API_URL="$2"
      shift 2
      ;;
    status|reset)
      COMMAND="$1"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# ── Commands ──────────────────────────────────────────────────────────────────

if [ "$COMMAND" = "reset" ]; then
  if [ -f "$CONFIG_FILE" ]; then
    rm "$CONFIG_FILE"
    echo "Deleted .agentsentry config."
  else
    echo "No config to delete."
  fi
  exit 0
fi

if [ "$COMMAND" = "status" ]; then
  show_config
  exit 0
fi

# No args and config exists → already configured
if [ -z "$API_KEY" ] && [ -z "$API_URL" ] && [ -f "$CONFIG_FILE" ]; then
  echo "ALREADY_CONFIGURED"
  show_config
  exit 0
fi

# No args and no config → needs setup
if [ -z "$API_KEY" ] && [ -z "$API_URL" ] && [ ! -f "$CONFIG_FILE" ]; then
  echo "NEEDS_SETUP"
  exit 0
fi

# ── Write config ──────────────────────────────────────────────────────────────

# Load existing values if updating
EXISTING_KEY=""
EXISTING_URL=""
if [ -f "$CONFIG_FILE" ]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    [[ "$key" == "AGENTSENTRY_API_KEY" ]] && EXISTING_KEY="$value"
    [[ "$key" == "AGENTSENTRY_URL" ]] && EXISTING_URL="$value"
  done < "$CONFIG_FILE"
fi

FINAL_KEY="${API_KEY:-$EXISTING_KEY}"
FINAL_URL="${API_URL:-${EXISTING_URL:-http://localhost:5000}}"

if [ -z "$FINAL_KEY" ]; then
  echo "ERROR: API key is required. Use --apiKey tsk_..."
  exit 1
fi

cat > "$CONFIG_FILE" << EOF
# AgentSentry Configuration
# Powered by timesentry.ai
AGENTSENTRY_API_KEY=${FINAL_KEY}
AGENTSENTRY_URL=${FINAL_URL}
EOF

ensure_gitignore
echo "Updated .agentsentry config."
show_config
