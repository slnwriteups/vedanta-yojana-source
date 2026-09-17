import type { ZodSafeParseResult, ZodError } from "zod";
import {
  MobileBookSchema,
  MobileChapterSummarySchema,
  MobileDivyaDesamSchema,
  MobileKnowledgeSchema,
  type MobileBook,
  type MobileChapterSummary,
  type MobileDivyaDesam,
  type MobileKnowledge,
} from "../../content-lib/mobile-content.ts";
import { ContentValidationError, DuplicateChapterOrderError, DuplicateSlugError } from "../../content-lib/loader/errors.ts";
import { rawBookGroups, rawDivyaDesams, rawKnowledge } from "./manifest.generated.ts";

/**
 * Phase 6A -- the mobile-compatible content access layer. Same public
 * API shape as the web loader (content-lib/loader/index.ts:
 * loadDivyaDesams/loadDivyaDesam/loadBooks/loadBook/loadChapters/
 * loadChapter/loadKnowledge/loadKnowledgeRecord), same not-found
 * convention (null for a single lookup, [] for an empty collection),
 * same duplicate-slug/duplicate-chapter-order detection (the exact error
 * classes from content-lib/loader/errors.ts, reused directly).
 *
 * Validates against content-lib/mobile-content.ts's Mobile*Schema
 * variants, not the full private schemas the web loader uses: the data
 * in ./manifest.generated.ts has already been projected to the
 * mobile-safe shape at generation time (internal migration/provenance
 * fields dropped, a derived `sourceOrder` added to Divya Desams -- see
 * that module's doc comment for why), so this is what actually describes
 * what ships inside the Hermes bundle.
 *
 * The one deliberate, disclosed behavioral difference: this module
 * CACHES its parsed/validated results after the first call, where the
 * web loader explicitly does not. That is a correct adaptation, not a
 * shortcut -- the web loader re-reads from disk on every call because a
 * dev server's /content can change under it; the mobile manifest is
 * bundled into the app binary at build time and cannot change at
 * runtime, so re-validating the same 160+ records through Zod on every
 * call would only cost battery/CPU for no benefit.
 */

interface ZodLikeSchema<T> {
  safeParse(data: unknown): ZodSafeParseResult<T>;
}

function formatZodError(error: ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.length ? issue.path.join(".") : "(root)"}: ${issue.message}`).join("\n");
}

function parseAll<T>(schema: ZodLikeSchema<T>, raws: unknown[], contentTypeLabel: string, sourceLabel: (index: number) => string): T[] {
  return raws.map((raw, index) => {
    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new ContentValidationError(sourceLabel(index), contentTypeLabel, formatZodError(result.error));
    }
    return result.data;
  });
}

function assertNoDuplicateSlugs<T extends { slug: string }>(records: T[], contentTypeLabel: string, sourceLabel: (index: number) => string): void {
  const bySlug = new Map<string, string[]>();
  records.forEach((record, index) => {
    const list = bySlug.get(record.slug) ?? [];
    list.push(sourceLabel(index));
    bySlug.set(record.slug, list);
  });
  for (const [slug, sources] of bySlug) {
    if (sources.length > 1) throw new DuplicateSlugError(contentTypeLabel, slug, sources);
  }
}

// ---------------------------------------------------------------------------
// Divya Desams
// ---------------------------------------------------------------------------

let divyaDesamsCache: MobileDivyaDesam[] | null = null;

function allDivyaDesams(): MobileDivyaDesam[] {
  if (!divyaDesamsCache) {
    const parsed = parseAll(MobileDivyaDesamSchema, rawDivyaDesams, "Divya Desam", (i) => `manifest:rawDivyaDesams[${i}]`);
    assertNoDuplicateSlugs(parsed, "Divya Desam", (i) => `manifest:rawDivyaDesams[${i}]`);
    divyaDesamsCache = [...parsed].sort((a, b) => a.slug.localeCompare(b.slug));
  }
  return divyaDesamsCache;
}

export function loadDivyaDesams(): MobileDivyaDesam[] {
  return allDivyaDesams();
}

export function loadDivyaDesam(slug: string): MobileDivyaDesam | null {
  return allDivyaDesams().find((d) => d.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

let knowledgeCache: MobileKnowledge[] | null = null;

function allKnowledge(): MobileKnowledge[] {
  if (!knowledgeCache) {
    const parsed = parseAll(MobileKnowledgeSchema, rawKnowledge, "Knowledge", (i) => `manifest:rawKnowledge[${i}]`);
    assertNoDuplicateSlugs(parsed, "Knowledge", (i) => `manifest:rawKnowledge[${i}]`);
    knowledgeCache = [...parsed].sort((a, b) => a.slug.localeCompare(b.slug));
  }
  return knowledgeCache;
}

export function loadKnowledge(): MobileKnowledge[] {
  return allKnowledge();
}

export function loadKnowledgeRecord(slug: string): MobileKnowledge | null {
  return allKnowledge().find((k) => k.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Books + Chapters
//
// Book-bundle-removal update: rawBookGroups now pairs a book with its
// chapters' lightweight SUMMARIES only (title/slug/order/status -- see
// MobileChapterSummarySchema's doc comment in content-lib/mobile-content.ts)
// rather than full chapters with a body. loadChapters() below is exactly
// what it always was -- everything needed to show a book's table of
// contents (LibraryBookScreen) and chapter count (LibraryIndexScreen)
// without a body ever entering the bundle. There is deliberately no
// bundled `loadChapter(bookSlug, chapterSlug)` singular lookup any more:
// a chapter's actual body/images only exist once that book has been
// downloaded, and only mobile/services/bookOfflineService.ts's
// loadOfflineBook() can produce them -- see that module, and
// content-lib/bookmarks.ts/reading-position.ts, which used to call the
// bundled loadChapter() and now go through the offline service instead.
// ---------------------------------------------------------------------------

interface ParsedBookGroup {
  book: MobileBook;
  chapters: MobileChapterSummary[];
}

let bookGroupsCache: ParsedBookGroup[] | null = null;

function allBookGroups(): ParsedBookGroup[] {
  if (!bookGroupsCache) {
    const groups = rawBookGroups.map((group, groupIndex) => {
      const bookResult = MobileBookSchema.safeParse(group.book);
      if (!bookResult.success) {
        throw new ContentValidationError(`manifest:rawBookGroups[${groupIndex}].book`, "Book", formatZodError(bookResult.error));
      }
      const chapters = parseAll(
        MobileChapterSummarySchema,
        group.chapters,
        "Chapter",
        (i) => `manifest:rawBookGroups[${groupIndex}].chapters[${i}]`
      );

      const byOrder = new Map<number, string[]>();
      chapters.forEach((chapter, i) => {
        const list = byOrder.get(chapter.order) ?? [];
        list.push(`manifest:rawBookGroups[${groupIndex}].chapters[${i}]`);
        byOrder.set(chapter.order, list);
      });
      for (const [order, sources] of byOrder) {
        if (sources.length > 1) throw new DuplicateChapterOrderError(bookResult.data.slug, order, sources);
      }

      return {
        book: bookResult.data,
        chapters: [...chapters].sort((a, b) => a.order - b.order),
      };
    });

    assertNoDuplicateSlugs(
      groups.map((g) => g.book),
      "Book",
      (i) => `manifest:rawBookGroups[${i}].book`
    );

    bookGroupsCache = [...groups].sort((a, b) => a.book.slug.localeCompare(b.book.slug));
  }
  return bookGroupsCache;
}

export function loadBooks(): MobileBook[] {
  return allBookGroups().map((g) => g.book);
}

export function loadBook(slug: string): MobileBook | null {
  return allBookGroups().find((g) => g.book.slug === slug)?.book ?? null;
}

export function loadChapters(bookSlug: string): MobileChapterSummary[] {
  return allBookGroups().find((g) => g.book.slug === bookSlug)?.chapters ?? [];
}

export type { BookPart } from "../../content-lib/schemas/index.ts";
export type {
  MobileBook as Book,
  MobileChapterSummary as ChapterSummary,
  MobileDivyaDesam as DivyaDesam,
  MobileKnowledge as Knowledge,
} from "../../content-lib/mobile-content.ts";
