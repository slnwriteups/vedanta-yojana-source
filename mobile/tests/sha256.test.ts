import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { sha256Hex, sha256HexBytes } from "../services/sha256.ts";

/**
 * Verifies the pure SHA-256 implementation against known test vectors
 * and against Node's own `node:crypto` (available here since this test
 * runs under plain Node -- the mobile source under test deliberately
 * does NOT use node:crypto, since that isn't available under Hermes/RN).
 * Moved out of pasuram-resource-id.test.ts once libraryCatalogCore.ts
 * became a second, unrelated consumer of this same primitive.
 */

test("sha256Hex: matches the standard empty-string and 'abc' FIPS 180-4 test vectors", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("sha256Hex: matches node:crypto's SHA-256 for a range of real strings and random strings", () => {
  const samples = [
    "https://www.prapatti.com/slokas/sanskrit/tiruvarangampaasurangal.pdf",
    "https://www.prapatti.com/slokas/english/tiruvellaraipaasurangal.pdf",
    "The quick brown fox jumps over the lazy dog",
    '{"contentSchemaVersion":1,"book":{"slug":"jaya"}}',
  ];
  for (const s of samples) {
    assert.equal(sha256Hex(s), crypto.createHash("sha256").update(s, "utf8").digest("hex"));
  }
  for (let i = 0; i < 25; i++) {
    const s = crypto.randomBytes(Math.floor(Math.random() * 300)).toString("hex");
    assert.equal(sha256Hex(s), crypto.createHash("sha256").update(s, "utf8").digest("hex"), `mismatch for length ${s.length}`);
  }
});

test("sha256HexBytes: matches node:crypto's SHA-256 over raw binary bytes, including embedded zero bytes", () => {
  const samples = [new Uint8Array([]), new Uint8Array([0x00, 0x01, 0xff, 0x80, 0x7f]), crypto.randomBytes(5000)];
  for (const bytes of samples) {
    const expected = crypto.createHash("sha256").update(bytes).digest("hex");
    assert.equal(sha256HexBytes(new Uint8Array(bytes)), expected);
  }
});
