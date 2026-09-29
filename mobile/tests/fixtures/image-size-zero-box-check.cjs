"use strict";
/**
 * Run in a child process (spawned by
 * tests/image-size-zero-size-box.test.ts) with a hard OS-level timeout,
 * because the failure this guards is a genuinely synchronous infinite
 * loop -- nothing in-process (a Promise timeout, node:test's own per-test
 * timeout) can preempt a synchronous busy loop on the same thread, so
 * only killing the process from outside can bound it.
 *
 * History: through Expo SDK 54 Metro resolved image dimensions with its
 * own nested copy of the `image-size` package, whose ICNS and JXL parsers
 * looped forever on a zero-length entry/box; that was fixed locally by
 * mobile/patches/metro++image-size+1.2.1.patch. From Metro 0.83 (Expo
 * SDK 55+) Metro no longer depends on `image-size` at all -- it ships its
 * own parser at metro/src/lib/imageSize.js, which has no ICNS/JXL support
 * and guards every chunk-walking loop. The patch was retired with that
 * change; this check now imports the ACTUAL parser Metro calls at build
 * time (the one Assets.js requires) and feeds it the same class of
 * crafted zero-length inputs, so a future Metro regression that
 * reintroduces the hang fails the suite instead of hanging the bundler.
 */
const path = require("node:path");
const { getImageDimensions } = require(
  path.join(__dirname, "..", "..", "node_modules", "metro", "src", "lib", "imageSize.js")
);

/**
 * The original ICNS payload: one image entry with a declared length of 0.
 * Metro's parser has no ICNS support, so this must be rejected (thrown as
 * an invalid image) rather than parsed -- and, above all, not hang.
 */
function buildMaliciousIcns() {
  const buf = Buffer.alloc(16);
  buf.write("icns", 0, "ascii");
  buf.writeUInt32BE(16, 4);
  buf.write("ICON", 8, "ascii");
  buf.writeUInt32BE(0, 12);
  return buf;
}

/**
 * The original JPEG XL payload (signature box + ftyp box + a `jxlp` box
 * declaring size 0). Like ICNS, JXL is unsupported and must be rejected.
 */
function buildMaliciousJxl() {
  const buf = Buffer.alloc(40);
  buf.writeUInt32BE(12, 0);
  buf.write("JXL ", 4, "ascii");
  buf.writeUInt32BE(12, 12);
  buf.write("ftyp", 16, "ascii");
  buf.write("jxl ", 20, "ascii");
  buf.writeUInt32BE(0, 24);
  buf.write("jxlp", 28, "ascii");
  return buf;
}

/**
 * JPEG: SOI, then an APP0 segment whose declared length is 0. parseJpeg()
 * advances by the declared segment length, so a missing `< 2` guard would
 * leave the cursor in place and re-read the same marker forever.
 */
function buildZeroLengthJpeg() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00, 0x00]);
}

/**
 * WebP: RIFF/WEBP header followed by an unknown chunk declaring length 0.
 * parseWebp() walks chunks by `dataOffset + chunkLength`; the header alone
 * always advances it by 8, and it bails if the offset ever fails to grow.
 */
function buildZeroLengthWebp() {
  const buf = Buffer.alloc(28);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(20, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write("JUNK", 12, "ascii");
  buf.writeUInt32LE(0, 16);
  buf.write("JUNK", 20, "ascii");
  buf.writeUInt32LE(0, 24);
  return buf;
}

const cases = [
  ["icns", buildMaliciousIcns()],
  ["jxl", buildMaliciousJxl()],
  ["jpg", buildZeroLengthJpeg()],
  ["webp", buildZeroLengthWebp()],
];

// Every crafted file carries no usable dimensions, so each call must
// return by throwing Metro's invalid-image error. Reaching the end of
// this loop without the parent's timeout firing is the proof that no
// parser (including the fallback sweep across all formats) stalled.
for (const [type, content] of cases) {
  let message = null;
  try {
    getImageDimensions(type, content, `crafted.${type}`);
  } catch (err) {
    message = err.message;
  }
  if (message === null) {
    throw new Error(`${type}: crafted file was unexpectedly accepted as a valid image`);
  }
}

process.stdout.write("OK\n");
process.exit(0);
