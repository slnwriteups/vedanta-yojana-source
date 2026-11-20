# Mārgazhi Thingalil Tiruppāvai — design

Approved by the owner, 20 November 2026.

## Intent

The owner's daily Tiruppāvai posts (Instagram-style slides) become a Library blog,
*Mārgazhi Thingalil Tiruppāvai*, released one post a day through Mārgazhi: Day N on
Mārgazhi N. In 2026 that is 16 Dec 2026 (Day 1) to 14 Jan 2027 (Day 30), as
`content-lib/panchangam-engine.ts` computes for Chennai. Every post has ta/kn/hi/te.

## Goals

- `releaseDate` (YYYY-MM-DD, Asia/Kolkata) on a chapter: until that date the chapter
  does not exist anywhere readers can reach it (website pages, book page, search,
  sitemap, app bundled content, app book payloads, Continue Reading).
- The daily 02:47 IST deploy (21:17 UTC the day before) publishes each day's post:
  "today" is computed in Asia/Kolkata, never UTC.
- A blog whose chapters are all unreleased is not listed at all.
- Day 1 is a part of three chapters (the introduction, the taniyans, pāsuram 1); every
  other day is one chapter: the pāsuram, then the commentary.

## Non-goals / anti-goals

- No client-side hiding (future text must not ship in any public file).
- No new deploy job; no fabricated Day 30 (left out until the owner uploads it).
- Verses are never typed from memory or copied from the slides: they come from the
  Sunder Kidāmbi edition on prapatti.com (`source-material/margazhi-thingalil-tiruppavai/verses.json`,
  rebuilt from both PDFs and checked line by line). The owner's prose is transcribed
  verbatim; corrections are listed per day in `source-material/…/day-NN.md`.

## Approaches considered

1. **Release date filtered at build time (chosen).**
2. Client-side hiding — rejected: future posts would be public in the page data.
3. A daily scheduled commit — rejected: a missed run silently skips a day.

## Design

- Schema: `releaseDate` optional on Chapter (and MobileChapterSummary).
- `content-lib/release.ts`: `todayInIndia(now = new Date())`, `isReleased(record, today)`.
  `RELEASE_TODAY` env var overrides "today" for previews and tests.
- Loader: `loadChapters`/`loadChapter`/`loadBooks` drop unreleased chapters (and
  books left with none); `chapterOrder`, `parts` and `groups` are pruned to match.
  Everything downstream (pages, search, sitemap, payloads, the mobile manifest
  generator) already reads through the loader.
- Verses: English body = romanised (prapatti's, with its font quirks fixed:
  ḻ→ḷ, z→ḻ, ṭr→ṟṟ); the Sanskrit taniyan as Devanagari + IAST. `ta` = Tamil script;
  kn/hi/te transliterated from the Tamil per `docs/TRANSLATION-GUIDE.md` §5.3.
- Cover: the Āṇḍāḷ painting from the title slide.
- The What's New entry is proposed to the owner, not added.
