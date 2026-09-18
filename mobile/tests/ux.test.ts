import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBook, loadChapters, loadDivyaDesam, loadDivyaDesams } from "../content-lib/loader.ts";
import { buildMobileSearchCorpus } from "../content-lib/corpus.ts";
import { searchCorpus } from "../../content-lib/search/run.ts";
import { resolveTheme } from "../theme.ts";

/**
 * Phase 6C, Step 11 -- UX-layer foundation tests. Like Phase 6A/6B's test
 * files, these deliberately never import a react-native component (no RN
 * runtime under plain `node --test`) -- "main screens render" is instead
 * verified structurally (the real route files exist on disk at the
 * expected Tabs-group paths) plus, decisively, via `npx expo export`
 * in the Phase 6C validation pass, which is the only way to prove a
 * react-native screen tree actually mounts. What CAN be tested here --
 * and is -- is that nothing about the Phase 6B data guarantees regressed
 * during the Phase 6C UI rewrite.
 *
 * The image tests below deliberately do NOT import
 * content-lib/image-manifest.generated.ts: that file's whole purpose is
 * static `import x from "*.jpg"` lines for Metro's asset pipeline, and
 * Node's native module loader cannot parse a JPEG/PNG/WEBP file at all
 * (verified empirically -- ERR_UNKNOWN_FILE_EXTENSION, not a fixable
 * import-attribute gap the way JSON's was in Phase 6A). Image resolution
 * is instead checked the same way the generator itself resolves a UUID
 * to a file (plain fs, no Metro), and proven for real via `expo export`
 * in the Phase 6C validation pass (241-file output including all 217
 * images -- see the final report).
 */

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGES_ROOT = path.resolve(MOBILE_ROOT, "..", "public", "images");
const BOOK_SLUG = "untitled-recovered-book-pending-editorial-title";

test("Navigation: the (tabs) group contains a real file for every route Phase 6B established", () => {
  const expected = [
    "app/(tabs)/_layout.tsx",
    "app/(tabs)/index.tsx",
    "app/(tabs)/divya-desams/_layout.tsx",
    "app/(tabs)/divya-desams/index.tsx",
    "app/(tabs)/divya-desams/[slug].tsx",
    "app/(tabs)/divya-desams/introduction.tsx",
    "app/(tabs)/library/_layout.tsx",
    "app/(tabs)/library/index.tsx",
    "app/(tabs)/library/[book].tsx",
    "app/(tabs)/library/[book]/[chapter].tsx",
    "app/(tabs)/search.tsx",
    "app/(tabs)/settings.tsx",
  ];
  for (const relative of expected) {
    assert.ok(fs.existsSync(path.join(MOBILE_ROOT, relative)), `missing ${relative}`);
  }
});

test("Navigation: no pre-Tabs route files were left behind outside the (tabs) group", () => {
  const appDir = path.join(MOBILE_ROOT, "app");
  const entries = fs.readdirSync(appDir);
  assert.deepEqual(entries.sort(), ["(tabs)", "_layout.tsx"]);
});

test("Theme: both light and dark schemes resolve with the same set of color keys", () => {
  const light = resolveTheme("light");
  const dark = resolveTheme("dark");
  assert.equal(light.scheme, "light");
  assert.equal(dark.scheme, "dark");
  assert.deepEqual(Object.keys(light.colors).sort(), Object.keys(dark.colors).sort());
  // A real second palette, not an accidental alias of the same object.
  assert.notEqual(light.colors.background, dark.colors.background);
  assert.notEqual(light.colors.foreground, dark.colors.foreground);
});

test("Divya Desams: the index screen's data still contains all 107 real records", () => {
  assert.equal(loadDivyaDesams().length, 107);
});

test("Divya Desams: Sri Rangam still resolves for the detail screen", () => {
  assert.ok(loadDivyaDesam("sri-rangam"));
});

test("Library: the book still has all 51 chapters after the UI rewrite", () => {
  const book = loadBook(BOOK_SLUG);
  assert.ok(book);
  assert.equal(loadChapters(BOOK_SLUG).length, 51);
});

test("Search: the offline corpus still surfaces a real record for a matching query", () => {
  const results = searchCorpus(buildMobileSearchCorpus(), "Raṅgam");
  assert.ok(results.some((r) => r.href === "/divya-desams/sri-rangam"));
});

test("Images: Sri Rangam's sourceAssetUuid still matches a real file under public/images/", () => {
  const record = loadDivyaDesam("sri-rangam");
  assert.ok(record, "sri-rangam did not resolve");
  const onDisk = new Set(fs.readdirSync(IMAGES_ROOT).map((name) => path.parse(name).name.toLowerCase()));
  const withImage = record!.images.find((img) => onDisk.has(img.sourceAssetUuid.toLowerCase()));
  assert.ok(withImage, "expected sri-rangam to have at least one image with a matching file on disk");
});

test("Images: public/images/ still has 227 real files for the manifest generator to enumerate", () => {
  // 217 from the original migration + 174 added by Phase 6E from "108
  // Divyadesam 2nd Edition.pdf" (see content/_provenance/divya-desams/),
  // minus 149 removed as post-Phase-6E-C near-duplicates (same photo,
  // re-scanned between the original SAP export and the book -- see
  // source-material/reports/phase-6E-image-fixes-report.md), minus 12
  // more removed as misattributed to the wrong adjacent temple (see
  // source-material/reports/phase-6E-cross-record-duplicates-report.md),
  // minus 3 more removed once their charama-shlokam chapters had the
  // real verse transcribed as text (extracted from these exact images)
  // instead of only ever showing it as a photo of the shloka:
  // 391 - 149 - 12 - 3 = 227.
  assert.equal(fs.readdirSync(IMAGES_ROOT).length, 227);
});
