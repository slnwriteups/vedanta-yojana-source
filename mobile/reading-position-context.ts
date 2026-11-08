import { createContext, useContext } from "react";
import type { LastReadPosition } from "./content-lib/preferences.ts";

/**
 * Split from its Provider (ReadingPositionProvider.tsx) the same way
 * LanguageContext/language-context.ts is -- plain function calls with
 * no JSX, so this stays importable under `node --test`.
 */
export interface ReadingPositionContextValue {
  /** At most one entry per bookSlug -- a reader partway through several books at once gets one entry each. Empty until the persisted list resolves, or if the reader has never opened a chapter. */
  lastReadByBook: LastReadPosition[];
  recordChapterView: (bookSlug: string, chapterSlug: string) => void;
  /** Called when the reader reaches the end of a book's last chapter: the book leaves "Continue Reading". A no-op unless that chapter is the book's saved position, and once already marked. */
  markBookFinished: (bookSlug: string, chapterSlug: string) => void;
}

export const ReadingPositionContext = createContext<ReadingPositionContextValue>({
  lastReadByBook: [],
  recordChapterView: () => {},
  markBookFinished: () => {},
});

export function useReadingPosition(): ReadingPositionContextValue {
  return useContext(ReadingPositionContext);
}
