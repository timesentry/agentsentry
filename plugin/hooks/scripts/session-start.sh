#!/bin/bash
# AgentSentry Plugin — SessionStart hook
# Loads the agent API key from .agentsentry config into the session environment.
# Runs at session start so credentials are available when SessionEnd fires.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -z "$CWD" ]; then
  exit 0
fi

# Walk up from CWD to find .agentsentry
CONFIG_FILE=""
SEARCH_DIR="$CWD"
while [ -n "$SEARCH_DIR" ]; do
  if [ -f "${SEARCH_DIR}/.agentsentry" ]; then
    CONFIG_FILE="${SEARCH_DIR}/.agentsentry"
    break
  fi
  PARENT=$(dirname "$SEARCH_DIR")
  [ "$PARENT" = "$SEARCH_DIR" ] && break
  SEARCH_DIR="$PARENT"
done

if [ -z "$CONFIG_FILE" ]; then
  if [ -f "$HOME/.agentsentry" ]; then
    CONFIG_FILE="$HOME/.agentsentry"
  else
    exit 0
  fi
fi

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    echo "export ${key}='${value}'" >> "$CLAUDE_ENV_FILE"
  done < "$CONFIG_FILE"
fi

exit 0
