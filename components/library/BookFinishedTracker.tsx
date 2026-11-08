"use client";

import { useEffect, useRef } from "react";
import { useReadingPosition } from "@/lib/reading-position-context";

/**
 * Rendered after the body of a book's LAST chapter only. When the reader
 * scrolls far enough to see it -- the end of the book -- the book is
 * marked finished and leaves Home's "Continue Reading" (see
 * content-lib/reading-progress.ts). Mirrors the app's chapter screen
 * (mobile/app/(tabs)/library/[book]/[chapter].tsx), which marks the same
 * thing when the reader scrolls to the end of the last chapter. Renders
 * an invisible marker.
 *
 * The saved position loads asynchronously, so a short last chapter can
 * be fully on screen before there is a position to mark. The marker's
 * visibility is therefore remembered, and marking is retried whenever the
 * provider updates while it is visible (markBookFinished itself is a
 * no-op once marked).
 */
export function BookFinishedTracker({ bookSlug, chapterSlug }: { bookSlug: string; chapterSlug: string }) {
  const { markBookFinished } = useReadingPosition();
  const marker = useRef<HTMLDivElement>(null);
  const visible = useRef(false);
  // Latest function without re-observing on every provider update.
  const markRef = useRef(markBookFinished);
  markRef.current = markBookFinished;

  useEffect(() => {
    const element = marker.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      visible.current = entries.some((entry) => entry.isIntersecting);
      if (visible.current) markRef.current(bookSlug, chapterSlug);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [bookSlug, chapterSlug]);

  useEffect(() => {
    if (visible.current) markBookFinished(bookSlug, chapterSlug);
  }, [markBookFinished, bookSlug, chapterSlug]);

  return <div ref={marker} aria-hidden="true" className="h-px w-full" />;
}
