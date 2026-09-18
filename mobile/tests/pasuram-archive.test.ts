import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { decompress } from "fzstd";
import { loadDivyaDesams } from "../content-lib/loader.ts";
import { allPasuramResourceUrls } from "../content-lib/pasuram-resources.ts";
import { PASURAM_ARCHIVE_VERSION, pasuramFileHashes, pasuramFilenameByUrl } from "../content-lib/pasuram-manifest.generated.ts";
import { parseUstar } from "../services/pasuramTar.ts";
import { sha256HexBytes } from "../services/pasuramResourceId.ts";

/**
 * A real, full round-trip of mobile/assets/pasurams-archive.generated.zst
 * -- the single archive services/pasuramArchive.ts unpacks on-device
 * (see scripts/generate-pasuram-archive.ts) -- using the exact same
 * decode path the app itself uses (fzstd, then services/pasuramTar.ts's
 * ustar parser), except run here under plain `node --test` instead of on
 * a device, since fzstd is pure JS with no native dependency. This is
 * what actually catches a stale/corrupted archive, a manifest that
 * drifted from the archive it describes, or a tar/zstd decode bug --
 * not a guess about whether the packaging works.
 */

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARCHIVE_PATH = path.join(MOBILE_ROOT, "assets", "pasurams-archive.generated.zst");

function readArchiveEntries() {
  const compressed = fs.readFileSync(ARCHIVE_PATH);
  const decompressed = decompress(new Uint8Array(compressed));
  return parseUstar(decompressed);
}

test("pasurams-archive.generated.zst exists and its recorded version matches its own current bytes", () => {
  assert.ok(fs.existsSync(ARCHIVE_PATH), "expected mobile/assets/pasurams-archive.generated.zst to exist");
  const actualVersion = crypto.createHash("sha256").update(fs.readFileSync(ARCHIVE_PATH)).digest("hex");
  assert.equal(
    PASURAM_ARCHIVE_VERSION,
    actualVersion,
    "pasuram-manifest.generated.ts's PASURAM_ARCHIVE_VERSION is stale -- regenerate with scripts/generate-pasuram-archive.ts"
  );
});

test("every archived file decompresses and matches its recorded integrity hash", () => {
  const entries = readArchiveEntries();
  const byName = new Map(entries.map((e) => [e.name, e]));

  const expectedNames = Object.keys(pasuramFileHashes);
  assert.ok(expectedNames.length > 0, "expected at least one entry in pasuramFileHashes");

  const mismatches: string[] = [];
  for (const [filename, expectedHash] of Object.entries(pasuramFileHashes)) {
    const entry = byName.get(filename);
    if (!entry) {
      mismatches.push(`${filename}: missing from archive`);
      continue;
    }
    const actualHash = sha256HexBytes(entry.bytes);
    if (actualHash !== expectedHash) {
      mismatches.push(`${filename}: hash mismatch`);
    }
  }
  assert.deepEqual(mismatches, []);
});

test("every archived file is genuinely valid PDF content, not truncated or corrupted", () => {
  const entries = readArchiveEntries();
  const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];
  const invalid = entries
    .filter((entry) => !(entry.bytes.length >= PDF_MAGIC.length && PDF_MAGIC.every((byte, i) => entry.bytes[i] === byte)))
    .map((entry) => entry.name);
  assert.deepEqual(invalid, []);
});

test("pasuramFilenameByUrl covers every Pasuram URL the current content corpus references", () => {
  const urls = allPasuramResourceUrls(loadDivyaDesams());
  assert.ok(urls.length > 0, "expected at least one real Pasuram URL in the corpus");
  const missing = urls.filter((url) => !(url in pasuramFilenameByUrl));
  assert.deepEqual(missing, [], `${missing.length} Pasuram URL(s) have no entry in pasuramFilenameByUrl`);
});

test("every filename pasuramFilenameByUrl points to actually exists in the archive", () => {
  const entries = readArchiveEntries();
  const namesInArchive = new Set(entries.map((e) => e.name));
  const missing = Object.values(pasuramFilenameByUrl).filter((filename) => !namesInArchive.has(filename));
  assert.deepEqual(missing, []);
});
