import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseUstar } from "../services/pasuramTar.ts";

/**
 * Verifies parseUstar() against a REAL ustar archive built by the same
 * system `tar --format=ustar` the build-time generator uses (see
 * scripts/generate-pasuram-archive.ts) -- not a hand-crafted byte
 * fixture, so a format assumption this parser gets wrong (field offset,
 * octal size encoding, padding) would actually be caught here.
 */

function buildRealUstarArchive(files: Record<string, string>): Uint8Array {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pasuram-tar-test-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), content);
    }
    const archivePath = path.join(dir, "out.tar");
    execFileSync("tar", ["--format=ustar", "-cf", archivePath, "-C", dir, ...Object.keys(files)]);
    return new Uint8Array(fs.readFileSync(archivePath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("parseUstar: recovers every file's exact name and byte content from a real tar --format=ustar archive", () => {
  const files = {
    "0011223344556677889900112233445566.pdf": "%PDF-1.5 fake content for file one",
    "aabbccddeeff00112233445566778899aabb.pdf": "%PDF-1.5 a different fake payload, longer than the first one to exercise padding across a 512-byte boundary".repeat(20),
  };
  const archive = buildRealUstarArchive(files);

  const entries = parseUstar(archive);
  assert.equal(entries.length, Object.keys(files).length);

  const byName = new Map(entries.map((e) => [e.name, e]));
  for (const [name, content] of Object.entries(files)) {
    const entry = byName.get(name);
    assert.ok(entry, `expected an entry named ${name}`);
    assert.equal(new TextDecoder().decode(entry!.bytes), content);
  }
});

test("parseUstar: an empty file round-trips as a zero-length entry, not a skipped one", () => {
  const archive = buildRealUstarArchive({ "empty.pdf": "" });
  const entries = parseUstar(archive);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "empty.pdf");
  assert.equal(entries[0].bytes.length, 0);
});

test("parseUstar: a single all-zero terminator block stops parsing rather than reading past end-of-archive", () => {
  const archive = buildRealUstarArchive({ "one.pdf": "content" });
  const entries = parseUstar(archive);
  assert.equal(entries.length, 1);
});

test("parseUstar: binary content (including embedded zero bytes) survives byte-for-byte", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pasuram-tar-test-bin-"));
  try {
    const binaryBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0x01, 0xff, 0x00, 0x80, 0x7f]);
    fs.writeFileSync(path.join(dir, "binary.pdf"), binaryBytes);
    const archivePath = path.join(dir, "out.tar");
    execFileSync("tar", ["--format=ustar", "-cf", archivePath, "-C", dir, "binary.pdf"]);
    const archive = new Uint8Array(fs.readFileSync(archivePath));

    const entries = parseUstar(archive);
    assert.equal(entries.length, 1);
    assert.deepEqual(Array.from(entries[0].bytes), Array.from(binaryBytes));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
