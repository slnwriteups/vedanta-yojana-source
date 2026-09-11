import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBooks, loadBook, loadChapters, loadChapter } from "../../content-lib/loader/index.ts";

/**
 * Phase 5L -- tests for the Library/Book/Chapter presentation layer.
 *
 * Same approach as tests/app/divya-desams.test.ts: direct calls into the
 * real loader against the real migrated baseline (proving the data the
 * pages would render is correct), plus static source checks (proving the
 * pages actually consume that loader and never hard-code a record). Live
 * HTTP verification is done separately against a running dev server (see
 * the Phase 5L report).
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BOOK_SLUG = "untitled-recovered-book-pending-editorial-title";
const BOOK_JSON_PATH = path.join(
  REPO_ROOT,
  "content/library",
  BOOK_SLUG,
  "book.json"
);
const CHAPTER_JSON_PATH = path.join(
  REPO_ROOT,
  "content/library",
  BOOK_SLUG,
  "chapters/rama-charama-shlokam.json"
);

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

function readJson(absPath: string): any {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

// ---------------------------------------------------------------------------
// 1-5. LIBRARY index.
// ---------------------------------------------------------------------------

test("1: the Library index page imports and calls loadBooks()", () => {
  const source = read("app/library/page.tsx");
  assert.ok(source.includes("loadBooks"));
  assert.ok(source.includes("@/content-lib/loader"));
});

test("2: the current recovered book's title appears exactly, verbatim, in the real migrated data loadBooks() returns", () => {
  const books = loadBooks();
  assert.equal(books.length, 4);
  // Phase 6E confirmed "A Brief Insight to Visishtadvaita Philosophy.pdf"
  // as the source for 17 of this book's chapters and supplemented the
  // book's title/author accordingly (see content/_provenance/library/).
  // loadBooks() sorts alphabetically by slug, so found by title, not index.
  assert.ok(books.some((b) => b.title === "A Brief Insight to Visishtadvaita Philosophy"));
});

test("3: no application file hard-codes the book's title or slug", () => {
  const indexSource = read("app/library/page.tsx");
  const cardSource = read("components/library/BookCard.tsx");
  const bookPageSource = read("app/library/[book]/page.tsx");
  for (const source of [indexSource, cardSource, bookPageSource]) {
    assert.ok(!source.includes("A Brief Insight to Visishtadvaita Philosophy"), "found the book title hard-coded in application source");
    assert.ok(!source.includes(BOOK_SLUG), "found the book slug hard-coded in application source");
  }
});

test("4: the real book's status is published (finalized once its 4 misplaced chapters were removed) -- BookCard still reuses DraftBadge, which now renders nothing for it", () => {
  const book = loadBook(BOOK_SLUG);
  assert.ok(book);
  assert.equal(book?.status, "published");
  const cardSource = read("components/library/BookCard.tsx");
  assert.ok(cardSource.includes("DraftBadge"));
});

test("5: the Library index page has a graceful empty-state branch (source-level -- no rendering library is installed)", () => {
  const source = read("app/library/page.tsx");
  assert.ok(source.includes("No books are available yet"));
});

// ---------------------------------------------------------------------------
// 6-11. BOOK detail.
// ---------------------------------------------------------------------------

test("6: the Book detail page resolves through loadBook()", () => {
  const source = read("app/library/[book]/page.tsx");
  assert.ok(source.includes("loadBook"));
  const book = loadBook(BOOK_SLUG);
  assert.ok(book);
  assert.equal(book?.slug, BOOK_SLUG);
});

test("7: the Book detail page calls notFound() when loadBook() returns null", () => {
  const source = read("app/library/[book]/page.tsx");
  assert.ok(source.includes("notFound()"));
  assert.equal(loadBook("does-not-exist"), null);
});

test("8: all 51 real chapters are returned by loadChapters() for the real book", () => {
  assert.equal(loadChapters(BOOK_SLUG).length, 51);
});

test("9: chapter ordering from loadChapters() is strictly ascending by `order` (source/provenance ordering, not alphabetical)", () => {
  const chapters = loadChapters(BOOK_SLUG);
  for (let i = 1; i < chapters.length; i++) {
    assert.ok(chapters[i].order > chapters[i - 1].order, `chapters[${i}].order (${chapters[i].order}) is not greater than chapters[${i - 1}].order (${chapters[i - 1].order})`);
  }
});

test("10: chapter titles returned by the loader are byte-identical to the stored JSON -- never modified", () => {
  const stored = readJson(CHAPTER_JSON_PATH);
  const loaded = loadChapter(BOOK_SLUG, "rama-charama-shlokam");
  assert.ok(loaded);
  assert.equal(loaded?.title, stored.title);
  assert.equal(loaded?.body, stored.body);
});

test("11: sourcePageId/extractionConfidence never appear in Library/Book/Chapter application source (only status/needsReview reach DraftBadge)", () => {
  const files = [
    "app/library/page.tsx",
    "app/library/[book]/page.tsx",
    "app/library/[book]/[chapter]/page.tsx",
    "components/library/BookCard.tsx",
    "components/library/ChapterListItem.tsx",
  ];
  for (const relPath of files) {
    const source = read(relPath);
    assert.ok(!source.includes("sourcePageId"), `${relPath} references sourcePageId`);
    assert.ok(!source.includes("extractionConfidence"), `${relPath} references extractionConfidence`);
  }
});

// ---------------------------------------------------------------------------
// 12-18. CHAPTER detail.
// ---------------------------------------------------------------------------

test("12: the Chapter detail page resolves through loadChapter()", () => {
  const source = read("app/library/[book]/[chapter]/page.tsx");
  assert.ok(source.includes("loadChapter"));
});

test("13: the Chapter detail page calls notFound() for a missing book or missing chapter", () => {
  const source = read("app/library/[book]/[chapter]/page.tsx");
  const notFoundCalls = source.match(/notFound\(\)/g) ?? [];
  assert.ok(notFoundCalls.length >= 2, "expected at least 2 notFound() calls (missing book, missing chapter)");
  assert.equal(loadChapter(BOOK_SLUG, "does-not-exist"), null);
  assert.equal(loadChapter("does-not-exist", "rama-charama-shlokam"), null);
});

test("14: chapter title is exact (re-confirms test 10 from the detail-page's own resolution path)", () => {
  const stored = readJson(CHAPTER_JSON_PATH);
  const loaded = loadChapter(BOOK_SLUG, stored.slug);
  assert.equal(loaded?.title, stored.title);
});

test("15/16: chapter body and its paragraph structure are preserved -- the page passes the whole chapter through to LocalizedChapterBody, which renders localizeChapter()'s result through only the same well-tested, non-fabricating helper mobile also applies (stripLeadingDuplicateTitle), never an ad-hoc transformation", () => {
  // The detail page itself no longer renders chapter.body directly: since
  // the reader's language preference is only known client-side (static
  // export, no per-request server), localization moved into
  // LocalizedChapterBody.tsx (content-lib/i18n.ts's localizeChapter,
  // which returns the record completely untouched for English/no
  // translation). displayBody additionally strips a leading line that
  // exactly duplicates the chapter's own title (content-lib/
  // text-format.ts's stripLeadingDuplicateTitle, exact-match only, has
  // its own dedicated test coverage, and mirrors mobile's identical
  // chapter-screen behavior) -- a deliberate, tested display transform,
  // not the kind of ad-hoc mangling this test exists to catch.
  const pageSource = read("app/library/[book]/[chapter]/page.tsx");
  assert.ok(pageSource.includes("chapter={chapter}"), "expected the raw chapter record to be passed to LocalizedChapterBody");

  const bodySource = read("components/library/LocalizedChapterBody.tsx");
  assert.ok(bodySource.includes("stripLeadingDuplicateTitle(localized.body, localized.title)"), "expected only stripLeadingDuplicateTitle applied to localizeChapter()'s body");
  assert.ok(bodySource.includes("text={displayBody}"), "expected the stripped-title body to be passed to LongFormSection");
  assert.ok(
    !/localized\.body\.replace|localized\.body\.trim|localized\.body\.toLowerCase|localized\.body\.toUpperCase|chapter\.body\.replace|chapter\.body\.trim|chapter\.body\.toLowerCase|chapter\.body\.toUpperCase|displayBody\.replace|displayBody\.trim|displayBody\.toLowerCase|displayBody\.toUpperCase/.test(
      bodySource
    ),
    "found a transformation applied to the chapter body"
  );
});

test("17: chapter status reaches the page (DraftBadge reused, now renders nothing since this book's chapters are published)", () => {
  const source = read("app/library/[book]/[chapter]/page.tsx");
  assert.ok(source.includes("DraftBadge"));
  const chapter = loadChapter(BOOK_SLUG, "rama-charama-shlokam");
  assert.equal(chapter?.status, "published");
});

test("18: no migration metadata appears in the Chapter detail page source", () => {
  const source = read("app/library/[book]/[chapter]/page.tsx");
  assert.ok(!source.includes("sourcePageId"));
  assert.ok(!source.includes("extractionConfidence"));
});
