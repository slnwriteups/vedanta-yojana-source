#!/bin/bash
# One-off/occasional maintenance tool -- NOT part of the build pipeline.
# Run manually, then commit the result, then regenerate the mobile image
# manifest (see the reminder this script prints at the end). Requires
# macOS/cwebp (`brew install webp`) -- a deliberate, disclosed platform
# dependency for a script that runs on a developer machine occasionally,
# not in CI on every build. Mirrors scripts/optimize-images.sh's own
# conventions and doc-comment style.
#
# What it does, and why:
#   Converts core Divya Desam JPEG photographs to WebP at quality 80,
#   per-file, ONLY when the WebP result is actually smaller than the
#   original JPEG. Measured directly (see the task's own audit): WebP
#   beats JPEG by 30-60% on medium/large photographic images, but on the
#   many already-tiny thumbnails in this corpus (under ~10KB), WebP's own
#   container overhead makes it LARGER than the JPEG it would replace --
#   so this is not a blind bulk conversion, it is a per-file race that
#   only ever keeps the smaller result. A file is left as the original
#   JPEG, completely untouched, whenever WebP does not win.
#
# Scope: ONLY images actually referenced by a real content/divya-desams/
# record (an image's sourceAssetUuid must appear in some record's
# `images[]`). This deliberately excludes Pasuram-irrelevant book-
# exclusive images and the one Knowledge image living in the same
# public/images/ directory -- this script is scoped to core Divya Desam
# photography only, matching the task that introduced it. The DD-
# reference set is derived fresh from content/divya-desams/*.json on
# every run (never a hand-maintained/checked-in list), the same
# principle mobile/scripts/generate-content-manifest.ts's own
# coreImageUuids computation already follows.
#
# Alpha-channel PNGs (transparent UI/icon artwork) are never touched --
# this script only ever looks at .jpg/.jpeg files. A non-JPEG file with a
# .jpg extension (a real, pre-existing data anomaly this script's own
# audit found: one Divya Desam image is actually GIF data under a .jpg
# name) is skipped with a warning, not guessed at or "fixed" here.
#
# content/*.json records reference images purely by sourceAssetUuid
# (the filename's basename), never by extension -- both the web loader
# (lib/image-file.ts's resolveImageHref) and the mobile manifest
# generator (mobile/scripts/generate-content-manifest.ts) already
# resolve a UUID to whatever extension the file on disk actually has,
# and both already list .webp as a supported extension. Converting a
# file's extension from .jpg to .webp therefore requires no change to
# any content file -- only regenerating the mobile image manifest
# afterward.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGES_DIR="${1:-$REPO_ROOT/public/images}"
CONTENT_DIR="${2:-$REPO_ROOT/content/divya-desams}"
WEBP_QUALITY=80

if ! command -v cwebp >/dev/null 2>&1; then
  echo "error: cwebp not found -- install with 'brew install webp'." >&2
  exit 1
fi

# The core Divya Desam sourceAssetUuid set, derived fresh from content/
# on every run -- never a stale hand-maintained list.
UUID_LIST_FILE="$(mktemp)"
trap 'rm -f "$UUID_LIST_FILE"' EXIT
node --experimental-strip-types -e '
const fs = require("fs");
const path = require("path");
const dir = process.argv[1];
const uuids = new Set();
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".json")) continue;
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const img of data.images || []) uuids.add(img.sourceAssetUuid.toLowerCase());
}
process.stdout.write([...uuids].sort().join("\n") + "\n");
' "$CONTENT_DIR" > "$UUID_LIST_FILE"

converted=0
kept_jpeg_no_gain=0
skipped_not_core=0
skipped_invalid=0
orig_total=0
new_total=0

for f in "$IMAGES_DIR"/*.jpg "$IMAGES_DIR"/*.jpeg; do
  [ -e "$f" ] || continue
  base_noext="$(basename "$f")"
  base_noext="${base_noext%.*}"
  uuid_lower="$(echo "$base_noext" | tr '[:upper:]' '[:lower:]')"

  if ! grep -qx "$uuid_lower" "$UUID_LIST_FILE"; then
    skipped_not_core=$((skipped_not_core + 1))
    continue
  fi

  orig_size=$(stat -f%z "$f")
  candidate="${f%.*}.webp.tmp"

  if ! cwebp -q "$WEBP_QUALITY" -quiet "$f" -o "$candidate" 2>/dev/null; then
    rm -f "$candidate"
    skipped_invalid=$((skipped_invalid + 1))
    echo "skipped (not a valid JPEG -- see doc comment): $(basename "$f")"
    continue
  fi

  webp_size=$(stat -f%z "$candidate")
  orig_total=$((orig_total + orig_size))

  if [ "$webp_size" -lt "$orig_size" ]; then
    final="${f%.*}.webp"
    mv "$candidate" "$final"
    rm "$f"
    converted=$((converted + 1))
    new_total=$((new_total + webp_size))
    echo "converted (JPEG->WebP, ${orig_size} -> ${webp_size} bytes): $(basename "$f") -> $(basename "$final")"
  else
    rm -f "$candidate"
    kept_jpeg_no_gain=$((kept_jpeg_no_gain + 1))
    new_total=$((new_total + orig_size))
  fi
done

echo ""
echo "Converted JPEG->WebP: $converted"
echo "Kept as JPEG (WebP was not smaller): $kept_jpeg_no_gain"
echo "Skipped (not a core Divya Desam image): $skipped_not_core"
echo "Skipped (invalid/non-JPEG data under a .jpg name): $skipped_invalid"
echo ""
echo "Original total (converted+kept files only): $((orig_total / 1024)) KB"
echo "New total: $((new_total / 1024)) KB"
echo "Savings: $(( (orig_total - new_total) / 1024 )) KB"
echo ""
echo "Next: regenerate the mobile image manifest --"
echo "  node mobile/scripts/generate-content-manifest.ts"
