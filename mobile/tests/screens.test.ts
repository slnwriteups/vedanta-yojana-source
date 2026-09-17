import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBook, loadChapters, loadDivyaDesam, loadDivyaDesams, loadKnowledgeRecord } from "../content-lib/loader.ts";
import { buildMobileSearchCorpus } from "../content-lib/corpus.ts";
import { searchCorpus } from "../../content-lib/search/run.ts";
import { resolveLastRead } from "../content-lib/reading-position.ts";
import type { BookPayload } from "../../content-lib/mobile-content.ts";

/**
 * Phase 6B, Step 10 -- foundation tests for the screen-level data logic
 * each real screen depends on. Deliberately does NOT import any
 * react-native component (app/*.tsx, components/*.tsx): Node has no
 * react-native/Metro runtime, so those files can only be exercised via
 * `npx expo export` (see the Phase 6B report's validation section), the
 * same boundary Phase 6A's loader.test.ts already established. These
 * tests instead prove the underlying data each screen renders is
 * correct, which is the part that can actually break silently.
 */

const BOOK_SLUG = "untitled-recovered-book-pending-editorial-title";

// Book-bundle-removal: resolveLastRead/resolveAllLastRead now take
// loadOfflineBook as an explicit parameter (see reading-position.ts's
// doc comment for why) instead of importing the real
// bookOfflineService.ts adapter, which this plain content-lib test file
// cannot safely import (a top-level `expo-file-system` import crashes
// under `node --test`). This fake reads the REAL generated downloadable
// payload (public/books/<slug>.json, scripts/build-book-payloads.ts) --
// i.e. exactly what a real download would have produced -- rather than
// a synthetic stub, so these tests exercise real content and implicitly
// check that the payload's chapter slugs line up with the bundled
// catalog's. Run `npm run prebuild` (or `node scripts/build-book-payloads.ts`
// directly) first if this file doesn't exist yet.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bookPayloadCache = new Map<string, BookPayload | null>();
function fakeLoadOfflineBook(slug: string): BookPayload | null {
  if (bookPayloadCache.has(slug)) return bookPayloadCache.get(slug)!;
  const payloadPath = path.join(REPO_ROOT, "public", "books", `${slug}.json`);
  const payload = fs.existsSync(payloadPath) ? (JSON.parse(fs.readFileSync(payloadPath, "utf8")) as BookPayload) : null;
  bookPayloadCache.set(slug, payload);
  return payload;
}

test("Home: resolveLastRead resolves a real saved position to its current, real titles", () => {
  const chapters = loadChapters(BOOK_SLUG);
  const position = { bookSlug: BOOK_SLUG, chapterSlug: chapters[0].slug, savedAt: Date.now() };
  const resolved = resolveLastRead(position, null, fakeLoadOfflineBook);
  assert.ok(resolved, "expected a real saved position to resolve");
  assert.equal(resolved!.bookSlug, BOOK_SLUG);
  assert.equal(resolved!.chapterSlug, chapters[0].slug);
  assert.equal(resolved!.bookTitle, "A Brief Insight to Visishtadvaita Philosophy");
  assert.equal(resolved!.chapterTitle, chapters[0].title);
});

test("Home: resolveLastRead returns null (not a crash or a stale title) for a book/chapter that no longer exists", () => {
  assert.equal(resolveLastRead({ bookSlug: "does-not-exist", chapterSlug: "also-not-real", savedAt: Date.now() }, null, fakeLoadOfflineBook), null);
  assert.equal(resolveLastRead({ bookSlug: BOOK_SLUG, chapterSlug: "not-a-real-chapter", savedAt: Date.now() }, null, fakeLoadOfflineBook), null);
});

test("Home: resolveLastRead returns null when there is no saved position at all", () => {
  assert.equal(resolveLastRead(null, null, fakeLoadOfflineBook), null);
});

test("Home: resolveLastRead returns null (not a crash) for a book that has never been downloaded", () => {
  const position = { bookSlug: BOOK_SLUG, chapterSlug: "whatever", savedAt: Date.now() };
  assert.equal(
    resolveLastRead(position, null, () => null),
    null
  );
});

test("Divya Desams: 107 records available for the index screen", () => {
  assert.equal(loadDivyaDesams().length, 107);
});

test("Divya Desams: Sri Rangam resolves for the detail screen", () => {
  const record = loadDivyaDesam("sri-rangam");
  assert.ok(record, "sri-rangam did not resolve");
  assert.equal(record?.displayName, "Sri Raṅgam");
});

test("Divya Desams: an unknown slug is handled as not-found, not a crash", () => {
  assert.equal(loadDivyaDesam("does-not-exist"), null);
});

test("Divya Desams: Phase 6E-C multi-shrine data (Tanjai Mamanikoyil) resolves through the same mobile loader the detail screen uses, with per-shrine templeInformation intact", () => {
  const record = loadDivyaDesam("tanjai-mamanikoyil");
  assert.ok(record, "tanjai-mamanikoyil did not resolve");
  assert.equal(record?.shrines.length, 3);
  for (const shrine of record!.shrines) {
    assert.ok(shrine.name, "expected every shrine to have a name");
    assert.ok(shrine.templeInformation?.moolavar, "expected every shrine to have its own moolavar");
  }
});

test("Divya Desams: every real record's sourceOrder is a valid numeric order (93 included)", () => {
  const records = loadDivyaDesams();
  const numbers = records.map((r) => r.sourceOrder);
  assert.equal(numbers.length, 107);
  assert.ok(numbers.every((n) => Number.isInteger(n) && n > 0));

  const tirukoodal = loadDivyaDesam("tirukoodal");
  assert.equal(tirukoodal!.sourceOrder, 93);
});

test("Library: the recovered Book resolves for the book screen", () => {
  const book = loadBook(BOOK_SLUG);
  assert.ok(book, "the book did not resolve");
  // Phase 6E confirmed "A Brief Insight to Visishtadvaita Philosophy.pdf"
  // as the source for 17 of this book's chapters and supplemented the
  // book's title/author accordingly.
  assert.equal(book?.title, "A Brief Insight to Visishtadvaita Philosophy");
});

test("Library: 51 chapters are available for the book screen, in ascending order", () => {
  const chapters = loadChapters(BOOK_SLUG);
  assert.equal(chapters.length, 51);
  for (let i = 1; i < chapters.length; i++) {
    assert.ok(chapters[i].order > chapters[i - 1].order);
  }
});

test("Library: the bundled chapter list has titles/order but never a body (moved to the downloadable payload)", () => {
  const chapters = loadChapters(BOOK_SLUG);
  assert.ok(chapters[0].title.length > 0);
  assert.ok(!("body" in chapters[0]), "a bundled chapter summary must never carry a body");
});

test("Library: a downloaded chapter's real body loads from its book payload", () => {
  const chapters = loadChapters(BOOK_SLUG);
  const offlineBook = fakeLoadOfflineBook(BOOK_SLUG);
  assert.ok(offlineBook, "expected public/books/*.json to exist -- run `node scripts/build-book-payloads.ts` first");
  const chapter = offlineBook!.chapters.find((c) => c.slug === chapters[0].slug);
  assert.ok(chapter, "the chapter did not resolve in the downloaded payload");
  assert.ok(chapter!.body.length > 0);
});

test("Knowledge: the Introduction record resolves for the Divya Desams introduction screen", () => {
  const record = loadKnowledgeRecord("introduction");
  assert.ok(record, "introduction did not resolve");
  assert.ok(record!.body.length > 0);
});

test("Search: the offline corpus surfaces Sri Rangam for a matching query", () => {
  const corpus = buildMobileSearchCorpus();
  const results = searchCorpus(corpus, "Raṅgam");
  assert.ok(
    results.some((r) => r.href === "/divya-desams/sri-rangam"),
    "expected Sri Rangam among the results"
  );
});

test("Search: an empty query returns no results, not the whole corpus", () => {
  const corpus = buildMobileSearchCorpus();
  assert.equal(searchCorpus(corpus, "").length, 0);
});

test("Search: every result href matches this app's own route shape", () => {
  const corpus = buildMobileSearchCorpus();
  const results = searchCorpus(corpus, "Recovered");
  assert.ok(results.length > 0, "expected at least one result for the book's own title text");
  for (const result of results) {
    assert.match(result.href, /^\/(divya-desams|library)\//);
  }
});
