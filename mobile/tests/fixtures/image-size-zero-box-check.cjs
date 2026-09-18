"use strict";
/**
 * Run in a child process (spawned by
 * tests/image-size-zero-size-box.test.ts) with a hard OS-level timeout,
 * because the vulnerability this guards is a genuinely synchronous
 * infinite loop -- nothing in-process (a Promise timeout, node:test's own
 * per-test timeout) can preempt a synchronous busy loop on the same
 * thread, so only killing the process from outside can bound it.
 *
 * Imports the ACTUAL package Metro resolves at build time --
 * node_modules/metro/node_modules/image-size, the exact nested copy
 * mobile/patches/metro++image-size+1.2.1.patch is applied to -- not a
 * separately installed or newer copy, so this proves the patch that
 * ships is the patch that's tested.
 */
const path = require("node:path");
const imageSize = require(
  path.join(__dirname, "..", "..", "node_modules", "metro", "node_modules", "image-size")
);

/**
 * A minimal, well-formed ICNS container whose single image entry has a
 * declared length of 0. ICNS.calculate() (dist/types/icns.js) advances a
 * read cursor by that declared length on each entry; pre-patch, a
 * zero-length entry left the cursor unchanged, so the `while (imageOffset
 * < fileLength ...)` loop below it read the identical bytes forever --
 * an attacker-controlled hang triggerable by nothing more than a crafted
 * icon file reaching Metro's bundler.
 *
 * Layout (big-endian, per the ICNS spec):
 *   bytes 0-3   "icns" magic
 *   bytes 4-7   file length = 16 (equals the offset after one
 *               guarded advance, so the patched code returns
 *               immediately instead of ever entering the while loop)
 *   bytes 8-11  entry type "ICON"
 *   bytes 12-15 entry length = 0  <- the malicious zero-size box
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
 * A minimal JPEG XL container (signature box + ftyp box, so JXL.validate()
 * accepts it) with no `jxlc` box, forcing extractCodestream() to fall
 * through to extractPartialStreams() (dist/types/jxl.js), whose own
 * `offset +=` advance is what this patch guards -- distinct from (and
 * downstream of) findBox()'s own already-patched internal loop. The lone
 * `jxlp` box here declares size 0; pre-patch, extractPartialStreams()
 * never advanced past it and looped forever re-finding the same box.
 *
 * Layout (big-endian box sizes, per the JPEG XL container spec):
 *   bytes 0-11   "JXL " signature box (size 12, name "JXL ")
 *   bytes 12-23  "ftyp" box (size 12, name "ftyp", brand "jxl ")
 *   bytes 24-31  "jxlp" box header with declared size 0 <- malicious
 *   bytes 32-39  trailing padding so the loop has room to terminate
 *                cleanly once it advances past the zero-size box
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

// The crafted file length (16) equals the offset ICNS.calculate() reaches
// after exactly one guarded advance past the zero-length entry, so a
// correctly-patched parser returns this single entry's own icon size
// immediately -- it never reaches the `while` loop at all. Reaching this
// line without hanging is itself the proof the guard fired.
const icnsResult = imageSize(buildMaliciousIcns());
if (!icnsResult || icnsResult.type !== "ICON") {
  throw new Error("ICNS.calculate() did not return the expected result: " + JSON.stringify(icnsResult));
}

// extractPartialStreams() finding the zero-size `jxlp` box, advancing
// past it via the patched guard, then finding no further boxes hands an
// empty codestream on to JXLStream.calculate() -- which throws this
// specific, deeper parsing error ("Reached end of input" -- there's no
// actual pixel data). Asserting on that exact message (rather than "it
// threw *something*") is what proves extractPartialStreams() itself ran
// to completion, rather than the input merely failing JXL detection
// before ever reaching the vulnerable code at all.
let jxlErrorMessage = null;
try {
  imageSize(buildMaliciousJxl());
} catch (err) {
  jxlErrorMessage = err.message;
}
if (jxlErrorMessage !== "Reached end of input") {
  throw new Error(
    "JXL path did not reach JXLStream.calculate() as expected (extractPartialStreams() may not have run): " +
      JSON.stringify(jxlErrorMessage)
  );
}

process.stdout.write("OK\n");
process.exit(0);
