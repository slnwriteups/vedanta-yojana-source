"use client";

import { useEffect } from "react";
import { useReadingPosition } from "@/lib/reading-position-context";

/**
 * Ported effect from mobile's chapter screen
 * (mobile/app/(tabs)/library/[book]/[chapter].tsx), which calls
 * recordChapterView() in a useEffect keyed on [bookSlug, chapterSlug,
 * loadedChapter] -- the UNlocalized/stable chapter reference,
 * specifically to avoid an infinite loop that localizeChapter's
 * always-new-object-reference would cause if a localized chapter were
 * in the deps array instead.
 *
 * This component takes only primitive bookSlug/chapterSlug props --
 * never a chapter record -- so there is no way for that gotcha to leak
 * in even by a future refactor, stricter than mobile's own
 * lint-disable-comment safeguard. Renders nothing.
 */
export function ReadingPositionTracker({ bookSlug, chapterSlug }: { bookSlug: string; chapterSlug: string }) {
  const { recordChapterView } = useReadingPosition();

  useEffect(() => {
    recordChapterView(bookSlug, chapterSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookSlug, chapterSlug]);

  return null;
}
