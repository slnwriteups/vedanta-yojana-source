import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Phase 5J -- structural tests for the core shell introduced in this
 * phase. These are static/source-level checks (no React rendering
 * library is installed, and installing one is explicitly out of scope
 * for this phase) -- live route behavior is separately verified against
 * a running dev server per the Phase 5J brief, section 24.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

const REQUIRED_ROUTE_FILES = [
  "app/page.tsx",
  "app/layout.tsx",
  "app/not-found.tsx",
  "app/error.tsx",
  "app/divya-desams/page.tsx",
  "app/divya-desams/[slug]/page.tsx",
  "app/library/page.tsx",
  "app/library/[book]/page.tsx",
  "app/library/[book]/[chapter]/page.tsx",
  "app/divya-desams/introduction/page.tsx",
  "app/search/page.tsx",
  "app/about/page.tsx",
];

test("every required route file exists", () => {
  for (const relPath of REQUIRED_ROUTE_FILES) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, relPath)), `missing ${relPath}`);
  }
});

test("SiteHeader links to every required top-level route", () => {
  const source = read("components/SiteHeader.tsx");
  for (const href of ["/", "/divya-desams", "/library", "/search"]) {
    assert.ok(source.includes(`href: "${href}"`), `SiteHeader missing link to ${href}`);
  }
});

test("SiteHeader links to the GitHub Releases page for app installs", () => {
  const source = read("components/SiteHeader.tsx");
  assert.ok(/RELEASES_URL\s*=\s*"https:\/\/github\.com\/[^"]+\/releases"/.test(source), "SiteHeader missing a RELEASES_URL constant pointing at GitHub Releases");
  assert.ok(source.includes("Install App"), "SiteHeader missing an Install App link");
});

test("dynamic Divya Desam/Book/Chapter routes plus the introduction route use the content loader and call notFound() rather than reading /content JSON directly", () => {
  const dd = read("app/divya-desams/[slug]/page.tsx");
  const book = read("app/library/[book]/page.tsx");
  const chapter = read("app/library/[book]/[chapter]/page.tsx");
  const introduction = read("app/divya-desams/introduction/page.tsx");

  for (const source of [dd, book, chapter, introduction]) {
    assert.ok(source.includes("@/content-lib/loader"), "expected an import from @/content-lib/loader");
    assert.ok(source.includes("notFound()"), "expected a notFound() call for the missing-record case");
    assert.ok(!/readFileSync|content-extraction/.test(source), "dynamic route must not read files directly or reference content-extraction");
  }
});

test("no application file imports from content-extraction/ or scripts/migration/", () => {
  const appFiles = listFilesRecursive(path.join(REPO_ROOT, "app"));
  const componentFiles = listFilesRecursive(path.join(REPO_ROOT, "components"));
  for (const file of [...appFiles, ...componentFiles]) {
    const source = fs.readFileSync(file, "utf8");
    assert.ok(!source.includes("content-extraction"), `${file} references content-extraction`);
    assert.ok(!source.includes("scripts/migration"), `${file} references scripts/migration`);
  }
});

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}
