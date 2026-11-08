"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LAST_READ_STORAGE_KEY, isValidLastReadPositionList, type LastReadPosition } from "@/lib/preferences";
import { ReadingPositionContext, type ReadingPositionContextValue } from "@/lib/reading-position-context";
import { readJSON, writeJSON } from "@/lib/storage";
import { withCanonicalBookSlugs } from "@/content-lib/book-slug-aliases";

/**
 * Web port of mobile/ReadingPositionProvider.tsx. Loads the persisted
 * last-read list once on mount, persists every update.
 * recordChapterView is called from ReadingPositionTracker.tsx on every
 * chapter view -- it replaces ONLY that book's own entry (last write
 * wins per book, so re-opening an earlier chapter of the SAME book
 * after a later one correctly moves that book's position back to it),
 * leaving every other book's own saved position untouched.
 */
export function ReadingPositionProvider({ children }: { children: ReactNode }) {
  const [lastReadByBook, setLastReadByBook] = useState<LastReadPosition[]>([]);

  useEffect(() => {
    let cancelled = false;
    readJSON(LAST_READ_STORAGE_KEY, isValidLastReadPositionList).then((stored) => {
      // Renamed books (content-lib/book-slug-aliases.ts) keep their saved place.
      if (!cancelled && stored !== null) setLastReadByBook(withCanonicalBookSlugs(stored, (entry) => entry.bookSlug));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ReadingPositionContextValue>(
    () => ({
      lastReadByBook,
      recordChapterView: (bookSlug: string, chapterSlug: string) => {
        const next: LastReadPosition[] = [
          ...lastReadByBook.filter((entry) => entry.bookSlug !== bookSlug),
          { bookSlug, chapterSlug, savedAt: Date.now() },
        ];
        setLastReadByBook(next);
        void writeJSON(LAST_READ_STORAGE_KEY, next);
      },
      markBookFinished: (bookSlug: string, chapterSlug: string) => {
        const current = lastReadByBook.find((entry) => entry.bookSlug === bookSlug);
        // Only the chapter being read, and only once (this is called from scroll handlers).
        if (!current || current.chapterSlug !== chapterSlug || current.finished) return;
        const next = lastReadByBook.map((entry) => (entry === current ? { ...entry, finished: true } : entry));
        setLastReadByBook(next);
        void writeJSON(LAST_READ_STORAGE_KEY, next);
      },
    }),
    [lastReadByBook]
  );

  return <ReadingPositionContext.Provider value={value}>{children}</ReadingPositionContext.Provider>;
}
