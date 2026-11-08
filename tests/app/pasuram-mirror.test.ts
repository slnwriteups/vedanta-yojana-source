import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pasuramMirrorHref, pasuramMirrorRelativePath } from "../../lib/pasuram-mirror.ts";
import { pasuramFilenameByUrl } from "../../mobile/content-lib/pasuram-manifest.generated.ts";

/**
 * The website's Pasuram mechanics match the app's: Prapatti.com's
 * current file when online, a kept copy when offline, refreshed when
 * Prapatti corrects it (lib/pasuram-mirror.ts, public/sw.js,
 * scripts/sync-pasuram-mirror.ts).
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("Pasuram mirror: every PDF the app bundles has a unique path on the site", () => {
  const seen = new Set<string>();
  for (const url of Object.keys(pasuramFilenameByUrl)) {
    const relative = pasuramMirrorRelativePath(url);
    assert.ok(relative, `no mirror path for ${url}`);
    assert.match(relative, /^\/pasurams\/[a-z]+\/[a-z0-9]+\.pdf$/);
    assert.ok(!seen.has(relative), `duplicate mirror path ${relative}`);
    seen.add(relative);
  }
  assert.equal(seen.size, Object.keys(pasuramFilenameByUrl).length);
});

test("Pasuram mirror: keeps Prapatti's layout and rejects anything else", () => {
  assert.equal(
    pasuramMirrorRelativePath("https://www.prapatti.com/slokas/tamil/tiruvarangampaasurangal.pdf"),
    "/pasurams/tamil/tiruvarangampaasurangal.pdf"
  );
  assert.equal(pasuramMirrorHref("https://www.prapatti.com/slokas/tamil/tiruvarangampaasurangal.pdf"), "/pasurams/tamil/tiruvarangampaasurangal.pdf");
  assert.equal(pasuramMirrorRelativePath("https://www.prapatti.com/slokas/tamil/../x.pdf"), null);
  assert.equal(pasuramMirrorRelativePath("https://example.com/slokas/tamil/x.pdf"), null);
  assert.equal(pasuramMirrorRelativePath("https://www.google.com/maps"), null);
});

test("Service worker: keeps Pasurams, checks for corrections, and is registered by the layout", () => {
  const sw = fs.readFileSync(path.join(ROOT, "public", "sw.js"), "utf8");
  assert.match(sw, /check-pasurams/);
  assert.match(sw, /keep-pasuram/);
  assert.match(sw, /pasurams\/index\.json|PASURAM_PREFIX\}index\.json/);
  const layout = fs.readFileSync(path.join(ROOT, "app", "layout.tsx"), "utf8");
  assert.match(layout, /<ServiceWorkerRegistration \/>/);
});

test("Deploy: mirrors PDFs from Prapatti on every deploy and daily", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github", "workflows", "deploy-pages.yml"), "utf8");
  assert.match(workflow, /schedule:\s*\n\s*- cron:/);
  assert.match(workflow, /node scripts\/sync-pasuram-mirror\.ts/);
});
