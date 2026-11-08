import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  conditionalHeaders,
  emptyLatestIndex,
  isSweepDue,
  looksLikeCompletePdf,
  parseLatestIndex,
  remoteDiffers,
  remoteInfoFromHeaders,
  RECENT_CHECK_MS,
  shouldCheckOnOpen,
  SWEEP_INTERVAL_MS,
  type LatestEntry,
} from "../services/pasuramLatestCore.ts";
import { pasuramFilenameByUrl } from "../content-lib/pasuram-manifest.generated.ts";
import { pasuramOriginLengthByUrl } from "../content-lib/pasuram-origin.generated.ts";
import { getPasuramFileName } from "../services/pasuramResourceId.ts";

/**
 * Tests for keeping Pasurams current with Prapatti.com's corrections
 * while staying usable offline (services/pasuramLatestCore.ts). The
 * network/file adapter (services/pasuramLatest.ts) needs a device and
 * is exercised there.
 */

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function entry(overrides: Partial<LatestEntry> = {}): LatestEntry {
  return { filename: "0123456789abcdef0123456789abcdef.pdf", length: 5000, fetchedAt: 0, checkedAt: 0, ...overrides };
}

function pdfBytes(size = 4000, withEof = true): Uint8Array {
  const body = "%PDF-1.5\n" + "x".repeat(size) + (withEof ? "\n%%EOF\n" : "\n");
  return new TextEncoder().encode(body);
}

test("Latest index: unreadable or foreign data falls back to empty (bundled copies still open)", () => {
  assert.deepEqual(parseLatestIndex(null), emptyLatestIndex());
  assert.deepEqual(parseLatestIndex("not json"), emptyLatestIndex());
  assert.deepEqual(parseLatestIndex(JSON.stringify({ version: 2, entries: {} })), emptyLatestIndex());
});

test("Latest index: keeps valid entries and drops malformed ones, including unsafe filenames", () => {
  const good = entry({ etag: '"abc"' });
  const parsed = parseLatestIndex(
    JSON.stringify({
      version: 1,
      lastSweepAt: 42,
      entries: { a: good, b: { ...good, filename: "../../evil.pdf" }, c: { filename: "x" } },
    })
  );
  assert.equal(parsed.lastSweepAt, 42);
  assert.deepEqual(Object.keys(parsed.entries), ["a"]);
});

test("Conditional headers: sends whichever validators we have, none for a first download", () => {
  assert.deepEqual(conditionalHeaders(undefined), {});
  assert.deepEqual(conditionalHeaders(entry({ etag: '"v1"', lastModified: "Mon, 01 Jan 2026 00:00:00 GMT" })), {
    "If-None-Match": '"v1"',
    "If-Modified-Since": "Mon, 01 Jan 2026 00:00:00 GMT",
  });
});

test("PDF check: accepts a complete PDF, rejects error pages, tiny bodies and cut-off downloads", () => {
  assert.equal(looksLikeCompletePdf(pdfBytes()), true);
  assert.equal(looksLikeCompletePdf(new TextEncoder().encode("<html>" + "x".repeat(4000) + "%%EOF")), false);
  assert.equal(looksLikeCompletePdf(pdfBytes(10)), false);
  assert.equal(looksLikeCompletePdf(pdfBytes(4000, false)), false);
});

test("PDF check: every bundled original PDF passes, so real Prapatti downloads are accepted", () => {
  const dir = path.join(MOBILE_ROOT, "assets", "pasurams");
  for (const url of Object.keys(pasuramFilenameByUrl)) {
    const bytes = new Uint8Array(fs.readFileSync(path.join(dir, getPasuramFileName(url))));
    assert.equal(looksLikeCompletePdf(bytes), true, url);
  }
});

test("On open: checks Prapatti.com unless it was asked within the last hour", () => {
  const now = 10 * RECENT_CHECK_MS;
  assert.equal(shouldCheckOnOpen(undefined, now), true);
  assert.equal(shouldCheckOnOpen(entry({ checkedAt: now - 1000 }), now), false);
  assert.equal(shouldCheckOnOpen(entry({ checkedAt: now - RECENT_CHECK_MS }), now), true);
});

test("Correction check: due on first run and after a day, not before", () => {
  const index = emptyLatestIndex();
  assert.equal(isSweepDue(index, Date.now()), true);
  index.lastSweepAt = 1_000_000;
  assert.equal(isSweepDue(index, 1_000_000 + SWEEP_INTERVAL_MS - 1), false);
  assert.equal(isSweepDue(index, 1_000_000 + SWEEP_INTERVAL_MS), true);
});

test("Change detection: prefers ETag, then Last-Modified, then length", () => {
  const e = entry({ etag: '"v1"', lastModified: "A", length: 100 });
  assert.equal(remoteDiffers({ etag: '"v1"', lastModified: "B", length: 999 }, e, undefined), false);
  assert.equal(remoteDiffers({ etag: '"v2"' }, e, undefined), true);
  assert.equal(remoteDiffers({ lastModified: "A", length: 999 }, entry({ lastModified: "A", length: 100 }), undefined), false);
  assert.equal(remoteDiffers({ lastModified: "B" }, entry({ lastModified: "A" }), undefined), true);
  assert.equal(remoteDiffers({ length: 101 }, entry({ length: 100 }), undefined), true);
  assert.equal(remoteDiffers({ length: 100 }, entry({ length: 100 }), undefined), false);
});

test("Change detection: never-downloaded Pasurams compare against the bundled original's size", () => {
  assert.equal(remoteDiffers({ length: 100064 }, undefined, 100064), false);
  assert.equal(remoteDiffers({ length: 100100 }, undefined, 100064), true);
  // Nothing comparable: don't download blindly.
  assert.equal(remoteDiffers({}, undefined, 100064), false);
  assert.equal(remoteDiffers({ etag: '"x"' }, undefined, 100064), false);
});

test("Headers: reads validators and ignores a malformed Content-Length", () => {
  const h = new Map([["etag", '"v1"'], ["last-modified", "A"], ["content-length", "1234"]]);
  assert.deepEqual(remoteInfoFromHeaders((n) => h.get(n) ?? null), { etag: '"v1"', lastModified: "A", length: 1234 });
  assert.equal(remoteInfoFromHeaders((n) => (n === "content-length" ? "12a" : null)).length, undefined);
});

test("Origin sizes: recorded for every bundled Pasuram and match the original files", () => {
  const dir = path.join(MOBILE_ROOT, "assets", "pasurams");
  for (const url of Object.keys(pasuramFilenameByUrl)) {
    const expected = fs.statSync(path.join(dir, getPasuramFileName(url))).size;
    assert.equal(pasuramOriginLengthByUrl[url], expected, url);
  }
});
