import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBook, loadChapters, loadDivyaDesam, loadDivyaDesams, loadKnowledge } from "../content-lib/loader.ts";
import { buildMobileSearchCorpus } from "../content-lib/corpus.ts";
import { searchCorpus } from "../../content-lib/search/run.ts";
import { filterResultsByType, CONTENT_TYPE_FILTERS } from "../content-lib/search-filter.ts";
import { findAdjacentChapters } from "../content-lib/chapter-navigation.ts";
import {
  DEFAULT_READING_PREFERENCES,
  FONT_SCALE_STEPS,
  normalizeReadingPreferences,
  isValidLastReadPosition,
  isValidReadingPreferences,
  isValidThemeOverride,
} from "../content-lib/preferences.ts";

/**
 * Phase 6D -- tests for performance/offline-architecture guarantees,
 * reading-experience features, and search filtering. Same boundary as
 * every prior test file in this project: no react-native import, no
 * AsyncStorage import (see storage.ts's own doc comment -- its native
 * module cannot load under plain Node), no image-manifest import (cannot
 * be parsed by Node's loader at all -- see tests/ux.test.ts). Anything
 * needing a real RN/AsyncStorage runtime is proven instead by
 * `npx expo export` in the validation pass documented in the Phase 6D
 * report.
 */

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BOOK_SLUG = "untitled-recovered-book-pending-editorial-title";

test("Offline: no screen or shared module in mobile/ references fetch, XMLHttpRequest, or a network client", () => {
  const roots = ["app", "components", "content-lib"].map((dir) => path.join(MOBILE_ROOT, dir));
  const offenders: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".generated.ts")) {
        const source = fs.readFileSync(full, "utf8");
        if (/\bfetch\s*\(|XMLHttpRequest|axios/.test(source)) offenders.push(path.relative(MOBILE_ROOT, full));
      }
    }
  }

  for (const root of roots) walk(root);
  assert.deepEqual(offenders, []);
});

test("Offline: package.json declares no HTTP client / network dependency", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(MOBILE_ROOT, "package.json"), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const networkPackages = Object.keys(deps).filter((name) => /axios|fetch|apollo|graphql|swr|react-query/i.test(name));
  assert.deepEqual(networkPackages, []);
});

test("Offline: the Home screen never calls a content loader function (no unnecessary blocking on the first screen shown)", () => {
  const homeSource = fs.readFileSync(path.join(MOBILE_ROOT, "app/(tabs)/index.tsx"), "utf8");
  assert.doesNotMatch(homeSource, /\bload(DivyaDesam|Book|Chapter|Knowledge)s?\(/);
});

test("Offline: all content is still reachable after the Phase 6D changes -- 107 Divya Desams, the book's 61 chapters, 1 Knowledge record", () => {
  assert.equal(loadDivyaDesams().length, 107);
  assert.equal(loadChapters(BOOK_SLUG).length, 61);
  assert.equal(loadKnowledge().length, 1);
  assert.ok(loadBook(BOOK_SLUG));
});

test("Performance: repeated buildMobileSearchCorpus() calls return the identical cached array (module-level cache, not rebuilt per call)", () => {
  const first = buildMobileSearchCorpus();
  const second = buildMobileSearchCorpus();
  assert.equal(first, second, "expected the exact same array reference on a second call");
});

test("Reading preferences: the default and every offered font-scale step validate", () => {
  assert.ok(isValidReadingPreferences(DEFAULT_READING_PREFERENCES));
  for (const step of FONT_SCALE_STEPS) {
    assert.ok(isValidReadingPreferences({ fontScale: step.value }), `${step.label} (${step.value}) should validate`);
  }
});

test("Reading preferences: each text-size step is clearly larger than the one before", () => {
  for (let i = 1; i < FONT_SCALE_STEPS.length; i++) {
    const gain = FONT_SCALE_STEPS[i].value - FONT_SCALE_STEPS[i - 1].value;
    assert.ok(gain >= 0.15, `${FONT_SCALE_STEPS[i - 1].label} -> ${FONT_SCALE_STEPS[i].label} grows by only ${gain}`);
  }
});

test("Reading preferences: a size saved under the earlier steps carries over to the same-named step", () => {
  const byLabel = Object.fromEntries(FONT_SCALE_STEPS.map((s) => [s.label, s.value]));
  for (const [old, label] of [[0.9, "Small"], [1, "Medium"], [1.15, "Large"], [1.3, "Extra Large"]] as const) {
    assert.ok(isValidReadingPreferences({ fontScale: old }), `${old} should still load`);
    assert.equal(normalizeReadingPreferences({ fontScale: old }).fontScale, byLabel[label], `${old} -> ${label}`);
  }
  for (const step of FONT_SCALE_STEPS) {
    assert.equal(normalizeReadingPreferences({ fontScale: step.value }).fontScale, step.value);
  }
});

test("Reading preferences: malformed/corrupted stored values are rejected, not trusted", () => {
  assert.equal(isValidReadingPreferences(null), false);
  assert.equal(isValidReadingPreferences({}), false);
  assert.equal(isValidReadingPreferences({ fontScale: "large" }), false);
  assert.equal(isValidReadingPreferences({ fontScale: 2.5 }), false, "2.5 is not one of the offered steps");
});

test("Theme preference: valid values are light/dark/null (system); anything else is rejected", () => {
  assert.equal(isValidThemeOverride("light"), true);
  assert.equal(isValidThemeOverride("dark"), true);
  assert.equal(isValidThemeOverride(null), true);
  assert.equal(isValidThemeOverride("solarized"), false);
  assert.equal(isValidThemeOverride(42), false);
});

test("Last-read position: a well-formed saved position validates", () => {
  assert.ok(isValidLastReadPosition({ bookSlug: "jaya", chapterSlug: "some-chapter", savedAt: Date.now() }));
});

test("Last-read position: malformed/corrupted stored values are rejected, not trusted", () => {
  assert.equal(isValidLastReadPosition(null), false);
  assert.equal(isValidLastReadPosition({}), false);
  assert.equal(isValidLastReadPosition({ bookSlug: "", chapterSlug: "x", savedAt: 1 }), false, "an empty slug is not a real position");
  assert.equal(isValidLastReadPosition({ bookSlug: "jaya", chapterSlug: "x", savedAt: "yesterday" }), false);
  assert.equal(isValidLastReadPosition({ bookSlug: "jaya" }), false, "missing chapterSlug/savedAt");
});

test("Chapter navigation: the first chapter has no previous, the last has no next, and interior chapters have both", () => {
  const chapters = loadChapters(BOOK_SLUG);
  const first = findAdjacentChapters(chapters, chapters[0].slug);
  assert.equal(first.previous, null);
  assert.ok(first.next);

  const last = findAdjacentChapters(chapters, chapters[chapters.length - 1].slug);
  assert.equal(last.next, null);
  assert.ok(last.previous);

  const middle = findAdjacentChapters(chapters, chapters[10].slug);
  assert.equal(middle.previous!.slug, chapters[9].slug);
  assert.equal(middle.next!.slug, chapters[11].slug);
});

test("Chapter navigation: an unknown slug resolves to no previous/next, not a crash", () => {
  const chapters = loadChapters(BOOK_SLUG);
  const result = findAdjacentChapters(chapters, "does-not-exist");
  assert.deepEqual(result, { previous: null, next: null });
});

test("Search filters: filtering by 'divya-desam' returns only Divya Desam results, in the same relative order", () => {
  const ranked = searchCorpus(buildMobileSearchCorpus(), "a");
  const filtered = filterResultsByType(ranked, new Set(["divya-desam"]));
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((r) => r.type === "divya-desam"));

  const rankedDivyaDesamOrder = ranked.filter((r) => r.type === "divya-desam").map((r) => r.href);
  assert.deepEqual(filtered.map((r) => r.href), rankedDivyaDesamOrder);
});

test("Search filters: an empty filter set returns every result, unfiltered", () => {
  const ranked = searchCorpus(buildMobileSearchCorpus(), "Rangam");
  const filtered = filterResultsByType(ranked, new Set());
  assert.deepEqual(filtered, ranked);
});

test("Search filters: every advertised filter option is a real SearchResultType covered by the corpus", () => {
  const ranked = searchCorpus(buildMobileSearchCorpus(), "e");
  const typesPresent = new Set(ranked.map((r) => r.type));
  for (const filter of CONTENT_TYPE_FILTERS) {
    assert.ok(typesPresent.has(filter.value), `expected at least one "${filter.value}" result for a broad query`);
  }
});

test("Library: a blog's count line reads in posts, a book's in chapters, in every language", async () => {
  const { libraryEntryCountLabel } = await import("../ui-strings.ts");
  assert.equal(libraryEntryCountLabel(null, "book", 8), "8 chapters");
  assert.equal(libraryEntryCountLabel(null, "blog", 8), "8 posts");
  assert.equal(libraryEntryCountLabel(null, "blog", 1), "1 post");
  for (const lang of ["ta", "kn", "hi", "te"] as const) {
    assert.notEqual(libraryEntryCountLabel(lang, "blog", 2), libraryEntryCountLabel(lang, "book", 2), lang);
  }
});

test("Library: a blog's entries are numbered as posts, a book's as chapters", async () => {
  const { chapterOrdinalLabel, chapterPositionLabel, continueReadingProgressLabel } = await import("../ui-strings.ts");
  assert.equal(chapterOrdinalLabel(null, 2), "Chapter 2");
  assert.equal(chapterOrdinalLabel(null, 2, "blog"), "Post 2");
  assert.equal(chapterPositionLabel(null, 6, 8), "Chapter 6 of 8");
  assert.equal(chapterPositionLabel(null, 6, 8, "blog"), "Post 6 of 8");
  assert.equal(chapterPositionLabel("ta", 6, 8, "blog"), "பதிவு 6 / 8");
  assert.match(continueReadingProgressLabel(null, 3, 8, 38, 5, "blog"), /^Post 3 of 8 /);
});
