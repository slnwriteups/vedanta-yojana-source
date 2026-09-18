import test from "node:test";
import assert from "node:assert/strict";
import { getPasuramFileName, getPasuramResourceId, PASURAM_DIRECTORY_NAME } from "../services/pasuramResourceId.ts";

/**
 * The underlying sha256Hex primitive this module re-exports is verified
 * separately in tests/sha256.test.ts (shared with libraryCatalogCore.ts,
 * a second, unrelated consumer) -- this file only covers the
 * Pasuram-specific identity/naming logic built on top of it.
 */

test("getPasuramResourceId: the same URL always produces the same ID", () => {
  const url = "https://www.prapatti.com/slokas/tamil/tiruvinnagarampaasurangal.pdf";
  assert.equal(getPasuramResourceId(url), getPasuramResourceId(url));
});

test("getPasuramResourceId: different URLs produce different IDs", () => {
  const a = getPasuramResourceId("https://www.prapatti.com/slokas/tamil/tirukkudandaipaasurangal.pdf");
  const b = getPasuramResourceId("https://www.prapatti.com/slokas/kannada/tirukkudandaipaasurangal.pdf");
  assert.notEqual(a, b);
});

test("getPasuramResourceId: the two Divya Desams that genuinely share one Prapatti PDF resolve to the same ID", () => {
  // A real cross-record duplicate found during the architecture audit:
  // tirukkudandai and tiruvinnagaram both cite this exact Tamil PDF.
  const sharedUrl = "https://www.prapatti.com/slokas/tamil/tiruvinnagarampaasurangal.pdf";
  const idFromRecordA = getPasuramResourceId(sharedUrl);
  const idFromRecordB = getPasuramResourceId(sharedUrl);
  assert.equal(idFromRecordA, idFromRecordB);
});

test("getPasuramFileName: is a stable '<id>.pdf' filename, not a random one", () => {
  const url = "https://www.prapatti.com/slokas/english/tirukkandampaasurangal.pdf";
  const first = getPasuramFileName(url);
  const second = getPasuramFileName(url);
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{32}\.pdf$/);
});

test("PASURAM_DIRECTORY_NAME is a plain, safe directory segment", () => {
  assert.equal(PASURAM_DIRECTORY_NAME, "pasurams");
  assert.doesNotMatch(PASURAM_DIRECTORY_NAME, /[./\\]/);
});
