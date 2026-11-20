# Mārgazhi Thingalil Tiruppāvai — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A Library blog released one post per day through Mārgazhi 2026, with ta/kn/hi/te.

**Architecture:** `releaseDate` on chapters, filtered at build time in India time by one
helper used by the loader and the three scripts that read content files directly.
Content is written from verified verses + verbatim slide prose.

**Spec:** `docs/superpowers/specs/2026-11-20-margazhi-tiruppavai-design.md`

## Global Constraints

- "Today" = the calendar date in Asia/Kolkata; `RELEASE_TODAY=YYYY-MM-DD` overrides it.
- A chapter with `releaseDate > today` must not appear in: pages, book page, search index,
  sitemap, `public/books/*.json`, `public/content-manifest.json`, `mobile/content-lib/manifest.generated.ts`.
- Verses only from `source-material/margazhi-thingalil-tiruppavai/verses.json`.
- No What's New entry without the owner's approval.

## Review Focus

1. Build at 21:17 UTC on 15 Dec → Day 1 (16 Dec) is released (India date).
2. A book whose chapters are all unreleased is absent from the Library, sitemap and search.
3. `parts`/`groups`/`chapterOrder` pruned so the book page never names an unreleased chapter.
4. Previous/Next on the last released chapter has no "next" link to an unreleased one.
5. Translations of an unreleased chapter are not leaked through the app payload.

---

### Task 1: Release dates

**Files:** Create `content-lib/release.ts`; modify `content-lib/schemas/chapter.ts`,
`content-lib/mobile-content.ts`, `content-lib/loader/index.ts`, `scripts/build-book-payloads.ts`,
`scripts/build-content-manifest.ts`, `mobile/scripts/generate-content-manifest.ts`.
Test: `tests/content/release.test.ts`.

**Produces:** `todayInIndia(now?: Date): string`; `releaseToday(): string` (env override);
`isReleased(c: { releaseDate?: string }, today: string): boolean`;
`pruneBookToChapters<B>(book: B, released: Set<string>): B` (filters chapterOrder/parts/groups, drops empty parts/groups).

- [ ] Failing tests: `todayInIndia(new Date("2026-12-15T21:17:00Z")) === "2026-12-16"`;
  `isReleased({releaseDate:"2026-12-17"}, "2026-12-16") === false`, `isReleased({}, …) === true`;
  loader with a temp content root and `RELEASE_TODAY` hides future chapters, prunes parts,
  hides an all-future book; `ChapterSchema` rejects `releaseDate: "16-12-2026"`.
- [ ] Implement; apply the same filter in the three scripts.
- [ ] `npm run -s test:content && npm run -s test:app && npm run -s test:mobile` green. Commit.

### Task 2: The blog shell and Day 1

**Files:** `content/library/margazhi-thingalil-tiruppavai/{book.json,chapters/*.json}`,
`scripts/margazhi/build-chapters.ts` (writes chapters from `source-material/…/day-NN.md` + `verses.json`),
cover in `public/book-covers/`, `lib/book-covers.ts`, `mobile/book-covers.ts`.

- [ ] Day 1 as part "Day 1" with 3 chapters, `releaseDate: 2026-12-16`.
- [ ] Count tests updated with `RELEASE_TODAY` pinned where they count chapters.

### Task 3: Days 2–29 transcribed and published (dates per panchangam)
### Task 4: Translations ta/kn/hi/te (verses mechanically from Tamil; prose per guide)
### Task 5: Verify (build with `RELEASE_TODAY=2026-12-16` and `2027-01-13`), push, propose announcement.
