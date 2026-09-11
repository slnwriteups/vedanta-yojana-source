import { createContext, useContext } from "react";
import type { BookmarkEntry } from "./preferences";

/**
 * Web port of mobile/bookmarks-context.ts, verbatim. Split from its
 * Provider (components/providers/BookmarksProvider.tsx) the same way
 * every other preference context already is.
 */
export interface BookmarksContextValue {
  bookmarks: BookmarkEntry[];
  isBookmarked: (bookSlug: string, chapterSlug: string) => boolean;
  toggleBookmark: (bookSlug: string, chapterSlug: string) => void;
}

export const BookmarksContext = createContext<BookmarksContextValue>({
  bookmarks: [],
  isBookmarked: () => false,
  toggleBookmark: () => {},
});

export function useBookmarks(): BookmarksContextValue {
  return useContext(BookmarksContext);
}
