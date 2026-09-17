import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * scripts/verify-public-build.ts calls `process.exit()` at module load
 * time (see its own bottom line), so it can't be imported directly by a
 * test -- this spawns it as a real subprocess against small fixture
 * directories, the same way .github/workflows/deploy-preview-repo.yml
 * itself invokes it, and asserts on the exit code and stderr text.
 */

const SCRIPT = path.resolve(import.meta.dirname, "../scripts/verify-public-build.ts");

/**
 * Satisfies verify-public-build.ts's own "catastrophic failure" sanity
 * floors (50 index.html files, 50MB total, the three top-level required
 * files) with real, checkable content -- not just enough to dodge the
 * check, since a fixture that couldn't fail those checks would make
 * this test file blind to a real regression in them.
 */
function makeMinimalValidOut(rootDir: string): void {
  fs.mkdirSync(path.join(rootDir, "_next"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, "_next", "placeholder.js"), "//");
  fs.writeFileSync(path.join(rootDir, "index.html"), "<html></html>");
  for (let i = 0; i < 50; i++) {
    const pageDir = path.join(rootDir, "page", String(i));
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, "index.html"), "<html></html>");
  }
  fs.writeFileSync(path.join(rootDir, "robots.txt"), "");
  fs.writeFileSync(path.join(rootDir, "sitemap.xml"), "");
  for (const dir of ["images", "book-covers", "icons", "nav-icons", "audio"]) {
    fs.mkdirSync(path.join(rootDir, dir), { recursive: true });
    fs.writeFileSync(path.join(rootDir, dir, "placeholder.bin"), "x");
  }
  // Padding to clear the 50MB total-size floor -- irrelevant to every
  // check above, just bulk.
  fs.writeFileSync(path.join(rootDir, "_next", "padding.bin"), Buffer.alloc(51 * 1024 * 1024));
}

function runVerify(rootDir: string): { status: number; stderr: string; stdout: string } {
  try {
    const stdout = execFileSync("node", ["--experimental-strip-types", SCRIPT, rootDir], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stderr: "", stdout };
  } catch (error) {
    const e = error as { status: number; stderr: Buffer; stdout: Buffer };
    return { status: e.status, stderr: e.stderr.toString(), stdout: e.stdout.toString() };
  }
}

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-public-build-test-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("verify-public-build: a minimal, clean directory passes", () => {
  withTempDir((dir) => {
    makeMinimalValidOut(dir);
    const result = runVerify(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^PASS:/);
  });
});

test("verify-public-build: sourceAssetUuid is allowed inside books/ -- the mobile offline-download payload's real, intentional resolution key", () => {
  withTempDir((dir) => {
    makeMinimalValidOut(dir);
    fs.mkdirSync(path.join(dir, "books"), { recursive: true });
    fs.writeFileSync(path.join(dir, "books", "jaya.json"), JSON.stringify({ sourceAssetUuid: "abc-123" }));
    const result = runVerify(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("verify-public-build: sourceAssetUuid is still forbidden everywhere else", () => {
  withTempDir((dir) => {
    makeMinimalValidOut(dir);
    fs.writeFileSync(path.join(dir, "images", "leak.json"), JSON.stringify({ sourceAssetUuid: "abc-123" }));
    const result = runVerify(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /"sourceAssetUuid" found in images[/\\]leak\.json/);
  });
});

test("verify-public-build: sourcePageId, extractionConfidence, and sourceOriginalName are still forbidden even inside books/ -- the exception is scoped to sourceAssetUuid only", () => {
  withTempDir((dir) => {
    makeMinimalValidOut(dir);
    fs.mkdirSync(path.join(dir, "books"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "books", "jaya.json"),
      JSON.stringify({ sourcePageId: "page.Page1", extractionConfidence: "high", sourceOriginalName: "scan.jpg" })
    );
    const result = runVerify(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /"sourcePageId" found in books/);
    assert.match(result.stderr, /"extractionConfidence" found in books/);
    assert.match(result.stderr, /"sourceOriginalName" found in books/);
  });
});
