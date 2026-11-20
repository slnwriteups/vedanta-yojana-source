import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createContentLoader } from "../../content-lib/loader/index.ts";
import { isReleased, pruneBookToChapters, releasedBookAndChapters, releaseToday, todayInIndia } from "../../content-lib/release.ts";
import { ChapterSchema } from "../../content-lib/schemas/index.ts";
import { makeBookInput, makeChapterInput } from "./fixtures/index.ts";
import { cleanupTempContentRoot, makeTempContentRoot, writeJsonFile } from "./fixtures/temp-content-root.ts";

test("todayInIndia is the calendar date in India, not UTC (the 02:47 IST deploy runs at 21:17 UTC the day before)", () => {
  assert.equal(todayInIndia(new Date("2026-12-15T21:17:00Z")), "2026-12-16");
  assert.equal(todayInIndia(new Date("2026-12-15T18:29:00Z")), "2026-12-15");
  assert.equal(todayInIndia(new Date("2026-12-15T18:30:00Z")), "2026-12-16");
});

test("releaseToday honours RELEASE_TODAY and rejects a malformed value", () => {
  const before = process.env.RELEASE_TODAY;
  try {
    process.env.RELEASE_TODAY = "2027-01-14";
    assert.equal(releaseToday(), "2027-01-14");
    process.env.RELEASE_TODAY = "14-01-2027";
    assert.throws(() => releaseToday(), /RELEASE_TODAY/);
  } finally {
    if (before === undefined) delete process.env.RELEASE_TODAY;
    else process.env.RELEASE_TODAY = before;
  }
});

test("isReleased: no releaseDate is always released; otherwise released on and after the date", () => {
  assert.equal(isReleased({}, "2026-12-16"), true);
  assert.equal(isReleased({ releaseDate: "2026-12-16" }, "2026-12-16"), true);
  assert.equal(isReleased({ releaseDate: "2026-12-17" }, "2026-12-16"), false);
});

test("ChapterSchema accepts a YYYY-MM-DD releaseDate and rejects any other shape", () => {
  const ok = ChapterSchema.parse(makeChapterInput({ releaseDate: "2026-12-16" }));
  assert.equal(ok.releaseDate, "2026-12-16");
  assert.throws(() => ChapterSchema.parse(makeChapterInput({ releaseDate: "16-12-2026" })));
  assert.throws(() => ChapterSchema.parse(makeChapterInput({ releaseDate: "2026-02-30" })));
});

test("pruneBookToChapters keeps only released chapters in chapterOrder, parts and groups, dropping empty ones", () => {
  const book = {
    chapterOrder: ["a", "b", "c"],
    parts: [{ title: "P1", order: 1, chapters: ["a", "b"] }, { title: "P2", order: 2, chapters: ["c"] }],
    groups: [{ title: "G", order: 1, chapters: ["a", "b", "c"] }],
  };
  const pruned = pruneBookToChapters(book, new Set(["a"]));
  assert.deepEqual(pruned.chapterOrder, ["a"]);
  assert.deepEqual(pruned.parts.map((p) => p.chapters), [["a"]]);
  assert.deepEqual(pruned.groups.map((g) => g.chapters), [["a"]]);
});

function writeBlog(root: string) {
  const dir = path.join(root, "library", "daily");
  writeJsonFile(path.join(dir, "book.json"), makeBookInput({
    slug: "daily",
    title: "Daily",
    kind: "blog",
    chapterOrder: ["one", "two"],
    parts: [{ title: "Days", order: 1, chapters: ["one", "two"] }],
  }));
  writeJsonFile(path.join(dir, "chapters", "one.json"), makeChapterInput({ slug: "one", title: "One", order: 1, releaseDate: "2026-12-16" }));
  writeJsonFile(path.join(dir, "chapters", "two.json"), makeChapterInput({ slug: "two", title: "Two", order: 2, releaseDate: "2026-12-17" }));
  writeJsonFile(path.join(root, "library", "always", "book.json"), makeBookInput({ slug: "always", title: "Always" }));
  writeJsonFile(path.join(root, "library", "always", "chapters", "x.json"), makeChapterInput({ slug: "x", title: "X", order: 1 }));
}

test("the loader hides unreleased chapters and prunes the book to the released ones", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));
  writeBlog(root);
  const loader = createContentLoader(root, { today: () => "2026-12-16" });
  assert.deepEqual(loader.loadChapters("daily").map((c) => c.slug), ["one"]);
  assert.equal(loader.loadChapter("daily", "two"), null);
  assert.deepEqual(loader.loadBook("daily")?.chapterOrder, ["one"]);
  assert.deepEqual(loader.loadBook("daily")?.parts[0].chapters, ["one"]);
  assert.deepEqual(loader.loadBooks().map((b) => b.slug), ["always", "daily"]);
});

test("a book whose every chapter is unreleased does not exist yet", (t) => {
  const root = makeTempContentRoot();
  t.after(() => cleanupTempContentRoot(root));
  writeBlog(root);
  const loader = createContentLoader(root, { today: () => "2026-12-15" });
  assert.deepEqual(loader.loadBooks().map((b) => b.slug), ["always"]);
  assert.equal(loader.loadBook("daily"), null);
  assert.deepEqual(loader.loadChapters("daily"), []);
  // ...and it all appears on its release day.
  const later = createContentLoader(root, { today: () => "2026-12-17" });
  assert.deepEqual(later.loadChapters("daily").map((c) => c.slug), ["one", "two"]);
});

test("releasedBookAndChapters: what the build scripts publish for a book on a given day", () => {
  const book = { chapterOrder: ["one", "two"], parts: [], groups: [] };
  const chapters = [{ slug: "one", releaseDate: "2026-12-16" }, { slug: "two", releaseDate: "2026-12-17" }];
  assert.equal(releasedBookAndChapters(book, chapters, "2026-12-15"), null);
  const on16 = releasedBookAndChapters(book, chapters, "2026-12-16");
  assert.deepEqual(on16?.chapters.map((c) => c.slug), ["one"]);
  assert.deepEqual(on16?.book.chapterOrder, ["one"]);
  const empty = releasedBookAndChapters(book, [], "2026-12-15");
  assert.equal(empty?.book, book, "a book with no chapters at all is unchanged");
});
