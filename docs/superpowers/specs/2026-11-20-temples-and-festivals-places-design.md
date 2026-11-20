# Temples and Festivals: places above posts — design

Approved by the owner, 20 November 2026 (approach 1 of 3).

## Intent

*Temples and Festivals* is organised by **place**. Under each place come the
posts about it; a long post keeps its sub-chapters underneath:

```
Temples and Festivals
  TIRUMALA
    Navarātri Brahmotsavam
      1. The Festival of Brahmā … 11. The Ninth Day: Chakrasnānam
    12. Jyeṣṭhābhiṣekam
  GURUVĀYŪR
    13–16. The Vow of Pṛśni … The Naming of Guruvāyūr
  PURI
    Snāna Yātrā, Ratha Yātrā
  SRI RANGAM
    Three Lesser-Known Narasiṁha Temples
  PANDHARPUR
    Āṣāḍha Ekādaśī, Chāturmāsya and Pandharpur
```

The five remaining Wix posts are published into it: Jyeṣṭhābhiṣekam →
Tirumala; Snāna Yātrā and Ratha Yātrā → Puri; the Narasiṁha temples →
Sri Rangam; Āṣāḍha Ekādaśī → Pandharpur.

## Goals

- A third level, *place*, above the existing *parts* (one part = one
  multi-chapter post), on the website book page and the app book screen.
- The chapter's label reads `Temples and Festivals · Tirumala · Navarātri Brahmotsavam`
  (place, then part; either is dropped when absent or when it repeats the
  name shown after it).
- Publish the 5 posts, edited to book standard, without disturbing the 15
  existing chapters or their ta/kn/hi/te translations.

## Non-goals

- Translating the 5 new posts (a follow-up; they fall back to English).
- Grouping any other book by place.
- Alt text for the new images (left `needs-review`, as everywhere).

## Anti-goals

- Losing existing translations or chapter URLs (`/library/temples-and-festivals/<slug>` stays).
- Breaking installed apps: an app that doesn't know about places must still
  show the book (it ignores the new field and shows parts as today).

## Approaches considered

1. **Places as a layer above parts (chosen).** `book.groups: [{ title, order,
   chapters, translations }]`, modelled exactly on `parts`. Existing parts
   nest inside. Single-chapter posts are plain chapters under their place.
2. A `place` label on every part — forces every one-chapter post into a part,
   repeating its title as a heading. Rejected.
3. A separate blog per place — loses the single *Temples and Festivals*
   entry the owner asked for. Rejected.

## Design

- **Schema** (`content-lib/schemas/book-parts.ts`): `BookGroupSchema` = same
  shape as `BookPartSchema`. `BookSchema` and `MobileBookSchema` gain
  `groups` (default `[]`). Rule (tested like parts): each group lists real
  chapters, each chapter in at most one group, contiguous runs of
  `chapterOrder`, and no part straddles two groups.
- **Grouping** (`content-lib/library-parts.ts`): `groupByPlace` returns
  place runs, each holding its `groupByPart` runs; numbering continues across
  the whole book. A part heading equal to its place heading is hidden.
  `partLabelFor` includes the place.
- **i18n** (`content-lib/i18n.ts`): `localizeBook` localises group titles as
  it does part titles.
- **Website** (`app/library/[book]/page.tsx`): place heading (h2), then part
  heading (one level down), then the list. Books without groups render
  exactly as today.
- **App** (`mobile/app/(tabs)/library/[book].tsx`, `[chapter].tsx`): place
  heading row, part heading row, chapters; chapter label as on the web. The
  new screens reach installed apps with the next app update/OTA; the content
  reaches them from the next deploy and is harmless before that.
- **Publishing** (`scripts/blog-import/publish-blog.ts`): spec gains
  `"mode": "append"` and per-post `"group"`. Append adds the new chapters
  after the existing ones, keeps existing chapter files, parts and
  translations untouched, and writes `groups` from the spec's `groups` list
  (title + translations + which existing chapters belong).
- **Content**: the 5 posts edited to book standard (owner's own text: fix
  grammar, consistent diacritics, drop blog asides; no additions). Long posts
  (Ratha Yātrā, Āṣāḍha Ekādaśī) split into sub-chapters with `## `; the
  repeated Snāna Yātrā/Anavasara material in Ratha Yātrā trimmed to a short
  bridge so each post reads on its own. Place names translated to ta/kn/hi/te
  per `docs/TRANSLATION-GUIDE.md`.
- Tests: unit tests for grouping and append; content tests updated for the
  new chapter count; `test:content`, `test:app`, `test:mobile` green; a
  screenshot of the web book page.

## Left to the builder

Exact chapter splits and titles; heading styles (following the existing part
heading); the What's New announcement is proposed to the owner, not added.
