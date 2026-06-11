#!/usr/bin/env bash
# Resolve the latest Vercel deployment for a git branch and wait until READY,
# then print the exact immutable URL to test. No alias guessing, no Redeploy traps.
#
# Usage: scripts/deploy-status.sh [branch] [path]
#   branch  defaults to the current git branch
#   path    optional path to append, e.g. /avatar.html?mode=LITE
#
# Requires: VERCEL_TOKEN in the environment + network access to api.vercel.com
# (both set in the Claude Code environment; effective in a NEW session).
set -uo pipefail

PROJECT="${VERCEL_PROJECT:-sona}"
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null)}"
PATHQ="${2:-/}"
TOKEN="${VERCEL_TOKEN:-}"
API="https://api.vercel.com"

if [ -z "$TOKEN" ]; then
  echo "ERROR: VERCEL_TOKEN is not set in this shell."
  echo "Add it in the Claude Code environment (cloud env → settings gear → Environment"
  echo "variables) and start a NEW session, then re-run."
  exit 1
fi
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq not found"; exit 1; }

echo "Resolving latest deployment for branch '$BRANCH' (project '$PROJECT')…"
for i in $(seq 1 60); do
  resp=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/v6/deployments?app=$PROJECT&limit=30" 2>/dev/null)
  err=$(echo "$resp" | jq -r '.error.message // empty' 2>/dev/null)
  if [ -n "$err" ]; then echo "Vercel API error: $err"; exit 1; fi

  latest=$(echo "$resp" | jq -c --arg b "$BRANCH" \
    '[.deployments[] | select(.meta.githubCommitRef==$b)] | sort_by(.createdAt // .created) | last' 2>/dev/null)
  if [ -z "$latest" ] || [ "$latest" = "null" ]; then
    echo "  no deployment for branch yet… ($i)"; sleep 5; continue
  fi

  state=$(echo "$latest" | jq -r '.readyState // .state // "UNKNOWN"')
  url=$(echo "$latest" | jq -r '.url')
  sha=$(echo "$latest" | jq -r '(.meta.githubCommitSha // "")[0:7]')
  msg=$(echo "$latest" | jq -r '(.meta.githubCommitMessage // "") | split("\n")[0]')
  echo "  [$state] $sha  $msg"

  case "$state" in
    READY)   echo ""; echo "✅ READY → https://${url}${PATHQ}"; exit 0;;
    ERROR|CANCELED) echo "❌ deployment $state — inspect: https://${url}"; exit 2;;
    *) sleep 5;;
  esac
done
echo "Timed out waiting for READY."
exit 3
