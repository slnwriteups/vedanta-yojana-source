import test from "node:test";
import assert from "node:assert/strict";
import { loadBook, loadChapter, loadChapters, loadDivyaDesam, loadDivyaDesams, loadKnowledgeRecord } from "../content-lib/loader.ts";
import { buildMobileSearchCorpus } from "../content-lib/corpus.ts";
import { searchCorpus } from "../../content-lib/search/run.ts";
import { resolveLastRead } from "../content-lib/reading-position.ts";

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

test("Home: resolveLastRead resolves a real saved position to its current, real titles", () => {
  const chapters = loadChapters(BOOK_SLUG);
  const position = { bookSlug: BOOK_SLUG, chapterSlug: chapters[0].slug, savedAt: Date.now() };
  const resolved = resolveLastRead(position, null);
  assert.ok(resolved, "expected a real saved position to resolve");
  assert.equal(resolved!.bookSlug, BOOK_SLUG);
  assert.equal(resolved!.chapterSlug, chapters[0].slug);
  assert.equal(resolved!.bookTitle, "A Brief Insight to Visishtadvaita Philosophy");
  assert.equal(resolved!.chapterTitle, chapters[0].title);
});

test("Home: resolveLastRead returns null (not a crash or a stale title) for a book/chapter that no longer exists", () => {
  assert.equal(resolveLastRead({ bookSlug: "does-not-exist", chapterSlug: "also-not-real", savedAt: Date.now() }, null), null);
  assert.equal(resolveLastRead({ bookSlug: BOOK_SLUG, chapterSlug: "not-a-real-chapter", savedAt: Date.now() }, null), null);
});

test("Home: resolveLastRead returns null when there is no saved position at all", () => {
  assert.equal(resolveLastRead(null, null), null);
});

test("Divya Desams: 107 records available for the index screen", () => {
  assert.equal(loadDivyaDesams().length, 107);
});

test("Divya Desams: Sri Rangam resolves for the detail screen", () => {
  const record = loadDivyaDesam("sri-rangam");
  assert.ok(record, "sri-rangam did not resolve");
  assert.equal(record?.displayName, "Shri Raṅgam");
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

test("Library: a chapter body loads for the chapter screen", () => {
  const chapters = loadChapters(BOOK_SLUG);
  const chapter = loadChapter(BOOK_SLUG, chapters[0].slug);
  assert.ok(chapter, "the chapter did not resolve");
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
