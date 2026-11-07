import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RENAMED_BOOK_SLUGS, canonicalBookSlug, withCanonicalBookSlugs } from "../../content-lib/book-slug-aliases.ts";

const OLD = "untitled-recovered-book-pending-editorial-title";
const NEW = "a-brief-insight-to-visishtadvaita-philosophy";
const LIBRARY_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../content/library");

test("canonicalBookSlug maps a renamed book to its current slug and leaves others alone", () => {
  assert.equal(canonicalBookSlug(OLD), NEW);
  assert.equal(canonicalBookSlug(NEW), NEW);
  assert.equal(canonicalBookSlug("jaya"), "jaya");
});

test("every renamed slug points at a book that exists, and no old slug is still a book", () => {
  for (const [oldSlug, newSlug] of Object.entries(RENAMED_BOOK_SLUGS)) {
    assert.ok(fs.existsSync(path.join(LIBRARY_DIR, newSlug, "book.json")), `${newSlug} is not a book`);
    assert.ok(!fs.existsSync(path.join(LIBRARY_DIR, oldSlug)), `${oldSlug} still exists as a book`);
  }
});

test("withCanonicalBookSlugs rewrites saved reading positions, keeping the newest per book", () => {
  const saved = [
    { bookSlug: OLD, chapterSlug: "aathma", savedAt: 1 },
    { bookSlug: "jaya", chapterSlug: "c1", savedAt: 2 },
    { bookSlug: NEW, chapterSlug: "tattvas", savedAt: 3 },
  ];
  const result = withCanonicalBookSlugs(saved, (e) => e.bookSlug);
  assert.deepEqual(result, [
    { bookSlug: "jaya", chapterSlug: "c1", savedAt: 2 },
    { bookSlug: NEW, chapterSlug: "tattvas", savedAt: 3 },
  ]);
});

test("withCanonicalBookSlugs rewrites bookmarks without merging different chapters", () => {
  const saved = [
    { bookSlug: OLD, chapterSlug: "aathma", savedAt: 1 },
    { bookSlug: OLD, chapterSlug: "tattvas", savedAt: 2 },
  ];
  const result = withCanonicalBookSlugs(saved, (e) => `${e.bookSlug}/${e.chapterSlug}`);
  assert.deepEqual(result, [
    { bookSlug: NEW, chapterSlug: "aathma", savedAt: 1 },
    { bookSlug: NEW, chapterSlug: "tattvas", savedAt: 2 },
  ]);
});

test("withCanonicalBookSlugs returns the same array when nothing was renamed", () => {
  const saved = [{ bookSlug: "jaya", chapterSlug: "c1", savedAt: 2 }];
  assert.equal(withCanonicalBookSlugs(saved, (e) => e.bookSlug), saved);
});
