import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { toMobileBook, toMobileChapterSummary } from "../content-lib/mobile-content-transform.ts";
import { BOOK_PAYLOAD_SCHEMA_VERSION } from "../content-lib/mobile-content.ts";
import { CONTENT_MANIFEST_VERSION, type ContentManifest, type ContentManifestBookEntry } from "../content-lib/content-manifest.ts";
import { BookSchema, ChapterSchema } from "../content-lib/schemas/index.ts";

/**
 * Emits public/content-manifest.json -- see content-lib/content-manifest.ts
 * for the full design (its own doc comment is the authoritative
 * reference for this file's purpose and how it differs from
 * public/app-version.json). This is the "expandable content" catalog an
 * already-installed mobile app polls to discover a new or changed book
 * without a new APK; mobile/services/libraryCatalogService.ts is the
 * consumer.
 *
 * MUST run after scripts/build-book-payloads.ts (wired into `prebuild`
 * in that exact order): every entry's contentHash/byteSize is computed
 * by hashing the ALREADY-WRITTEN public/books/<slug>.json bytes, not by
 * re-deriving them independently, so the hash this manifest advertises
 * is always the true hash of the exact bytes a client will actually
 * fetch from `url` -- never a value that could drift from the real
 * payload through an independent second computation.
 *
 * Same sanitizing projection as build-book-payloads.ts
 * (toMobileBook/toMobileChapterSummary, content-lib/mobile-content-transform.ts):
 * migration.sourcePageId, migration.extractionConfidence, and
 * images[].sourceOriginalName never reach this file either.
 *
 * Generated rather than committed (like public/books/*.json -- see
 * .gitignore), wired into `prebuild`, so it can never go stale relative
 * to content/library/.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_LIBRARY_ROOT = path.join(REPO_ROOT, "content", "library");
const BOOKS_OUTPUT_ROOT = path.join(REPO_ROOT, "public", "books");
const OUTPUT_FILE = path.join(REPO_ROOT, "public", "content-manifest.json");

/**
 * The fixed, real GitHub Pages origin -- deliberately hardcoded, not
 * read from NEXT_PUBLIC_SITE_URL/lib/site.ts's getSiteOrigin(). This
 * manifest is consumed by the MOBILE app, which has no Next.js
 * build-time env and needs a stable absolute URL regardless of whether
 * this script happens to run inside a `next build` with those vars set
 * or standalone locally -- same reasoning, and the same literal string,
 * as mobile/services/bookOfflineService.ts's own PAGES_BASE_URL.
 */
const PAGES_BASE_URL = "https://vedantayojana.org";

function listSubdirectories(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main(): void {
  const bookDirs = listSubdirectories(CONTENT_LIBRARY_ROOT);
  const entries: ContentManifestBookEntry[] = [];
  let missingPayloads = 0;

  for (const bookDir of bookDirs) {
    const bookJsonPath = path.join(CONTENT_LIBRARY_ROOT, bookDir, "book.json");
    if (!fs.existsSync(bookJsonPath)) continue;

    const book = toMobileBook(BookSchema.parse(readJson(bookJsonPath)));
    const chapterFiles = listJsonFiles(path.join(CONTENT_LIBRARY_ROOT, bookDir, "chapters"));
    const chapters = chapterFiles
      .map((f) => toMobileChapterSummary(ChapterSchema.parse(readJson(f))))
      .sort((a, b) => a.order - b.order);

    const payloadPath = path.join(BOOKS_OUTPUT_ROOT, `${book.slug}.json`);
    if (!fs.existsSync(payloadPath)) {
      missingPayloads += 1;
      console.warn(`  warning: no public/books/${book.slug}.json -- run scripts/build-book-payloads.ts first. Skipped.`);
      continue;
    }
    const payloadBytes = fs.readFileSync(payloadPath);
    const contentHash = crypto.createHash("sha256").update(payloadBytes).digest("hex");
    const stat = fs.statSync(payloadPath);

    entries.push({
      book,
      chapters,
      payloadSchemaVersion: BOOK_PAYLOAD_SCHEMA_VERSION,
      contentHash,
      byteSize: payloadBytes.length,
      url: `${PAGES_BASE_URL}/books/${book.slug}.json`,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  entries.sort((a, b) => a.book.slug.localeCompare(b.book.slug));

  const manifest: ContentManifest = {
    contentManifestVersion: CONTENT_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    books: entries,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest), "utf8");

  console.log(
    `content manifest: ${entries.length} book(s) -> ${path.relative(REPO_ROOT, OUTPUT_FILE)}` +
      `${missingPayloads ? ` (${missingPayloads} book(s) skipped, missing payload)` : ""}`
  );
}

main();
