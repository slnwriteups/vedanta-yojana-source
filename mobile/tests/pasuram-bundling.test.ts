import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDivyaDesams } from "../content-lib/loader.ts";
import { allPasuramResourceUrls } from "../content-lib/pasuram-resources.ts";
import { getPasuramFileName } from "../services/pasuramResourceId.ts";

/**
 * Every Pasuram PDF is bundled directly into the app (see
 * pasuramOfflineService.ts and scripts/generate-pasuram-archive.ts) --
 * there is no download fallback anymore, so a URL with no matching
 * bundled file is a real, user-facing gap: a Divya Desam record that
 * silently has an unopenable resource. This is the automated guard for
 * exactly the "0 missing" invariant the generator itself only warns
 * about (and does not fail the build over) -- reads mobile/assets/
 * pasurams/ directly, no expo-asset/native import needed, so it runs
 * under plain `node --test`.
 */

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_ROOT = path.join(MOBILE_ROOT, "assets", "pasurams");
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

test("every Pasuram URL the real corpus references has a bundled PDF under mobile/assets/pasurams/", () => {
  const urls = allPasuramResourceUrls(loadDivyaDesams());
  assert.ok(urls.length > 0, "expected at least one real Pasuram URL in the corpus");

  const missing = urls.filter((url) => !fs.existsSync(path.join(ASSETS_ROOT, getPasuramFileName(url))));
  assert.deepEqual(missing, [], `${missing.length} Pasuram URL(s) have no bundled PDF`);
});

test("every bundled PDF under mobile/assets/pasurams/ is genuinely valid PDF content, not an error page or empty file", () => {
  const files = fs.existsSync(ASSETS_ROOT) ? fs.readdirSync(ASSETS_ROOT).filter((f) => f.endsWith(".pdf")) : [];
  assert.ok(files.length > 0, "expected at least one bundled Pasuram PDF");

  const invalid: string[] = [];
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(ASSETS_ROOT, file));
    const isValid = bytes.length >= PDF_MAGIC.length && PDF_MAGIC.every((byte, i) => bytes[i] === byte);
    if (!isValid) invalid.push(file);
  }
  assert.deepEqual(invalid, []);
});

test("mobile/assets/pasurams/ has no stray files beyond what the current corpus actually references", () => {
  const urls = allPasuramResourceUrls(loadDivyaDesams());
  const expected = new Set(urls.map(getPasuramFileName));
  const actual = fs.existsSync(ASSETS_ROOT) ? fs.readdirSync(ASSETS_ROOT).filter((f) => f.endsWith(".pdf")) : [];

  const stray = actual.filter((f) => !expected.has(f));
  assert.deepEqual(stray, [], `${stray.length} bundled PDF(s) are not referenced by any current Divya Desam record`);
});
