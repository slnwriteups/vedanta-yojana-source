import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  contentLoader,
  loadDivyaDesams,
  loadDivyaDesam,
  loadBooks,
  loadBook,
  loadChapters,
  loadKnowledgeRecord,
  loadKnowledge,
} from "../../content-lib/loader/index.ts";

/**
 * Phase 5J-B regression tests -- specifically for the DEFAULT content
 * root (the module-level `contentLoader` singleton and its re-exported
 * `load*` functions), which every other loader test deliberately avoids
 * in favor of `createContentLoader(customTempRoot)`. That gap is exactly
 * how the `import.meta.dirname` defect went undetected until Phase 5J's
 * application code became the first real consumer of the default-bound
 * exports. These tests exercise that exact code path against the real,
 * already-migrated `/content` tree.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ---------------------------------------------------------------------------
// A. Default loader root resolves to the real repository /content dir.
// ---------------------------------------------------------------------------

test("A: the default content loader resolves the real repository /content directory, not an empty/wrong one", () => {
  // If DEFAULT_CONTENT_ROOT were wrong (or undefined at construction time,
  // as it was before this fix), every one of these would be empty/null
  // instead of matching the real, already-migrated Phase 5H/5I baseline.
  assert.equal(loadDivyaDesams().length, 107);
  assert.equal(loadBooks().length, 4);
  assert.equal(loadKnowledge().length, 1);
});

test("A: the default loader's resolved root is exactly <repo>/content", () => {
  // Cross-check via an independent method (direct fs listing of the real
  // /content/divya-desams directory) rather than trusting the loader's
  // own count alone.
  const expectedDir = path.join(REPO_ROOT, "content", "divya-desams");
  const expectedCount = fs.readdirSync(expectedDir).filter((f) => f.endsWith(".json")).length;
  assert.equal(loadDivyaDesams().length, expectedCount);
});

// ---------------------------------------------------------------------------
// B. Existing content is readable through the default loader.
// ---------------------------------------------------------------------------

test("B: loadDivyaDesams() returns 107 and loadDivyaDesam() resolves real known slugs", () => {
  assert.equal(loadDivyaDesams().length, 107);

  const sriRangam = loadDivyaDesam("sri-rangam");
  assert.ok(sriRangam);
  assert.equal(sriRangam?.migration.sourcePageId, "page.Page5");

  const tirukoodal = loadDivyaDesam("tirukoodal");
  assert.ok(tirukoodal);
  assert.equal(tirukoodal?.migration.sourcePageId, "page.Page93");
});

test("B: loadBooks()/loadBook()/loadChapters() resolve the real recovered book", () => {
  const books = loadBooks();
  assert.equal(books.length, 4);

  const book = loadBook("untitled-recovered-book-pending-editorial-title");
  assert.ok(book);
  // Phase 6E confirmed "A Brief Insight to Visishtadvaita Philosophy.pdf"
  // as the source for 17 of this book's 55 chapters and supplemented the
  // book's title/author accordingly (see content/_provenance/library/).
  assert.equal(book?.title, "A Brief Insight to Visishtadvaita Philosophy");

  const chapters = loadChapters("untitled-recovered-book-pending-editorial-title");
  assert.equal(chapters.length, 51);

  const ramaBook = loadBook("sri-rama-charithram");
  assert.ok(ramaBook);
  assert.equal(ramaBook?.title, "Sri Rama Charithram");
  const ramaChapters = loadChapters("sri-rama-charithram");
  // Split into 75 individual chapters (one per traditional sub-section
  // within each of the 7 Kandas) rather than 7 Kanda-level entries --
  // see content/library/sri-rama-charithram/book.json's chapterOrder.
  assert.equal(ramaChapters.length, 75);

  const bhagavatamBook = loadBook("srimad-bhagavata-kathasagaram");
  assert.ok(bhagavatamBook);
  assert.equal(bhagavatamBook?.title, "Srimad Bhagavata Kathasagaram");
  const bhagavatamChapters = loadChapters("srimad-bhagavata-kathasagaram");
  assert.equal(bhagavatamChapters.length, 31);

  const jayaBook = loadBook("jaya");
  assert.ok(jayaBook);
  assert.equal(jayaBook?.title, "JAYA: A Journey of the Mahabharata");
  const jayaChapters = loadChapters("jaya");
  assert.equal(jayaChapters.length, 69);
});

test("B: loadKnowledge()/loadKnowledgeRecord() resolve the real Knowledge record", () => {
  assert.equal(loadKnowledge().length, 1);
  const record = loadKnowledgeRecord("introduction");
  assert.ok(record);
  assert.equal(record?.migration.sourcePageId, "page.Page4");
});

// ---------------------------------------------------------------------------
// The pre-bound `contentLoader` object exposes the same behavior as the
// individually re-exported functions (they are the same underlying calls).
// ---------------------------------------------------------------------------

test("the pre-bound contentLoader singleton agrees with the individually re-exported functions", () => {
  assert.equal(contentLoader.loadDivyaDesams().length, loadDivyaDesams().length);
  assert.equal(contentLoader.loadBooks().length, loadBooks().length);
  assert.equal(contentLoader.loadKnowledge().length, loadKnowledge().length);
});
