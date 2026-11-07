import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BOOKMARKS_STORAGE_KEY, isValidBookmarkList, type BookmarkEntry } from "./content-lib/preferences.ts";
import { BookmarksContext, type BookmarksContextValue } from "./bookmarks-context.ts";
import { readJSON, writeJSON } from "./storage.ts";
import { withCanonicalBookSlugs } from "../content-lib/book-slug-aliases.ts";

/**
 * Same shape as ReadingPositionProvider.tsx: loads the persisted
 * bookmark list once on mount, persists every update. Unlike
 * recordChapterView (automatic, single-slot, last-write-wins),
 * toggleBookmark is only ever called from an explicit tap on the
 * chapter screen's bookmark button -- an intentional list, not a
 * position tracker.
 */
export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    readJSON(BOOKMARKS_STORAGE_KEY, isValidBookmarkList).then((stored) => {
      // Renamed books (content-lib/book-slug-aliases.ts) keep their bookmarks.
      if (!cancelled && stored !== null) setBookmarks(withCanonicalBookSlugs(stored, (entry) => `${entry.bookSlug}/${entry.chapterSlug}`));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<BookmarksContextValue>(
    () => ({
      bookmarks,
      isBookmarked: (bookSlug, chapterSlug) =>
        bookmarks.some((entry) => entry.bookSlug === bookSlug && entry.chapterSlug === chapterSlug),
      toggleBookmark: (bookSlug, chapterSlug) => {
        setBookmarks((prev) => {
          const exists = prev.some((entry) => entry.bookSlug === bookSlug && entry.chapterSlug === chapterSlug);
          const next = exists
            ? prev.filter((entry) => !(entry.bookSlug === bookSlug && entry.chapterSlug === chapterSlug))
            : [...prev, { bookSlug, chapterSlug, savedAt: Date.now() }];
          void writeJSON(BOOKMARKS_STORAGE_KEY, next);
          return next;
        });
      },
    }),
    [bookmarks]
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}
