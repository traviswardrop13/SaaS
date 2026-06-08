#!/usr/bin/env bash
# Deterministically render an HTML file (or URL) to a PNG with headless chromium.
# Same flags every time → consistent mockups, zero model tokens.
#
# Usage: scripts/render-mock.sh <input.html|url> <output.png> [width] [height] [scale]
set -euo pipefail

IN="${1:?usage: render-mock.sh <input.html|url> <output.png> [w] [h] [scale]}"
OUT="${2:?output png path required}"
W="${3:-1000}"; H="${4:-720}"; SCALE="${5:-1.5}"

CHROME="${CHROME_BIN:-$(ls /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)}"
[ -n "$CHROME" ] && [ -x "$CHROME" ] || { echo "ERROR: chromium not found (set CHROME_BIN)"; exit 1; }

case "$IN" in
  http://*|https://*|file://*) URL="$IN";;
  *) URL="file://$(cd "$(dirname "$IN")" && pwd)/$(basename "$IN")";;
esac

"$CHROME" --headless --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size="$W,$H" --force-device-scale-factor="$SCALE" \
  --virtual-time-budget=4000 --screenshot="$OUT" "$URL" >/dev/null 2>&1

echo "rendered $OUT ($(stat -c%s "$OUT" 2>/dev/null || echo 0) bytes)"
