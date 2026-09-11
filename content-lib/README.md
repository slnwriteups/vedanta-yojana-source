# /content-lib

The typed content boundary, per the non-negotiable content/code separation
rule:

```
/content  →  /content-lib (schemas + loader)  →  /app  →  /components
```

`/app` and `/components` will only ever receive typed content objects
produced by this layer — never read `/content` directly, and never
contain hardcoded recovered content.

## Layout

```
content-lib/
├── schemas/     Phase 5C — Zod schemas + inferred TypeScript types
│   ├── shared.ts        status, migration metadata, slug, image, relationships
│   ├── divya-desam.ts   DivyaDesam, TempleInformation, Shrine, ResourceEntry
│   ├── book.ts           Book, BookPart
│   ├── chapter.ts        Chapter
│   ├── knowledge.ts      Knowledge
│   └── index.ts          barrel export — the schema contract
├── loader/      Phase 5D — reads /content, validates every file, returns typed objects
│   ├── errors.ts    structured error types (malformed JSON, schema failure, duplicates)
│   ├── fs-utils.ts  internal-only filesystem helpers (not part of the public API)
│   └── index.ts     public API: createContentLoader() + the default loadX() functions
├── search/       Phase 5M — pure, framework-agnostic search (no node:fs anywhere
│   │             in this directory, so it also runs unmodified on mobile)
│   ├── types.ts, corpus.ts, match.ts, rank.ts, excerpt.ts, index.ts, run.ts
│   └── (see content-lib/search/README.md if present, or the module doc
│         comments — corpus.ts is the only file that touches the loader)
├── i18n.ts       localize{DivyaDesam,Book,Chapter,Knowledge}() — applies a
│   │             record's own translations[language] over its English base,
│   │             field-by-field, non-mutating. Consumed by both runtimes:
│   │             the mobile app directly, and the website from small
│   │             "use client" leaf components (e.g. components/divya-desams/
│   │             LocalizedDivyaDesamContent.tsx) — the reader's language
│   │             preference is only known client-side on a static export,
│   │             so the site itself always prerenders English and swaps
│   │             in a translation after mount.
├── ordering.ts   sourcePageNumber()/divyaDesamNumberLabels() — the shared
│   │             traditional-pilgrimage-order sort, used by both runtimes'
│   │             Divya Desam index pages
├── divya-desam-region-labels.ts   regionLabel() — native-script
│   │             transliterations of the seven regional classifications
├── divya-desam-spotlight.ts   pickSpotlightRecord() and its seeded-shuffle
│   │             day-rotation math, shared by both runtimes' home-screen
│   │             "Divya Desam Spotlight" card
└── text-format.ts   splitIntoReadableParagraphs() and related pure prose
                      chunking helpers shared by both runtimes
```

## Schemas (Phase 5C)

Every content type — Divya Desam, Book, Chapter, Knowledge — has a Zod
schema that is the single source of truth for both runtime validation and
the inferred TypeScript type (`z.infer<typeof Schema>`). Key structural
guarantees, enforced by the schemas themselves:

- `status` defaults to `"draft"` everywhere. No schema defaults to
  `"published"`. Extraction confidence (`migration.extractionConfidence`)
  never influences `status`.
- Every optional field is genuinely optional — the schemas tolerate the
  legitimate variation already found in the source (e.g. a Divya Desam
  missing `sthalaPuranam`, zero images, zero shrines).
- Image `alt` text is never fabricated (`alt: string | null`); `altStatus`
  defaults to `"needs-review"`.
- The same image asset may legitimately appear on more than one content
  record — nothing in the schema layer enforces one-record-per-asset.

## Loader (Phase 5D)

The loader reads **only** from `/content` (JSON files). It never reads
`content-extraction/`, `images/`, or any historical SAP file — those are
migration source material, entirely outside this module's boundary. A
later, separate migration phase is what will eventually populate
`/content` from `content-extraction/`; the loader has no knowledge of that
process.

### Public API

```ts
loadDivyaDesams(): DivyaDesam[]
loadDivyaDesam(slug: string): DivyaDesam | null

loadBooks(): Book[]
loadBook(slug: string): Book | null

loadChapters(bookSlug: string): Chapter[]
loadChapter(bookSlug: string, chapterSlug: string): Chapter | null

loadKnowledge(): Knowledge[]
loadKnowledgeRecord(slug: string): Knowledge | null
```

Import from `content-lib/loader` (or, inside `/app`, via the `@/...`
alias — `@/content-lib/loader`). All of the above are pre-bound to the
real `/content` directory. `createContentLoader(contentRoot)` is also
exported for creating an independently-rooted loader instance (used by
tests to point at an isolated temporary directory — see
`tests/content/README.md`).

### Not-found convention

Every **single-record** lookup returns `null` when nothing matches —
never `undefined`, never a thrown error. Every **collection** loader
returns `[]` for an empty or nonexistent content directory. An empty
`/content` (its current, real state) is not an error condition anywhere
in this API.

Thrown errors (`content-lib/loader/errors.ts`) are reserved for actual
content problems: malformed JSON, a file that fails its Zod schema, a
duplicate slug within a collection, or duplicate chapter `order` within
one book. These always identify the offending file path.

### Ordering

- `loadDivyaDesams()` / `loadBooks()` / `loadKnowledge()` are sorted by
  `slug`, for deterministic output independent of filesystem enumeration
  order.
- `loadChapters(bookSlug)` is sorted by `chapter.order` ascending —
  **never** by filename or slug. Duplicate `order` values within one book
  throw rather than silently picking a winner.

### Book/chapter directory structure

```
content/library/<directory-name>/book.json
content/library/<directory-name>/chapters/*.json
```

The directory name is organizational only. The book's identity for every
lookup is its **validated** `slug` field inside `book.json` — the loader
never infers or rewrites a slug from a directory name, and a directory
name is never required to match its book's slug (this is deliberate: it's
what allows two different book directories to be correctly detected as a
*duplicate slug* error, rather than being silently prevented from
existing in the first place — see the doc comment at the top of
`content-lib/loader/index.ts` for the full reasoning).

### Path safety

Slug-based lookups never build a filesystem path from caller-supplied
input. Every lookup loads the already-discovered, already-validated
collection and matches the requested slug in memory against each
record's own validated `slug`. A malformed or malicious slug (e.g.
`"../../etc/passwd"`) is also rejected immediately by the slug-format
check before any filesystem access — but even without that check, there
is no code path where such a value could reach `fs.readFileSync`.

### Server-side boundary

The loader uses `node:fs`/`node:path` directly and must never be imported
into a Client Component. No extra package was installed to enforce this —
Next.js's own bundler already refuses to bundle `node:fs` for the client,
so an accidental client-side import fails the build on its own.

## Current /content state

Migration is no longer a future phase — it has run. `/content` holds:

- **107** Divya Desam records (`content/divya-desams/`)
- **4** Books (`content/library/`): the original recovered book (55
  chapters), *Sri Rama Charithram* (7), *Srimad Bhagavata Kathasagaram*
  (31), and *JAYA: A Journey of the Mahabharata* (69) — **162 chapters
  total**
- **1** Knowledge record (`content/knowledge/`)

`tests/content/migration/migration-full.test.ts` pins the exact file count
under `/content` (293 as of this writing) as a regression guard — update
that test's assertion (and its explanatory comment) whenever content is
added or removed.

## What's still not here

- No MDX/Markdown/YAML/frontmatter support — `/content` is JSON-only.
  A richer format for long-form bodies, if ever adopted, is a distinct,
  explicitly-approved future decision.
- No caching layer in the web loader beyond what's naturally implied by
  reading small JSON files synchronously — content volume doesn't
  currently justify one. (The mobile loader *does* cache — see
  `mobile/content-lib/loader.ts` and `mobile/README.md`, a deliberate,
  disclosed difference driven by its build-time-bundled runtime model.)
