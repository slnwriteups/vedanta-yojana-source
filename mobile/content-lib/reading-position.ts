import { loadBook } from "./loader.ts";
import { localizeBook, localizeChapter } from "../../content-lib/i18n.ts";
import { estimateReadingMinutes } from "../../content-lib/text-format.ts";
import type { LanguageCode } from "../../content-lib/schemas/index.ts";
import type { BookPayload } from "../../content-lib/mobile-content.ts";
import type { LastReadPosition } from "./preferences.ts";

/**
 * Resolves a persisted LastReadPosition (just two slugs -- see
 * preferences.ts) into the real, current, localized titles Home's
 * "Continue Reading" card shows -- looked up fresh, never cached
 * alongside the position itself, so a later content edit or removed
 * chapter is always reflected correctly. Returns null (not a stale/
 * fabricated title) if either slug no longer resolves to a real record
 * -- Home then falls back to its no-history state, exactly as if
 * nothing had ever been saved.
 *
 * Book-bundle-removal update: a reading position can only ever have
 * been recorded by actually opening a chapter (see [chapter].tsx's
 * recordChapterView), which requires that chapter's book to have been
 * downloaded -- so both the chapter's title and its body (for
 * minutesLeft) come from a downloaded book's local storage, never the
 * bundled catalog. `loadOfflineBook` is therefore a REQUIRED parameter
 * here rather than this file importing bookOfflineService.ts directly:
 * that real adapter has a top-level `import ... from "expo-file-system"`,
 * which crashes under plain `node --test` on load alone (see that
 * service's own doc comment) -- and unlike a .tsx screen, this file is a
 * plain content-lib module mobile/tests/screens.test.ts imports
 * directly. The one real caller (Home's app/(tabs)/index.tsx) passes the
 * real bookOfflineService.loadOfflineBook; tests pass a fake. If the
 * reader deletes the book, the saved position correctly stops resolving,
 * matching this function's own documented "returns null" contract.
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

export function resolveLastRead(
  position: LastReadPosition | null,
  language: LanguageCode | null,
  loadOfflineBook: (bookSlug: string) => BookPayload | null
): ResolvedLastRead | null {
  if (!position) return null;
  const book = loadBook(position.bookSlug);
  const offlineBook = loadOfflineBook(position.bookSlug);
  const chapter = offlineBook?.chapters.find((c) => c.slug === position.chapterSlug) ?? null;
  if (!book || !offlineBook || !chapter) return null;
  const chapters = offlineBook.chapters;
  const chapterPosition = chapters.findIndex((c) => c.slug === chapter.slug) + 1;
  const localizedChapter = localizeChapter(chapter, language);
  return {
    bookSlug: position.bookSlug,
    chapterSlug: position.chapterSlug,
    bookTitle: localizeBook(book, language).title,
    chapterTitle: localizedChapter.title,
    chapterPosition,
    totalChapters: chapters.length,
    minutesLeft: estimateReadingMinutes(localizedChapter.body),
  };
}

/**
 * Resolves an entire lastReadByBook list (one entry per book with a
 * saved position -- see ReadingPositionProvider.tsx) into real, current,
 * localized cards -- one per book that still resolves, most-recently-
 * read first. Reuses resolveLastRead() per entry rather than
 * duplicating its resolution/null-handling logic; a book whose saved
 * chapter no longer resolves is silently dropped, exactly like the
 * single-position case.
 */
export function resolveAllLastRead(
  positions: LastReadPosition[],
  language: LanguageCode | null,
  loadOfflineBook: (bookSlug: string) => BookPayload | null
): ResolvedLastRead[] {
  return positions
    .map((position) => ({ savedAt: position.savedAt, resolved: resolveLastRead(position, language, loadOfflineBook) }))
    .filter((entry): entry is { savedAt: number; resolved: ResolvedLastRead } => entry.resolved !== null)
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((entry) => entry.resolved);
}
