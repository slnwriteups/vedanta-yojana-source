import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadChapters } from "../content-lib/loader.ts";
import { resolveAllLastRead } from "../content-lib/reading-position.ts";
import { isValidLastReadPosition } from "../content-lib/preferences.ts";
import { isValidLastReadPosition as isValidWebLastReadPosition } from "../../lib/preferences.ts";
import { CHAPTER_END_THRESHOLD, continueReadingPercent, isFinishedPosition } from "../../content-lib/reading-progress.ts";
import type { BookPayload } from "../../content-lib/mobile-content.ts";

/**
 * A finished book leaves "Continue Reading", on the app and the website
 * alike (content-lib/reading-progress.ts). Uses the real generated book
 * payloads (public/books/<slug>.json, from `npm run prebuild`), like
 * tests/screens.test.ts.
 */

const BOOK_SLUG = "a-brief-insight-to-visishtadvaita-philosophy";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadPayload(slug: string): BookPayload | null {
  const file = path.join(REPO_ROOT, "public", "books", `${slug}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as BookPayload) : null;
}

test("Percent: chapters before the open one count; never 100% while a chapter is open", () => {
  assert.equal(continueReadingPercent(1, 61), 0);
  assert.equal(continueReadingPercent(31, 61), 49);
  assert.equal(continueReadingPercent(61, 61), 98);
  assert.equal(continueReadingPercent(1, 1), 0);
  assert.equal(continueReadingPercent(200, 200), 99);
  assert.equal(continueReadingPercent(0, 10), 0);
  assert.equal(continueReadingPercent(3, 0), 0);
});

test("Finished: only when marked AND the chapter is still the book's last", () => {
  assert.equal(isFinishedPosition({ finished: true }, 61, 61), true);
  assert.equal(isFinishedPosition({}, 61, 61), false);
  assert.equal(isFinishedPosition({ finished: false }, 61, 61), false);
  // Chapters added after it later: the book comes back.
  assert.equal(isFinishedPosition({ finished: true }, 61, 64), false);
  assert.ok(CHAPTER_END_THRESHOLD > 0.9 && CHAPTER_END_THRESHOLD <= 1);
});

test("Saved positions: the finished flag is optional and validated on both platforms", () => {
  for (const validate of [isValidLastReadPosition, isValidWebLastReadPosition]) {
    assert.equal(validate({ bookSlug: "b", chapterSlug: "c", savedAt: 1 }), true);
    assert.equal(validate({ bookSlug: "b", chapterSlug: "c", savedAt: 1, finished: true }), true);
    assert.equal(validate({ bookSlug: "b", chapterSlug: "c", savedAt: 1, finished: "yes" }), false);
  }
});

test("Continue Reading: a book finished at its last chapter is dropped; others stay", { skip: loadPayload(BOOK_SLUG) ? false : "run `npm run prebuild` first" }, () => {
  const chapters = loadChapters(BOOK_SLUG);
  const last = chapters[chapters.length - 1].slug;
  const earlier = chapters[3].slug;

  const finished = resolveAllLastRead([{ bookSlug: BOOK_SLUG, chapterSlug: last, savedAt: 2, finished: true }], null, loadPayload);
  assert.deepEqual(finished, []);

  const onLastChapter = resolveAllLastRead([{ bookSlug: BOOK_SLUG, chapterSlug: last, savedAt: 2 }], null, loadPayload);
  assert.equal(onLastChapter.length, 1, "reading the last chapter but not at its end: still shown");

  // A stale flag on a non-last chapter never hides the book.
  const stale = resolveAllLastRead([{ bookSlug: BOOK_SLUG, chapterSlug: earlier, savedAt: 2, finished: true }], null, loadPayload);
  assert.equal(stale.length, 1);
});
