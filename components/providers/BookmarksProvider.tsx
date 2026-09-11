"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BOOKMARKS_STORAGE_KEY, isValidBookmarkList, type BookmarkEntry } from "@/lib/preferences";
import { BookmarksContext, type BookmarksContextValue } from "@/lib/bookmarks-context";
import { readJSON, writeJSON } from "@/lib/storage";

/**
 * Web port of mobile/BookmarksProvider.tsx. Loads the persisted
 * bookmark list once on mount, persists every update. Unlike
 * recordChapterView (automatic, single-slot, last-write-wins),
 * toggleBookmark is only ever called from an explicit tap on
 * BookmarkButton.tsx -- an intentional list, not a position tracker.
 */
export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    readJSON(BOOKMARKS_STORAGE_KEY, isValidBookmarkList).then((stored) => {
      if (!cancelled && stored !== null) setBookmarks(stored);
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
