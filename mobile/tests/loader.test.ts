import test from "node:test";
import assert from "node:assert/strict";
import {
  loadDivyaDesams,
  loadDivyaDesam,
  loadBooks,
  loadBook,
  loadChapters,
  loadKnowledge,
  loadKnowledgeRecord,
} from "../content-lib/loader.ts";

/**
 * Phase 6A, Step 6 -- foundation tests for the mobile content bridge.
 * Run via `node --test mobile/tests/*.test.ts`, the same Node-native
 * TypeScript execution used throughout this project (no Jest, no new
 * test framework). These exercise mobile/content-lib/loader.ts directly
 * against the real, generated manifest -- proving the bridge actually
 * resolves real content, not just that it compiles.
 */

test("loadDivyaDesams() resolves all 107 real records", () => {
  assert.equal(loadDivyaDesams().length, 107);
});

test("Sri Rangam resolves with real content intact", () => {
  const record = loadDivyaDesam("sri-rangam");
  assert.ok(record, "sri-rangam did not resolve");
  assert.equal(record?.sourceOrder, 5);
  assert.equal(record?.displayName, "Sri Raṅgam");
  assert.ok(record?.sthalaPuranam);
});

test("Tirukoodal resolves as published/needsReview, matching the web loader's behavior", () => {
  const record = loadDivyaDesam("tirukoodal");
  assert.ok(record, "tirukoodal did not resolve");
  assert.equal(record?.sourceOrder, 93);
  assert.equal(record?.status, "published");
  assert.equal(record?.migration.needsReview, true);
});

test("an unknown Divya Desam slug resolves to null, not an error", () => {
  assert.equal(loadDivyaDesam("does-not-exist"), null);
});

test("the recovered Book resolves with its real title and full chapter set", () => {
  const books = loadBooks();
  assert.equal(books.length, 4);

  const book = loadBook("untitled-recovered-book-pending-editorial-title");
  assert.ok(book, "the book did not resolve");
  // Phase 6E confirmed "A Brief Insight to Visishtadvaita Philosophy.pdf"
  // as the source for 17 of this book's chapters and supplemented the
  // book's title/author accordingly. 4 misplaced Srimad Bhagavatham
  // fragment chapters were later removed, leaving 51.
  assert.equal(book?.title, "A Brief Insight to Visishtadvaita Philosophy");

  const chapters = loadChapters("untitled-recovered-book-pending-editorial-title");
  assert.equal(chapters.length, 51);

  const ramaBook = loadBook("sri-rama-charithram");
  assert.ok(ramaBook, "sri-rama-charithram did not resolve");
  assert.equal(ramaBook?.title, "Sri Rama Charithram");
  assert.equal(loadChapters("sri-rama-charithram").length, 75);

  const bhagavatamBook = loadBook("srimad-bhagavata-kathasagaram");
  assert.ok(bhagavatamBook, "srimad-bhagavata-kathasagaram did not resolve");
  assert.equal(bhagavatamBook?.title, "Srimad Bhagavata Kathasagaram");
  assert.equal(loadChapters("srimad-bhagavata-kathasagaram").length, 31);

  const jayaBook = loadBook("jaya");
  assert.ok(jayaBook, "jaya did not resolve");
  assert.equal(jayaBook?.title, "JAYA: A Journey of the Mahabharata");
  assert.equal(loadChapters("jaya").length, 70);
});

test("chapters are ordered ascending by their own `order` field, not manifest/filesystem order", () => {
  const chapters = loadChapters("untitled-recovered-book-pending-editorial-title");
  for (let i = 1; i < chapters.length; i++) {
    assert.ok(chapters[i].order > chapters[i - 1].order);
  }
});

test("the Knowledge record (Introduction) resolves", () => {
  assert.equal(loadKnowledge().length, 1);
  const record = loadKnowledgeRecord("introduction");
  assert.ok(record, "introduction did not resolve");
  assert.equal(record?.title.length > 0, true);
});

test("Page150 is not reachable through the mobile loader either (no slug was ever assigned to it)", () => {
  const all = loadDivyaDesams();
  assert.equal(all.some((r) => r.sourceOrder === 150), false);
});
