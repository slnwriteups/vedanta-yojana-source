import { loadBook } from "./loader.ts";
import { localizeBook, localizeChapter } from "../../content-lib/i18n.ts";
import type { LanguageCode } from "../../content-lib/schemas/index.ts";
import type { BookPayload } from "../../content-lib/mobile-content.ts";
import type { BookmarkEntry } from "./preferences.ts";

/**
 * Resolves persisted BookmarkEntry records into the real, current,
 * localized titles Home's "Bookmarks" section shows -- same reasoning
 * as reading-position.ts's resolveLastRead: looked up fresh, never
 * cached alongside the bookmark itself, so a later content edit is
 * always reflected. A bookmark whose chapter/book no longer resolves is
 * silently dropped (not shown as a broken row) rather than surfaced
 * as an error -- content can be renamed/removed independently of a
 * reader's saved list.
 *
 * Book-bundle-removal update: a bookmark can only ever have been created
 * by actually opening a chapter (see [chapter].tsx's toggleBookmark),
 * which requires that chapter's book to have been downloaded -- so the
 * chapter title is resolved via a downloaded book's local storage, not
 * the bundled loader. `loadOfflineBook` is a required parameter for the
 * exact same reason as reading-position.ts's resolveLastRead -- see that
 * function's doc comment for the full "why" (this file must stay
 * importable under plain `node --test`, which a top-level import of the
 * real bookOfflineService.ts adapter would break). If the reader later
 * deletes that book, its bookmarks correctly stop resolving too,
 * matching this function's own "silently dropped" contract above.
 */
export interface ResolvedBookmark {
  bookSlug: string;
  chapterSlug: string;
  bookTitle: string;
  chapterTitle: string;
  savedAt: number;
}

export function resolveBookmarks(
  entries: BookmarkEntry[],
  language: LanguageCode | null,
  loadOfflineBook: (bookSlug: string) => BookPayload | null
): ResolvedBookmark[] {
  const resolved: ResolvedBookmark[] = [];
  for (const entry of entries) {
    const book = loadBook(entry.bookSlug);
    const chapter = loadOfflineBook(entry.bookSlug)?.chapters.find((c) => c.slug === entry.chapterSlug) ?? null;
    if (!book || !chapter) continue;
    resolved.push({
      bookSlug: entry.bookSlug,
      chapterSlug: entry.chapterSlug,
      bookTitle: localizeBook(book, language).title,
      chapterTitle: localizeChapter(chapter, language).title,
      savedAt: entry.savedAt,
    });
  }
  return resolved.sort((a, b) => b.savedAt - a.savedAt);
}
