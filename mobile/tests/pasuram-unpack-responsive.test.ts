import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Decompress, decompress } from "fzstd";
import { parseUstar, UstarStream, type TarEntry } from "../services/pasuramTar.ts";

/**
 * On a budget Android phone, unpacking the bundled Pasuram archive froze
 * the app from the first screen: one synchronous decompress of 20 MB into
 * 40 MB, then a pure-JS SHA-256 over all of it, on the JS thread that also
 * handles every tap. The unpack now streams in small slices instead, so
 * these tests check that the streaming path yields exactly what the
 * one-shot path did, and that the slow work stays off the startup path.
 */

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => fs.readFileSync(path.join(mobileRoot, file), "utf8");
const archive = new Uint8Array(fs.readFileSync(path.join(mobileRoot, "assets", "pasurams-archive.generated.zst")));

function sameEntries(actual: TarEntry[], expected: TarEntry[]) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    assert.equal(actual[i].name, expected[i].name);
    assert.ok(Buffer.from(actual[i].bytes).equals(Buffer.from(expected[i].bytes)), `${expected[i].name} differs`);
  }
}

test("streaming decompress + UstarStream yields the same files as the one-shot path", () => {
  const expected = parseUstar(decompress(archive));
  const stream = new UstarStream();
  const actual: TarEntry[] = [];
  const zstd = new Decompress((chunk) => actual.push(...stream.push(chunk)));
  for (let offset = 0; offset < archive.length; offset += 32 * 1024) {
    zstd.push(archive.subarray(offset, offset + 32 * 1024), offset + 32 * 1024 >= archive.length);
  }
  sameEntries(actual, expected);
});

test("UstarStream copes with headers and file bodies split at any byte", () => {
  const tar = decompress(archive).subarray(0, 600_000);
  const expected = parseUstar(tar).slice(0, -1); // the last entry is cut off by the slice
  const stream = new UstarStream();
  const actual: TarEntry[] = [];
  for (let offset = 0; offset < tar.length; offset += 777) actual.push(...stream.push(tar.subarray(offset, offset + 777)));
  sameEntries(actual.slice(0, expected.length), expected);
});

test("the on-device unpack never decompresses or hashes the whole archive in one go", () => {
  const source = read("services/pasuramArchive.ts");
  const unpack = source.slice(source.indexOf("async function unpackArchive"), source.indexOf("let unpackPromise"));
  assert.match(unpack, /new Decompress\(/);
  assert.doesNotMatch(unpack, /\bdecompress\(/);
  assert.doesNotMatch(unpack, /sha256HexBytes\(/);
});

test("a bundled Pasuram is checked against its recorded hash when it is opened", () => {
  const source = read("services/pasuramArchive.ts");
  const fn = source.slice(source.indexOf("export function localPasuramPath"));
  assert.match(fn, /sha256HexBytes\(/);
  assert.match(fn, /pasuramFileHashes\[/);
});

test("the unpack starts only after the welcome and setup screens", () => {
  const layout = read("app/_layout.tsx");
  const effect = layout.slice(layout.lastIndexOf("useEffect(", layout.indexOf("ensurePasuramsUnpacked()")), layout.indexOf("ensurePasuramsUnpacked()"));
  assert.match(effect, /if \(!seenWelcome \|\| onboarded !== true\) return;/);
});
