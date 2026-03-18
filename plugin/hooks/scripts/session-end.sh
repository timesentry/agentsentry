#!/bin/bash
# AgentSentry Plugin — SessionEnd hook
# Ships the session transcript to your AgentSentry instance.
# Uses fire-and-forget (background curl) so session exit isn't blocked.

INPUT=$(cat)

TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
SESSION_ID=$(echo "$INPUT"      | jq -r '.session_id // empty')
CWD=$(echo "$INPUT"             | jq -r '.cwd // empty')

if [ -z "$TRANSCRIPT_PATH" ] || [ -z "$SESSION_ID" ] || [ -z "$CWD" ]; then
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

while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  export "${key}=${value}"
done < "$CONFIG_FILE"

if [ -z "${AGENTSENTRY_API_KEY:-}" ]; then
  exit 0
fi

if [ ! -f "$TRANSCRIPT_PATH" ]; then
  exit 0
fi

API_URL="${AGENTSENTRY_URL:-http://localhost:5000}"

(
  jq -n --arg sid "$SESSION_ID" --rawfile t "$TRANSCRIPT_PATH" \
    '{session_id: $sid, transcript: $t}' \
  | curl -s -X POST "${API_URL}/api/v1/sessions/" \
      -H "Authorization: Bearer ${AGENTSENTRY_API_KEY}" \
      -H "Content-Type: application/json" \
      -d @- \
      > /dev/null 2>&1
) &

exit 0
