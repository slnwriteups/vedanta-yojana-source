"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LAST_READ_STORAGE_KEY, isValidLastReadPositionList, type LastReadPosition } from "@/lib/preferences";
import { ReadingPositionContext, type ReadingPositionContextValue } from "@/lib/reading-position-context";
import { readJSON, writeJSON } from "@/lib/storage";

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
      if (!cancelled && stored !== null) setLastReadByBook(stored);
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
    }),
    [lastReadByBook]
  );

  return <ReadingPositionContext.Provider value={value}>{children}</ReadingPositionContext.Provider>;
}
