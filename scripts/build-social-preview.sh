#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VIDEO_PATH="/tmp/nvca-demo.mp4"
CANDIDATE_DIR="$ROOT_DIR/docs/assets/social-preview-candidates"
FRAME_PATH="$CANDIDATE_DIR/frame-00_15.png"
OUT_PATH="$ROOT_DIR/docs/assets/social-preview.png"
FONT_PATH="/System/Library/Fonts/Supplemental/Arial.ttf"

if [[ ! -f "$VIDEO_PATH" ]]; then
  echo "Missing source video: $VIDEO_PATH" >&2
  exit 1
fi

duration="$(/opt/homebrew/bin/ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO_PATH")"
if ! awk -v duration="$duration" 'BEGIN { exit !(duration >= 25) }'; then
  echo "Source video is shorter than 25 seconds: ${duration}s" >&2
  exit 1
fi

if [[ ! -f "$FONT_PATH" ]]; then
  echo "Missing expected system font: $FONT_PATH" >&2
  exit 1
fi

mkdir -p "$CANDIDATE_DIR"

for ts in 00:02 00:08 00:15 00:20 00:25; do
  /opt/homebrew/bin/ffmpeg -hide_banner -loglevel error -ss "$ts" -i "$VIDEO_PATH" -frames:v 1 -y "$CANDIDATE_DIR/frame-${ts/:/_}.png"
done

# frame-00_15.png keeps the Claude prompt, Open Agreements tool panel, and NVCA template id legible.
# Arial is used because it is a stable macOS system font available without adding repo dependencies.
/opt/homebrew/bin/magick -size 1280x640 xc:'#0f172a' \
  \( "$FRAME_PATH" -resize 640x640 -gravity center -background '#0f172a' -extent 640x640 \) \
  -gravity west -composite \
  -font "$FONT_PATH" \
  -fill white -pointsize 56 -interline-spacing 8 -gravity northwest -annotate +704+132 'Standard legal\ndocs, filled\nby AI' \
  -fill '#cbd5e1' -pointsize 26 -interline-spacing 8 -gravity northwest -annotate +704+400 'NDAs · SAFEs · CSAs · NVCA\nCommon Paper · Bonterms' \
  -depth 8 \
  "$OUT_PATH"

/opt/homebrew/bin/magick identify "$OUT_PATH"
