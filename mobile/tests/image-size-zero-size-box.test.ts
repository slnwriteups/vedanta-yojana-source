import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regression test for mobile/patches/metro++image-size+1.2.1.patch.
 *
 * Vulnerability: Metro's bundler resolves image dimensions via the
 * `image-size` package for every image asset it processes. Two of that
 * package's parsers -- ICNS.calculate() and JXL.extractPartialStreams()
 * (both in node_modules/metro/node_modules/image-size/dist/types/) --
 * advanced a read cursor by an attacker-controlled "entry/box length"
 * field taken directly from the file. A crafted file declaring a
 * zero-length entry left that cursor unchanged, so each function's own
 * `while` loop read the identical bytes forever: a denial-of-service
 * triggerable by nothing more than an icon (.icns) or JPEG XL (.jxl)
 * file with a single malformed header reaching the bundler. The patch
 * adds a "advance by a minimum size when the declared length is zero"
 * guard to both loops (image-size's own findBox() helper, used
 * elsewhere in the same package, already had an equivalent guard --
 * these two call sites had their own separate, unguarded advancement
 * logic that didn't go through it).
 *
 * Why this runs the way it does:
 *
 * - The vulnerable loops are fully synchronous. Nothing in-process (a
 *   Promise timeout, node:test's own per-test timeout) can preempt a
 *   synchronous busy loop on the same thread the test itself is running
 *   on, so the only way to bound a potential hang is to run the check in
 *   a *separate process* and kill it from outside if it overruns --
 *   tests/fixtures/image-size-zero-box-check.cjs is that separate
 *   script, and this test drives it via `spawnSync(..., { timeout })`.
 * - That fixture requires the exact installed nested package --
 *   node_modules/metro/node_modules/image-size, the same copy the patch
 *   targets and Metro actually resolves at build time -- not a
 *   separately installed or newer copy, so this proves the patch that
 *   ships is the patch that's tested. See the fixture's own doc comment
 *   for the exact malicious ICNS/JXL byte layouts and why each one
 *   would have hung the pre-patch parser.
 * - No network access, no filesystem input beyond the fixture script
 *   itself, and a bounded 5-second timeout well under any CI test-suite
 *   budget: a real regression fails this test in ~5s rather than hanging
 *   the whole suite indefinitely.
 *
 * Manually verified while writing this test (not something the test
 * itself re-checks on every run, since that would require shipping a
 * deliberately-broken copy of a real dependency): temporarily reverting
 * the patch in the installed package reproduces the exact hang this test
 * guards against -- spawnSync's `signal` comes back `SIGTERM` with
 * `error.code === "ETIMEDOUT"` instead of a clean exit -- confirming
 * this test genuinely fails on the vulnerable code path rather than
 * passing regardless of whether the patch is applied.
 */

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = path.join(MOBILE_ROOT, "tests", "fixtures", "image-size-zero-box-check.cjs");
const TIMEOUT_MS = 5000;

test("image-size zero-size-box guard: a crafted zero-length ICNS entry and zero-size JXL box no longer hang the parser", () => {
  const result = spawnSync(process.execPath, [FIXTURE], {
    timeout: TIMEOUT_MS,
    encoding: "utf8",
  });

  assert.equal(
    result.signal,
    null,
    `fixture process was killed (signal=${result.signal}, likely a timeout -- the zero-size-box guard may be missing). stderr: ${result.stderr}`
  );
  assert.equal(
    result.error,
    undefined,
    `fixture process failed to run cleanly: ${result.error?.message}. stderr: ${result.stderr}`
  );
  assert.equal(result.status, 0, `fixture exited non-zero. stdout: ${result.stdout} stderr: ${result.stderr}`);
  assert.equal(result.stdout.trim(), "OK");
});
