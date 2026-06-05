#!/usr/bin/env bash
# Smoke test for the Speechace scoring API. Records 3s from the default mic,
# uploads it to the deployed scoring endpoint, and prints the result.
#
# Usage:
#   API_URL=https://sona-yourdeploy.vercel.app ./scripts/test-speechace.sh rabbit R
# Or, against a local `next dev`:
#   API_URL=http://localhost:3000 ./scripts/test-speechace.sh rabbit R
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
TEXT="${1:-rabbit}"
TARGET_SOUND="${2:-R}"

if ! command -v sox >/dev/null 2>&1; then
  echo "Install sox first: brew install sox  (Mac)  /  apt-get install sox  (Linux)"
  exit 1
fi

TMP="$(mktemp -d)"
WAV="$TMP/sample.wav"

echo "Recording 3s — say: \"$TEXT\""
sox -d -r 16000 -c 1 "$WAV" trim 0 3

echo "Uploading to $API_URL/api/score …"
curl -sS -X POST "$API_URL/api/score" \
  -F "audio=@$WAV;type=audio/wav" \
  -F "text=$TEXT" \
  -F "targetSound=$TARGET_SOUND" \
  -F "userId=smoketest" | python3 -m json.tool
