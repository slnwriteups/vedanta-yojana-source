import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createContentLoader } from "../../content-lib/loader/index.ts";
import {
  DuplicateChapterOrderError,
  DuplicateSlugError,
} from "../../content-lib/loader/errors.ts";
import { makeBookInput, makeChapterInput } from "./fixtures/index.ts";
import { cleanupTempContentRoot, makeTempContentRoot, writeJsonFile } from "./fixtures/temp-content-root.ts";

// ---------------------------------------------------------------------------
// B. Empty content repository returns [] for Books.
// ---------------------------------------------------------------------------

test("B: loadBooks() returns [] for an empty content root", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));
  const loader = createContentLoader(root);
  assert.deepEqual(loader.loadBooks(), []);
});

// ---------------------------------------------------------------------------
// E. Missing Book returns the documented not-found value.
// ---------------------------------------------------------------------------

test("E: loadBook() returns null for a slug that doesn't exist", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));
  const loader = createContentLoader(root);
  assert.equal(loader.loadBook("no-such-book"), null);
});

// ---------------------------------------------------------------------------
// F. Missing Chapter returns the documented not-found value.
// ---------------------------------------------------------------------------

test("F: loadChapter() returns null when the book doesn't exist", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));
  const loader = createContentLoader(root);
  assert.equal(loader.loadChapter("no-such-book", "no-such-chapter"), null);
});

test("F: loadChapter() returns null when the book exists but the chapter doesn't", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));
  writeJsonFile(
    path.join(root, "library", "example-book", "book.json"),
    makeBookInput({ slug: "example-book" })
  );
  const loader = createContentLoader(root);
  assert.equal(loader.loadChapter("example-book", "no-such-chapter"), null);
});

// ---------------------------------------------------------------------------
// H. A valid synthetic Book loads.
// ---------------------------------------------------------------------------

test("H: a valid synthetic Book loads", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));
  writeJsonFile(
    path.join(root, "library", "example-book", "book.json"),
    makeBookInput({ slug: "example-book", title: "Example Book" })
  );

  const loader = createContentLoader(root);
  const all = loader.loadBooks();
  assert.equal(all.length, 1);
  assert.equal(all[0].slug, "example-book");
  assert.equal(all[0].status, "draft");

  const single = loader.loadBook("example-book");
  assert.equal(single?.title, "Example Book");
});

// ---------------------------------------------------------------------------
// I. Valid synthetic Chapters load. / J. numeric order, not filesystem order.
// ---------------------------------------------------------------------------

test("I & J: chapters load and are returned in numeric `order`, not filesystem/filename order", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));

  writeJsonFile(
    path.join(root, "library", "example-book", "book.json"),
    makeBookInput({ slug: "example-book" })
  );

  // Filenames are deliberately in the OPPOSITE order from `order`, and
  // lexicographically "z-chapter" < nothing relevant -- the point is the
  // filesystem enumeration (alphabetical by filename) would put these in
  // z, y, x order if order were not explicitly respected.
  writeJsonFile(
    path.join(root, "library", "example-book", "chapters", "z-file.json"),
    makeChapterInput({ slug: "chapter-one", order: 1, title: "Chapter One" })
  );
  writeJsonFile(
    path.join(root, "library", "example-book", "chapters", "y-file.json"),
    makeChapterInput({ slug: "chapter-two", order: 2, title: "Chapter Two" })
  );
  writeJsonFile(
    path.join(root, "library", "example-book", "chapters", "x-file.json"),
    makeChapterInput({ slug: "chapter-three", order: 3, title: "Chapter Three" })
  );

  const loader = createContentLoader(root);
  const chapters = loader.loadChapters("example-book");
  assert.equal(chapters.length, 3);
  assert.deepEqual(
    chapters.map((c) => c.order),
    [1, 2, 3]
  );
  assert.deepEqual(
    chapters.map((c) => c.slug),
    ["chapter-one", "chapter-two", "chapter-three"]
  );
});

// ---------------------------------------------------------------------------
// L. Duplicate Book slugs fail.
// ---------------------------------------------------------------------------

test("L: duplicate Book slugs across two directories throw DuplicateSlugError", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));

  // Two DIFFERENT directories, both declaring the same slug in book.json.
  // This is only possible because directory naming is intentionally NOT
  // required to match the slug (see content-lib/loader/index.ts doc
  // comment) -- and it is exactly this scenario the duplicate-slug check
  // must catch.
  writeJsonFile(
    path.join(root, "library", "directory-one", "book.json"),
    makeBookInput({ slug: "example-book" })
  );
  writeJsonFile(
    path.join(root, "library", "directory-two", "book.json"),
    makeBookInput({ slug: "example-book" })
  );

  const loader = createContentLoader(root);
  assert.throws(() => loader.loadBooks(), DuplicateSlugError);
});

// ---------------------------------------------------------------------------
// M. Duplicate Chapter slugs within one book fail.
// ---------------------------------------------------------------------------

test("M: duplicate chapter slugs within one book throw DuplicateSlugError", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));

  writeJsonFile(
    path.join(root, "library", "example-book", "book.json"),
    makeBookInput({ slug: "example-book" })
  );
  writeJsonFile(
    path.join(root, "library", "example-book", "chapters", "a.json"),
    makeChapterInput({ slug: "example-chapter", order: 1 })
  );
  writeJsonFile(
    path.join(root, "library", "example-book", "chapters", "b.json"),
    makeChapterInput({ slug: "example-chapter", order: 2 })
  );

  const loader = createContentLoader(root);
  assert.throws(() => loader.loadChapters("example-book"), DuplicateSlugError);
});

test("chapter slugs may repeat ACROSS different books (no global uniqueness required)", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));

  writeJsonFile(path.join(root, "library", "book-one", "book.json"), makeBookInput({ slug: "book-one" }));
  writeJsonFile(path.join(root, "library", "book-two", "book.json"), makeBookInput({ slug: "book-two" }));
  writeJsonFile(
    path.join(root, "library", "book-one", "chapters", "a.json"),
    makeChapterInput({ slug: "shared-chapter-slug", order: 1 })
  );
  writeJsonFile(
    path.join(root, "library", "book-two", "chapters", "a.json"),
    makeChapterInput({ slug: "shared-chapter-slug", order: 1 })
  );

  const loader = createContentLoader(root);
  assert.doesNotThrow(() => loader.loadChapters("book-one"));
  assert.doesNotThrow(() => loader.loadChapters("book-two"));
});

// ---------------------------------------------------------------------------
// N. Duplicate Chapter order within one book fails.
// ---------------------------------------------------------------------------

test("N: duplicate chapter `order` within one book throws DuplicateChapterOrderError", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));

  writeJsonFile(
    path.join(root, "library", "example-book", "book.json"),
    makeBookInput({ slug: "example-book" })
  );
  writeJsonFile(
    path.join(root, "library", "example-book", "chapters", "a.json"),
    makeChapterInput({ slug: "chapter-a", order: 1 })
  );
  writeJsonFile(
    path.join(root, "library", "example-book", "chapters", "b.json"),
    makeChapterInput({ slug: "chapter-b", order: 1 })
  );

  const loader = createContentLoader(root);
  assert.throws(() => loader.loadChapters("example-book"), DuplicateChapterOrderError);
});

// ---------------------------------------------------------------------------
// W. Book chapter lookup works through bookSlug + chapterSlug.
// ---------------------------------------------------------------------------

test("W: loadChapter(bookSlug, chapterSlug) resolves the correct chapter", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));

  writeJsonFile(
    path.join(root, "library", "example-book", "book.json"),
    makeBookInput({ slug: "example-book" })
  );
  writeJsonFile(
    path.join(root, "library", "example-book", "chapters", "a.json"),
    makeChapterInput({ slug: "chapter-a", order: 1, title: "Chapter A" })
  );
  writeJsonFile(
    path.join(root, "library", "example-book", "chapters", "b.json"),
    makeChapterInput({ slug: "chapter-b", order: 2, title: "Chapter B" })
  );

  const loader = createContentLoader(root);
  assert.equal(loader.loadChapter("example-book", "chapter-b")?.title, "Chapter B");
  assert.equal(loader.loadChapter("example-book", "chapter-a")?.title, "Chapter A");
});

// ---------------------------------------------------------------------------
// X. Empty chapter directory behaves consistently.
// ---------------------------------------------------------------------------

test("X: a book with no chapters/ directory at all returns []", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));
  writeJsonFile(
    path.join(root, "library", "example-book", "book.json"),
    makeBookInput({ slug: "example-book" })
  );
  const loader = createContentLoader(root);
  assert.deepEqual(loader.loadChapters("example-book"), []);
});

// ---------------------------------------------------------------------------
// Y. Book/chapter directory organization does not silently override
//    validated slug values.
// ---------------------------------------------------------------------------

test("Y: a book's directory name may differ from its validated slug without error or rewriting", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));

  // Directory is named "some-organizational-folder-name"; the book's own
  // book.json declares a completely different slug.
  writeJsonFile(
    path.join(root, "library", "some-organizational-folder-name", "book.json"),
    makeBookInput({ slug: "example-book", title: "Example Book" })
  );

  const loader = createContentLoader(root);

  // The VALIDATED slug (from book.json) is what identity/lookup uses --
  // never the directory name.
  const found = loader.loadBook("example-book");
  assert.notEqual(found, null);
  assert.equal(found?.slug, "example-book");

  // The directory name itself must never work as a lookup key.
  assert.equal(loader.loadBook("some-organizational-folder-name"), null);
});

test("every book's parts list real chapters, each in at most one part, as contiguous runs of chapterOrder", async () => {
  const { loadBooks: loadRealBooks } = await import("../../content-lib/loader/index.ts");
  for (const book of loadRealBooks()) {
    const seen = new Set<string>();
    for (const part of book.parts) {
      assert.ok(part.chapters.length > 0, `${book.slug}: part "${part.title}" has no chapters`);
      const positions = part.chapters.map((slug) => book.chapterOrder.indexOf(slug));
      for (const [i, slug] of part.chapters.entries()) {
        assert.ok(positions[i] !== -1, `${book.slug}: part "${part.title}" lists unknown chapter ${slug}`);
        assert.ok(!seen.has(slug), `${book.slug}: ${slug} is in more than one part`);
        seen.add(slug);
        if (i > 0) assert.equal(positions[i], positions[i - 1] + 1, `${book.slug}: part "${part.title}" is not a contiguous run`);
      }
    }
  }
});

test("groupByPart groups consecutive chapters under their part and keeps overall numbering", async () => {
  const { groupByPart, partTitleFor } = await import("../../content-lib/library-parts.ts");
  const book = { parts: [{ title: "Part A", order: 1, chapters: ["b", "c"] }] };
  const items = ["a", "b", "c", "d"].map((slug) => ({ slug }));
  const groups = groupByPart(book, items);
  assert.deepEqual(groups.map((g) => [g.title, g.items.map((x) => `${x.item.slug}${x.index}`)]), [
    [null, ["a0"]],
    ["Part A", ["b1", "c2"]],
    [null, ["d3"]],
  ]);
  assert.equal(partTitleFor(book, "c"), "Part A");
  assert.equal(partTitleFor(book, "a"), null);
  assert.deepEqual(groupByPart({ parts: [] }, items).length, 1);
});
