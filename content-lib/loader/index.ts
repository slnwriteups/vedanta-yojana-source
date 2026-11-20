import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ZodSafeParseResult, ZodError } from "zod";
import {
  BookSchema,
  ChapterSchema,
  DivyaDesamSchema,
  KnowledgeSchema,
  SlugSchema,
  type Book,
  type Chapter,
  type DivyaDesam,
  type Knowledge,
} from "../schemas/index.ts";
import {
  ContentValidationError,
  DuplicateChapterOrderError,
  DuplicateSlugError,
} from "./errors.ts";
import { listJsonFiles, listSubdirectories, readJsonFile } from "./fs-utils.ts";
import { isReleased, pruneBookToChapters, releaseToday } from "../release.ts";

/**
 * Content loader — Phase 5D.
 *
 *   /content (JSON files)  →  loader (this module)  →  Zod validation  →  typed objects
 *
 * SERVER-ONLY BOUNDARY: this module reads the filesystem directly
 * (`node:fs`/`node:path`) and must never be imported into a Client
 * Component. No extra dependency (e.g. the `server-only` package) was
 * added to enforce this — it doesn't need one. `node:fs` cannot be
 * bundled for the browser at all, so Next.js's own bundler already fails
 * the build if a Client Component ever imports this module transitively.
 * That existing Next.js behavior IS the enforcement mechanism.
 *
 * NOT-FOUND CONVENTION: every single-record lookup (`loadDivyaDesam`,
 * `loadBook`, `loadChapter`, `loadKnowledgeRecord`) returns `null` — never
 * `undefined`, never a thrown error — when no matching record exists.
 * Collection loaders return `[]` for an empty/nonexistent collection.
 * Thrown errors (see ./errors.ts) are reserved for actual content
 * problems: malformed JSON, schema-invalid records, duplicate slugs, or
 * duplicate chapter order — never for "nothing here yet".
 *
 * PATH SAFETY: lookup values (slugs) are never concatenated into a
 * filesystem path. Every lookup function loads the full (already
 * filesystem-discovered, already-validated) collection and matches the
 * requested slug against each record's *validated* `slug` field in
 * memory. A caller-supplied value like `"../../etc/passwd"` is therefore
 * structurally incapable of reaching the filesystem — there is no code
 * path where it is ever joined onto a directory. It is additionally
 * rejected immediately by `SlugSchema` before any collection is even
 * loaded, per Phase 5C's kebab-case-only slug format.
 *
 * BOOK DIRECTORY NAMING: per the Phase 5A/5C architecture, a book's
 * directory name under `content/library/` is organizational only — the
 * book's validated `slug` (from its `book.json`) is always what the
 * loader uses for identity, and directory names are never required to
 * match it. (An earlier draft of this loader considered hard-erroring on
 * a directory/slug mismatch as an "obvious structural mismatch" check;
 * that was deliberately NOT implemented here, because doing so would
 * make it impossible to construct two different book directories that
 * validate to the same slug — which is exactly the scenario the required
 * duplicate-book-slug test needs to exercise. Directory naming is left
 * fully free-form; duplicate *slugs* are still always rejected below,
 * regardless of which directories they came from.)
 */

// ---------------------------------------------------------------------------
// Internal: generic collection loading
// ---------------------------------------------------------------------------

interface Discovered<T> {
  record: T;
  filePath: string;
}

interface ZodLikeSchema<T> {
  safeParse(data: unknown): ZodSafeParseResult<T>;
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.length ? issue.path.join(".") : "(root)"}: ${issue.message}`)
    .join("\n");
}

function loadAndValidateJsonFiles<T>(
  filePaths: string[],
  schema: ZodLikeSchema<T>,
  contentTypeLabel: string
): Discovered<T>[] {
  return filePaths.map((filePath) => {
    const raw = readJsonFile(filePath); // throws MalformedJsonError internally
    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new ContentValidationError(filePath, contentTypeLabel, formatZodError(result.error));
    }
    return { record: result.data, filePath };
  });
}

function assertNoDuplicateSlugs<T extends { slug: string }>(
  discovered: Discovered<T>[],
  contentTypeLabel: string
): void {
  const bySlug = new Map<string, string[]>();
  for (const { record, filePath } of discovered) {
    const list = bySlug.get(record.slug) ?? [];
    list.push(filePath);
    bySlug.set(record.slug, list);
  }
  for (const [slug, filePaths] of bySlug) {
    if (filePaths.length > 1) {
      throw new DuplicateSlugError(contentTypeLabel, slug, filePaths);
    }
  }
}

function isValidSlugShape(value: string): boolean {
  return SlugSchema.safeParse(value).success;
}

// ---------------------------------------------------------------------------
// Internal: Divya Desams
// ---------------------------------------------------------------------------

function loadDivyaDesamsFrom(contentRoot: string): DivyaDesam[] {
  const dir = path.join(contentRoot, "divya-desams");
  const discovered = loadAndValidateJsonFiles(listJsonFiles(dir), DivyaDesamSchema, "Divya Desam");
  assertNoDuplicateSlugs(discovered, "Divya Desam");
  return discovered.map((d) => d.record).sort((a, b) => a.slug.localeCompare(b.slug));
}

function loadDivyaDesamFrom(contentRoot: string, slug: string): DivyaDesam | null {
  if (!isValidSlugShape(slug)) return null;
  return loadDivyaDesamsFrom(contentRoot).find((d) => d.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Internal: Knowledge
// ---------------------------------------------------------------------------

function loadKnowledgeFrom(contentRoot: string): Knowledge[] {
  const dir = path.join(contentRoot, "knowledge");
  const discovered = loadAndValidateJsonFiles(listJsonFiles(dir), KnowledgeSchema, "Knowledge");
  assertNoDuplicateSlugs(discovered, "Knowledge");
  return discovered.map((d) => d.record).sort((a, b) => a.slug.localeCompare(b.slug));
}

function loadKnowledgeRecordFrom(contentRoot: string, slug: string): Knowledge | null {
  if (!isValidSlugShape(slug)) return null;
  return loadKnowledgeFrom(contentRoot).find((k) => k.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Internal: Books + Chapters
// ---------------------------------------------------------------------------

interface DiscoveredBook {
  book: Book;
  /** content/library/<directoryName>/ — organizational only, see module doc comment. */
  directoryName: string;
  bookJsonPath: string;
  chaptersDir: string;
}

function discoverBooksFrom(contentRoot: string): DiscoveredBook[] {
  const libraryDir = path.join(contentRoot, "library");
  const directoryNames = listSubdirectories(libraryDir);

  const discovered: DiscoveredBook[] = directoryNames.map((directoryName) => {
    const bookDir = path.join(libraryDir, directoryName);
    const bookJsonPath = path.join(bookDir, "book.json");

    if (!fs.existsSync(bookJsonPath)) {
      throw new ContentValidationError(
        bookJsonPath,
        "Book",
        `Expected a "book.json" file inside directory "${directoryName}" but none was found.`
      );
    }

    const raw = readJsonFile(bookJsonPath);
    const result = BookSchema.safeParse(raw);
    if (!result.success) {
      throw new ContentValidationError(bookJsonPath, "Book", formatZodError(result.error));
    }

    return {
      book: result.data,
      directoryName,
      bookJsonPath,
      chaptersDir: path.join(bookDir, "chapters"),
    };
  });

  assertNoDuplicateSlugs(
    discovered.map((d) => ({ record: d.book, filePath: d.bookJsonPath })),
    "Book"
  );

  return discovered.sort((a, b) => a.book.slug.localeCompare(b.book.slug));
}

function loadBookFrom(contentRoot: string, slug: string): Book | null {
  if (!isValidSlugShape(slug)) return null;
  return discoverBooksFrom(contentRoot).find((d) => d.book.slug === slug)?.book ?? null;
}

/**
 * Releases (content-lib/release.ts): a chapter whose releaseDate is after
 * `today` does not exist yet, the book is cut down to its released chapters,
 * and a book with none released does not exist yet either. A book with no
 * chapters at all is left alone (unchanged behaviour for empty books).
 */
function releasedBook(contentRoot: string, book: Book, today: string): Book | null {
  const all = loadAllChaptersFrom(contentRoot, book.slug);
  const released = all.filter((c) => isReleased(c, today));
  if (released.length === all.length) return book;
  if (released.length === 0) return null;
  return pruneBookToChapters(book, new Set(released.map((c) => c.slug)));
}

function loadChaptersFrom(contentRoot: string, bookSlug: string, today: string): Chapter[] {
  return loadAllChaptersFrom(contentRoot, bookSlug).filter((c) => isReleased(c, today));
}

function loadAllChaptersFrom(contentRoot: string, bookSlug: string): Chapter[] {
  if (!isValidSlugShape(bookSlug)) return [];

  const match = discoverBooksFrom(contentRoot).find((d) => d.book.slug === bookSlug);
  if (!match) return []; // Book doesn't exist -> empty collection, same convention as every other collection.

  const discovered = loadAndValidateJsonFiles(
    listJsonFiles(match.chaptersDir), // [] if the chapters/ directory doesn't exist yet
    ChapterSchema,
    "Chapter"
  );

  // Chapter slugs unique WITHIN this one book only (Phase 5C/5D: no
  // global cross-book chapter-slug uniqueness is required or checked).
  assertNoDuplicateSlugs(discovered, "Chapter");

  const byOrder = new Map<number, string[]>();
  for (const { record, filePath } of discovered) {
    const list = byOrder.get(record.order) ?? [];
    list.push(filePath);
    byOrder.set(record.order, list);
  }
  for (const [order, filePaths] of byOrder) {
    if (filePaths.length > 1) {
      throw new DuplicateChapterOrderError(bookSlug, order, filePaths);
    }
  }

  // Ordering is ALWAYS by chapter.order ascending -- never filesystem
  // enumeration order (which listJsonFiles happens to sort lexicographically
  // by filename, but that is explicitly not relied upon here).
  return discovered.map((d) => d.record).sort((a, b) => a.order - b.order);
}

function loadChapterFrom(
  contentRoot: string,
  bookSlug: string,
  chapterSlug: string,
  today: string
): Chapter | null {
  if (!isValidSlugShape(bookSlug) || !isValidSlugShape(chapterSlug)) return null;
  return loadChaptersFrom(contentRoot, bookSlug, today).find((c) => c.slug === chapterSlug) ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ContentLoader {
  loadDivyaDesams(): DivyaDesam[];
  loadDivyaDesam(slug: string): DivyaDesam | null;

  loadBooks(): Book[];
  loadBook(slug: string): Book | null;

  loadChapters(bookSlug: string): Chapter[];
  loadChapter(bookSlug: string, chapterSlug: string): Chapter | null;

  loadKnowledge(): Knowledge[];
  loadKnowledgeRecord(slug: string): Knowledge | null;
}

/**
 * Creates a content loader bound to a specific content root directory.
 *
 * Production code should not normally need this — use the pre-bound
 * `contentLoader` (or the individual `load*` exports) below, which point
 * at the real `/content` directory. `createContentLoader` exists so tests
 * can point an otherwise-identical loader at an isolated temporary
 * directory, without any shared mutable state, environment variables, or
 * weakening of the production path-safety behavior.
 */
export function createContentLoader(
  contentRoot: string,
  options: { today?: () => string } = {}
): ContentLoader {
  const today = options.today ?? releaseToday;
  return {
    loadDivyaDesams: () => loadDivyaDesamsFrom(contentRoot),
    loadDivyaDesam: (slug) => loadDivyaDesamFrom(contentRoot, slug),

    loadBooks: () => {
      const t = today();
      return discoverBooksFrom(contentRoot).flatMap((d) => releasedBook(contentRoot, d.book, t) ?? []);
    },
    loadBook: (slug) => {
      const book = loadBookFrom(contentRoot, slug);
      return book ? releasedBook(contentRoot, book, today()) : null;
    },

    loadChapters: (bookSlug) => {
      const t = today();
      const book = loadBookFrom(contentRoot, bookSlug);
      return book && releasedBook(contentRoot, book, t) ? loadChaptersFrom(contentRoot, bookSlug, t) : [];
    },
    loadChapter: (bookSlug, chapterSlug) => loadChapterFrom(contentRoot, bookSlug, chapterSlug, today()),

    loadKnowledge: () => loadKnowledgeFrom(contentRoot),
    loadKnowledgeRecord: (slug) => loadKnowledgeRecordFrom(contentRoot, slug),
  };
}

/**
 * The real, production `/content` directory at the repository root.
 *
 * Resolved via `fileURLToPath(import.meta.url)` + `path.dirname`, not the
 * newer `import.meta.dirname` (Node 20.11+/21.2+) this used previously.
 * `import.meta.dirname` is a Node-specific convenience property, not
 * something the ECMAScript module spec requires bundlers to populate --
 * Phase 5J discovered it evaluates to `undefined` once this module is
 * bundled/relocated by Next.js (reproduced under both Turbopack and
 * webpack, in both `next dev` and `next build`), which crashed every
 * route that imported the loader. `import.meta.url`, by contrast, is a
 * standard, spec-guaranteed module property that both bundlers rewrite to
 * a correct, resolvable file URL for the module's own location -- this
 * was verified empirically (not assumed) by testing this exact change
 * against a real `next build` and `next dev`, confirming
 * `loadDivyaDesams()` etc. resolve the real 107/55/1/1-record baseline
 * from inside the running application, not merely that the crash stopped.
 */
const DEFAULT_CONTENT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../content"
);

/** The default content loader, bound to the real `/content` directory. */
export const contentLoader: ContentLoader = createContentLoader(DEFAULT_CONTENT_ROOT);

export const {
  loadDivyaDesams,
  loadDivyaDesam,
  loadBooks,
  loadBook,
  loadChapters,
  loadChapter,
  loadKnowledge,
  loadKnowledgeRecord,
} = contentLoader;

export type { Book, BookPart, Chapter, DivyaDesam, Knowledge } from "../schemas/index.ts";
