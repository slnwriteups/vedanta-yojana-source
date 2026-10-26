import type { Chapter, LanguageCode } from "@/content-lib/schemas";
import type { PublicBook } from "./public-content";
import { localizeBook, localizeChapterSummary } from "@/content-lib/i18n.ts";
import { estimateReadingMinutes } from "@/content-lib/text-format.ts";
import type { LastReadPosition } from "./preferences";

/**
 * Web port of mobile/content-lib/reading-position.ts's resolveLastRead/
 * resolveAllLastRead. Behavior is identical; the one structural
 * difference is the data source: mobile calls loadBook/loadChapter/
 * loadChapters (its own bundled, always-in-memory corpus) fresh on every
 * resolution, while this reads from a `catalog` the Home page passes in
 * -- a plain `{ book, chapters }[]` array the server component builds
 * once via the SAME loader (content-lib/loader, server-only) and hands
 * to the client as props, since the loader itself cannot run in a
 * Client Component. Because this is a static export (content never
 * changes at runtime without a rebuild), "resolved fresh from the
 * loader" and "resolved from a build-time catalog" are equivalent here.
 */
export interface ResolvedLastRead {
  bookSlug: string;
  chapterSlug: string;
  bookTitle: string;
  /** "book" or "blog" -- Home's progress line counts chapters for a book, posts for a blog. */
  kind: "book" | "blog";
  chapterTitle: string;
  /** This chapter's 1-indexed position in the book's own chapterOrder. */
  chapterPosition: number;
  /** Total chapters in the book -- together with chapterPosition, Home's "Chapter N of Total". */
  totalChapters: number;
  /** estimateReadingMinutes() of this chapter's own (localized) body -- "time left" in the current chapter, not the whole book. */
  minutesLeft: number;
}

/**
 * Just what a Continue Reading card needs from a chapter: its title and
 * its reading time, each per language. Deliberately NOT the whole
 * chapter -- the catalog is a Client Component prop, so everything in it
 * is serialized into the Home page's HTML, and full bodies in every
 * language made that page a 16 MB download (slow first paint, and a
 * Core Web Vitals problem for search ranking) to compute a title and a
 * minute count.
 */
export interface HomeChapterSummary {
  slug: string;
  title: string;
  readingMinutes: number;
  translations?: Partial<Record<LanguageCode, { title?: string; readingMinutes?: number }>>;
}

/**
 * Projects a loaded chapter to its HomeChapterSummary, resolving each
 * translation exactly as localizeChapter would -- a translation without
 * its own body falls back to the original body, so its reading time is
 * the original's too.
 */
export function toHomeChapterSummary(chapter: Pick<Chapter, "slug" | "title" | "body" | "translations">): HomeChapterSummary {
  const translations: NonNullable<HomeChapterSummary["translations"]> = {};
  for (const [language, t] of Object.entries(chapter.translations ?? {}) as [LanguageCode, { title?: string; body?: string } | undefined][]) {
    if (!t) continue;
    translations[language] = {
      ...(t.title ? { title: t.title } : {}),
      readingMinutes: estimateReadingMinutes(t.body ?? chapter.body),
    };
  }
  return {
    slug: chapter.slug,
    title: chapter.title,
    readingMinutes: estimateReadingMinutes(chapter.body),
    ...(Object.keys(translations).length > 0 ? { translations } : {}),
  };
}

export interface HomeCatalogEntry {
  book: PublicBook;
  chapters: HomeChapterSummary[];
}

function resolveLastRead(
  position: LastReadPosition | null,
  catalog: HomeCatalogEntry[],
  language: LanguageCode | null
): ResolvedLastRead | null {
  if (!position) return null;
  const entry = catalog.find((c) => c.book.slug === position.bookSlug);
  const chapter = entry?.chapters.find((c) => c.slug === position.chapterSlug);
  if (!entry || !chapter) return null;

  const chapterPosition = entry.chapters.findIndex((c) => c.slug === chapter.slug) + 1;
  const localizedChapter = localizeChapterSummary(chapter, language);
  const minutesLeft = (language ? chapter.translations?.[language]?.readingMinutes : undefined) ?? chapter.readingMinutes;
  return {
    bookSlug: position.bookSlug,
    chapterSlug: position.chapterSlug,
    kind: entry.book.kind,
    bookTitle: localizeBook(entry.book, language).title,
    chapterTitle: localizedChapter.title,
    chapterPosition,
    totalChapters: entry.chapters.length,
    minutesLeft,
  };
}

/**
 * Resolves an entire lastReadByBook list (one entry per book with a
 * saved position -- see ReadingPositionProvider.tsx) into real, current,
 * localized cards -- one per book that still resolves, most-recently-
 * read first. A book whose saved chapter no longer resolves (or isn't
 * in `catalog`) is silently dropped, exactly like the single-position
 * case.
 */
export function resolveAllLastRead(
  positions: LastReadPosition[],
  catalog: HomeCatalogEntry[],
  language: LanguageCode | null
): ResolvedLastRead[] {
  return positions
    .map((position) => ({ savedAt: position.savedAt, resolved: resolveLastRead(position, catalog, language) }))
    .filter((entry): entry is { savedAt: number; resolved: ResolvedLastRead } => entry.resolved !== null)
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((entry) => entry.resolved);
}
