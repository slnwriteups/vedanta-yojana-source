import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getPasuramFileName, getPasuramResourceId, PASURAM_DIRECTORY_NAME, sha256Hex } from "../services/pasuramResourceId.ts";

/**
 * Verifies the pure SHA-256 implementation against known test vectors
 * and against Node's own `node:crypto` (available here since this test
 * runs under plain Node -- the mobile source under test deliberately
 * does NOT use node:crypto, since that isn't available under Hermes/RN).
 */

test("sha256Hex: matches the standard empty-string and 'abc' FIPS 180-4 test vectors", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("sha256Hex: matches node:crypto's SHA-256 for a range of real Pasuram URLs and random strings", () => {
  const samples = [
    "https://www.prapatti.com/slokas/sanskrit/tiruvarangampaasurangal.pdf",
    "https://www.prapatti.com/slokas/english/tiruvellaraipaasurangal.pdf",
    "The quick brown fox jumps over the lazy dog",
  ];
  for (const s of samples) {
    assert.equal(sha256Hex(s), crypto.createHash("sha256").update(s, "utf8").digest("hex"));
  }
  for (let i = 0; i < 25; i++) {
    const s = crypto.randomBytes(Math.floor(Math.random() * 300)).toString("hex");
    assert.equal(sha256Hex(s), crypto.createHash("sha256").update(s, "utf8").digest("hex"), `mismatch for length ${s.length}`);
  }
});

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
