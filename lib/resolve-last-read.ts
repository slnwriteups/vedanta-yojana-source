import type { Book, Chapter, LanguageCode } from "@/content-lib/schemas";
import { localizeBook, localizeChapter } from "@/content-lib/i18n.ts";
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
  chapterTitle: string;
  /** This chapter's 1-indexed position in the book's own chapterOrder. */
  chapterPosition: number;
  /** Total chapters in the book -- together with chapterPosition, Home's "Chapter N of Total". */
  totalChapters: number;
  /** estimateReadingMinutes() of this chapter's own (localized) body -- "time left" in the current chapter, not the whole book. */
  minutesLeft: number;
}

export interface HomeCatalogEntry {
  book: Book;
  chapters: Chapter[];
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
  const localizedChapter = localizeChapter(chapter, language);
  return {
    bookSlug: position.bookSlug,
    chapterSlug: position.chapterSlug,
    bookTitle: localizeBook(entry.book, language).title,
    chapterTitle: localizedChapter.title,
    chapterPosition,
    totalChapters: entry.chapters.length,
    minutesLeft: estimateReadingMinutes(localizedChapter.body),
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
