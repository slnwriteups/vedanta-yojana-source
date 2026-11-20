# Temples and Festivals: places above posts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "place" level above parts in Library entries, and publish the 5 Wix festival posts into *Temples and Festivals* under Tirumala, Puri, Sri Rangam and Pandharpur.

**Architecture:** `book.groups` mirrors `book.parts` (title, order, chapter slugs, translations). `content-lib/library-parts.ts` nests part runs inside place runs; the web page and app screen render both levels. `publish-blog.ts` gains an append mode that never rewrites existing chapters.

**Tech Stack:** TypeScript run directly by Node 22 (`node --test`), zod, Next.js, Expo/React Native.

**Spec:** `docs/superpowers/specs/2026-11-20-temples-and-festivals-places-design.md`

## Global Constraints

- Existing chapter files, slugs, parts and their ta/kn/hi/te translations in `content/library/temples-and-festivals/` stay byte-for-byte unchanged except `book.json` gaining `groups` and new entries.
- Books without `groups` render exactly as today (web and app).
- An app that predates `groups` must still parse the book (zod strips unknown keys; do not make `groups` required anywhere).
- Edited text: owner's own words, book standard (no "in today's post", consistent diacritics: Tirumala, Jyeṣṭhābhiṣekam, Jagannātha, Snāna Yātrā, Ratha Yātrā, Narasiṁha, Āṣāḍha Ekādaśī, Chāturmāsya, Pandharpur, Puṇḍalīka, Viṭṭhala). No added doctrine or quotations.
- Translations follow `docs/TRANSLATION-GUIDE.md` and `docs/translation-glossaries/`.
- No What's New entry without the owner's approval.

## Review Focus

1. A place whose only part has the same title (Guruvāyūr › Guruvāyūr) → one heading, not two; chapter label `Temples and Festivals · Guruvāyūr`.
2. A chapter in a part but no group, or in a group but no part → label and list still correct.
3. Reader language set to Tamil → place headings and labels in Tamil; untranslated new chapter titles in English.
4. Re-running the append spec → no duplicate chapters, existing translations intact (idempotent).
5. Numbering continues 1…N across places (no reset per place).

---

### Task 1: `groups` in schemas and grouping helpers

**Files:**
- Modify: `content-lib/schemas/book-parts.ts` (add `BookGroupSchema`, `BookGroup` type)
- Modify: `content-lib/schemas/book.ts` (`groups: z.array(BookGroupSchema).default([])`)
- Modify: `content-lib/mobile-content.ts` (same field on `MobileBookSchema`)
- Modify: `content-lib/library-parts.ts`
- Modify: `content-lib/i18n.ts` (`localizeBook` localises `groups` like `parts`)
- Test: `tests/content/loader-books.test.ts`, `tests/content/i18n.test.ts`

**Interfaces — Produces:**
- `BookGroupSchema` = same shape as `BookPartSchema`.
- `PartsSource.groups?` same element type as `parts`.
- `interface PlaceGroup<T> { title: string | null; group: Group | null; parts: PartGroup<T>[] }`
- `groupByPlace<T extends { slug: string }>(book: PartsSource, items: T[]): PlaceGroup<T>[]` — consecutive place runs, each split with `groupByPart` logic; `index` stays the overall index. A `PartGroup` whose title equals its place title has `title: null` (heading hidden; `part` kept).
- `placeTitleFor(book, slug): string | null`
- `partLabelFor(book, slug, chapterTitle)` now returns `"Place · Part"`, dropping any segment that is absent or equals the next segment / the chapter title; null when nothing is left.

- [ ] **Step 1: Failing tests**
  - `groupByPlace nests parts inside places and keeps overall numbering`: book `{ groups: [{title:"Tirumala",order:1,chapters:["a","b","c"]},{title:"Guruvāyūr",order:2,chapters:["d","e"]}], parts:[{title:"Brahmotsavam",order:1,chapters:["a","b"]},{title:"Guruvāyūr",order:2,chapters:["d","e"]}] }`, items a–f → `[["Tirumala",[["Brahmotsavam",["a0","b1"]],[null,["c2"]]]],["Guruvāyūr",[[null,["d3","e4"]]]],[null,[[null,["f5"]]]]]`.
  - `partLabelFor joins place and part`: a → `"Tirumala · Brahmotsavam"`, c → `"Tirumala"`, d → `"Guruvāyūr"`, f → `null`; with no groups, behaviour unchanged (existing test stays green).
  - Real-content rule, copy of the parts test for `groups`, plus: `no part straddles two groups`.
  - i18n: `localizeBook` with `language:"ta"` replaces group titles that have `ta` translations.
- [ ] **Step 2:** `node --test tests/content/loader-books.test.ts tests/content/i18n.test.ts` → new tests FAIL.
- [ ] **Step 3:** Implement the interfaces above.
- [ ] **Step 4:** `npm run -s test:content` → all pass.
- [ ] **Step 5:** Commit `Library: optional places (groups) above parts`.

### Task 2: Website book page and chapter label

**Files:**
- Create: `components/library/LocalizedPlaceHeading.tsx` (as `LocalizedPartHeading`, `h2`)
- Modify: `components/library/LocalizedPartHeading.tsx` (prop `level?: 2 | 3`, default 2; `h3` with a smaller class when 3)
- Modify: `app/library/[book]/page.tsx` (render `groupByPlace`; part headings `level={3}` when inside a titled place)
- Modify: `components/library/LocalizedChapterBody.tsx` (label already via `partLabelFor`; must use the localized book)
- Test: `tests/app/library.test.ts`

**Interfaces — Consumes:** Task 1 `groupByPlace`, `partLabelFor`.

- [ ] **Step 1: Failing test** `book page renders places then parts for temples-and-festivals` using the existing test harness pattern in `tests/app/library.test.ts`: headings appear in order Tirumala, Navarātri Brahmotsavam, Guruvāyūr (once), Puri, Ratha Yātrā, Sri Rangam, Pandharpur. (Runs after Task 4 content; until then assert on a fixture book.)
- [ ] **Step 2:** `npm run -s test:app` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm run -s test:app` → PASS; `npm run build` succeeds; Playwright screenshot of `/library/temples-and-festivals` at 390px and 1280px checked by eye.
- [ ] **Step 5:** Commit `Website: show places above posts on a Library entry`.

### Task 3: App book screen and chapter label

**Files:**
- Modify: `mobile/app/(tabs)/library/[book].tsx` (rows: `{ placeHeading }`, `{ heading }`, chapter rows; new `placeHeading` style one step larger than `partHeading`)
- Modify: `mobile/app/(tabs)/library/[book]/[chapter].tsx` (label via new `partLabelFor`, on the localized book)
- Test: `mobile/tests/` — add `library-rows.test.ts` if the row building is extracted to `mobile/lib/library-rows.ts` as `chapterRows(book, chapters)`.

- [ ] **Step 1: Failing test** `chapterRows emits place, part, chapter rows and hides a part heading equal to its place`.
- [ ] **Step 2:** `npm run -s test:mobile` → FAIL.
- [ ] **Step 3:** Extract `chapterRows` and render it.
- [ ] **Step 4:** `npm run -s test:mobile` and `npx tsc -p mobile --noEmit` → PASS.
- [ ] **Step 5:** Commit `App: show places above posts on a Library entry`.

### Task 4: Append mode in `publish-blog.ts`

**Files:**
- Modify: `scripts/blog-import/publish-blog.ts`, `scripts/blog-import/README.md`
- Test: `tests/content/migration/blog-import.test.ts`

**Interfaces — Produces:** `BlogSpec` gains `mode?: "replace" | "append"` (default replace), `groups?: { title: string; translations?: Record<string,{title:string}>; existingChapters?: string[] }[]`, and per post `group?: string` (a group title). Append: read existing `book.json`; keep existing chapter files, `parts`, translations; skip posts whose archive is already `migrated` to this book (idempotent); new chapters get `order` after the last; new parts appended; `groups` rebuilt from the spec in spec order (existing chapters listed in `existingChapters`, new ones by `group`), and must satisfy Task 1's rules (throw otherwise).

- [ ] **Step 1: Failing tests** in a temp dir fixture: `append keeps existing chapters and translations byte-for-byte`, `append adds new chapters and parts after existing ones`, `append writes groups in spec order`, `running append twice changes nothing`.
- [ ] **Step 2:** `node --test tests/content/migration/blog-import.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `Blog publishing: append posts to an existing blog, with places`.

### Task 5: Edit and publish the 5 posts

**Files:**
- Create: `scripts/blog-import/specs/temples-and-festivals-2026-11.json` and its 5 `.txt` files beside it.
- Generated: `content/library/temples-and-festivals/**`, `public/images/*`, `blog-archive/**`, `mobile/content-lib/manifest.generated.ts`
- Modify: `tests/content/migration/migration-full.test.ts` (file count), `tests/app/library.test.ts` if counts change

Spec `groups`, in order: Tirumala (existing: the 11 Brahmotsavam chapters) ← Jyeṣṭhābhiṣekam; Guruvāyūr (existing: 4 chapters); Puri ← Snāna Yātrā, Ratha Yātrā; Sri Rangam ← Narasiṁha temples; Pandharpur ← Āṣāḍha Ekādaśī. Each group gets ta/kn/hi/te titles per the glossaries. The existing part "Tirumala Navarātri Brahmotsavam" keeps its title (the place heading above makes it read as "Tirumala › Tirumala Navarātri Brahmotsavam"; acceptable, leave unchanged to keep its translations).

- [ ] **Step 1:** Edit each post to book standard. Ratha Yātrā and Āṣāḍha Ekādaśī split with `## ` into 3–5 sub-chapters; Ratha Yātrā's Snāna Yātrā/Anavasara section cut to a short bridge pointing back. Place images with `@image N`.
- [ ] **Step 2:** `node scripts/blog-import/publish-blog.ts scripts/blog-import/specs/temples-and-festivals-2026-11.json` then `node mobile/scripts/generate-content-manifest.ts`.
- [ ] **Step 3:** `git diff --stat content/library/temples-and-festivals/chapters` shows only added files.
- [ ] **Step 4:** `npm run -s test:content && npm run -s test:app && npm run -s test:mobile` → all pass (update counts with a comment as the existing tests do).
- [ ] **Step 5:** Screenshot `/library/temples-and-festivals` and one new chapter; commit `Temples and Festivals: Tirumala, Guruvāyūr, Puri, Sri Rangam, Pandharpur`; push.
- [ ] **Step 6:** Propose (not add) a What's New entry to the owner.
