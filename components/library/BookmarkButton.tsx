"use client";

import { useBookmarks } from "@/lib/bookmarks-context";
import { useT } from "@/lib/ui-strings";

/**
 * Web port of the chapter screen's header-right bookmark toggle
 * (mobile/app/(tabs)/library/[book]/[chapter].tsx). Mobile renders this
 * through Expo Router's native header-right slot; web has no equivalent,
 * so it's placed inline next to the chapter title instead (see
 * app/library/[book]/[chapter]/page.tsx). Logic is unchanged: explicit
 * save/unsave of the whole chapter, independent of
 * ReadingPositionTracker's automatic last-read tracking.
 */
export function BookmarkButton({ bookSlug, chapterSlug }: { bookSlug: string; chapterSlug: string }) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const t = useT();
  const bookmarked = isBookmarked(bookSlug, chapterSlug);

  return (
    <button
      type="button"
      onClick={() => toggleBookmark(bookSlug, chapterSlug)}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? t("bookmarkRemove") : t("bookmarkAdd")}
      className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-md border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75v17.5a.75.75 0 0 1-1.175.617L12 18.4l-4.825 3.467A.75.75 0 0 1 6 21.25V3.75Z"
          fill={bookmarked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
