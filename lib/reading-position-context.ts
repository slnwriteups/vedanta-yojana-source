import { createContext, useContext } from "react";
import type { LastReadPosition } from "./preferences";

/**
 * Web port of mobile/reading-position-context.ts, verbatim. Split from
 * its Provider (components/providers/ReadingPositionProvider.tsx) the
 * same way every other preference context already is.
 */
export interface ReadingPositionContextValue {
  /** At most one entry per bookSlug -- a reader partway through several books at once gets one entry each. Empty until the persisted list resolves, or if the reader has never opened a chapter. */
  lastReadByBook: LastReadPosition[];
  recordChapterView: (bookSlug: string, chapterSlug: string) => void;
}

export const ReadingPositionContext = createContext<ReadingPositionContextValue>({
  lastReadByBook: [],
  recordChapterView: () => {},
});

export function useReadingPosition(): ReadingPositionContextValue {
  return useContext(ReadingPositionContext);
}
