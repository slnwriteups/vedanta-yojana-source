#!/bin/bash
# One-off/occasional maintenance tool -- NOT part of the build pipeline.
# Run manually after adding new photos to public/images/, then commit
# the result. Requires macOS (uses the built-in `sips` tool) -- this is
# a deliberate, disclosed platform dependency for a script that runs on
# a developer machine occasionally, not in CI on every build.
#
# What it does, and why:
#   - A PNG with no alpha channel is pure photographic content stored in
#     a lossless format that gains it nothing (no transparency to
#     preserve) while costing several times the size a JPEG at the same
#     visual quality would. These are converted to JPEG.
#   - Any image (JPEG, or newly converted from PNG) larger than
#     MAX_DIMENSION on its long edge is downsampled. The image zoom
#     viewer (mobile/components/ImageViewerModal.tsx) renders at up to
#     ~92% of screen width and zooms up to 4x; MAX_DIMENSION is chosen
#     to comfortably cover normal viewing and most zoomed viewing on
#     real phone screens without preserving far more resolution than
#     any actual on-screen use ever needs.
#   - A PNG WITH an alpha channel (transparent UI artwork) is left
#     completely untouched -- format and dimensions unchanged.
#   - sips's own resample is a downsample-only operation for a max
#     dimension already at or below the target, so this is safe to run
#     repeatedly / on an already-optimized directory without harm.
#
# IMPORTANT sips quirk: `--resampleHeightWidthMax` combined with
# `--setProperty format/formatOptions` in the SAME invocation silently
# produces a far larger, much-less-compressed file than requesting the
# same quality alone (confirmed by direct measurement: identical quality
# value, 3-4x size difference on a PNG->JPEG conversion). Resizing and
# format/quality conversion are therefore always done as two separate
# sips calls below -- never combined in one.
#
# content/*.json records reference images purely by sourceAssetUuid
# (the filename's basename), never by extension -- both the web loader
# (lib/image-file.ts's resolveImageHref) and the mobile manifest
# generator (mobile/scripts/generate-content-manifest.ts) resolve a UUID
# to whatever extension the file on disk actually has. Converting a
# PNG's extension to .jpg therefore requires no change to any content
# file -- only regenerating mobile's generated image manifest afterward
# (see the reminder this script prints at the end).

set -euo pipefail

IMAGES_DIR="${1:-public/images}"
MAX_DIMENSION=2000
JPEG_QUALITY=82

if ! command -v sips >/dev/null 2>&1; then
  echo "error: sips not found -- this script requires macOS." >&2
  exit 1
fi

converted=0
resized=0
unchanged=0

for f in "$IMAGES_DIR"/*.png; do
  [ -e "$f" ] || continue
  has_alpha=$(sips -g hasAlpha "$f" 2>/dev/null | awk '/hasAlpha/{print $2}')
  if [ "$has_alpha" = "no" ]; then
    base="${f%.png}"
    tmp="${base}.jpg.tmp"
    tmp2="${base}.jpg.tmp2"

    w=$(sips -g pixelWidth "$f" 2>/dev/null | awk '/pixelWidth/{print $2}')
    h=$(sips -g pixelHeight "$f" 2>/dev/null | awk '/pixelHeight/{print $2}')
    max=$(( w > h ? w : h ))

    if [ "$max" -gt "$MAX_DIMENSION" ]; then
      sips --resampleHeightWidthMax "$MAX_DIMENSION" "$f" --out "$tmp2" >/dev/null 2>&1
      sips --setProperty format jpeg --setProperty formatOptions "$JPEG_QUALITY" "$tmp2" --out "$tmp" >/dev/null 2>&1
      rm -f "$tmp2"
    else
      sips --setProperty format jpeg --setProperty formatOptions "$JPEG_QUALITY" "$f" --out "$tmp" >/dev/null 2>&1
    fi

    mv "$tmp" "${base}.jpg"
    rm "$f"
    converted=$((converted + 1))
    echo "converted (PNG->JPEG): $(basename "$f") -> $(basename "${base}.jpg")"
  fi
done

for f in "$IMAGES_DIR"/*.jpg "$IMAGES_DIR"/*.jpeg; do
  [ -e "$f" ] || continue
  w=$(sips -g pixelWidth "$f" 2>/dev/null | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$f" 2>/dev/null | awk '/pixelHeight/{print $2}')
  max=$(( w > h ? w : h ))
  if [ "$max" -gt "$MAX_DIMENSION" ]; then
    tmp="${f}.tmp"
    tmp2="${f}.tmp2"
    sips --resampleHeightWidthMax "$MAX_DIMENSION" "$f" --out "$tmp2" >/dev/null 2>&1
    sips --setProperty formatOptions "$JPEG_QUALITY" "$tmp2" --out "$tmp" >/dev/null 2>&1
    rm -f "$tmp2"
    mv "$tmp" "$f"
    resized=$((resized + 1))
    echo "resized: $(basename "$f") (was ${w}x${h})"
  else
    unchanged=$((unchanged + 1))
  fi
done

echo ""
echo "Converted PNG->JPEG: $converted"
echo "Resized oversized JPEG: $resized"
echo "Left unchanged (already within ${MAX_DIMENSION}px, or has transparency): $unchanged"
echo ""
echo "Next: regenerate the mobile image manifest --"
echo "  node mobile/scripts/generate-content-manifest.ts"
