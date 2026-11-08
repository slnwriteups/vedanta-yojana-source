/**
 * How far through a book a "Continue Reading" card says the reader is,
 * and when a book counts as finished. Shared by the website and the app
 * (lib/resolve-last-read.ts, mobile/content-lib/reading-position.ts and
 * both ContinueReadingCard components) so they always agree.
 *
 * A book reaches 100% only when the reader reaches the end of its last
 * chapter, and at that point it leaves "Continue Reading". While a
 * chapter is open, the chapters before it count as done, so opening the
 * last chapter no longer shows "100% completed" with minutes still left.
 */

/** Whole-number percent of the book completed, counting the chapters before the one in progress. Never 100 while a chapter is in progress. */
export function continueReadingPercent(chapterPosition: number, totalChapters: number): number {
  if (totalChapters <= 0 || chapterPosition <= 0) return 0;
  return Math.min(99, Math.floor(((chapterPosition - 1) / totalChapters) * 100));
}

/**
 * Whether a saved position means the book is finished: the reader
 * reached the end of the chapter that is still the book's last. If
 * chapters are added after it later (a growing book or blog), the book
 * comes back to "Continue Reading" so the new chapters aren't missed.
 */
export function isFinishedPosition(position: { finished?: boolean }, chapterPosition: number, totalChapters: number): boolean {
  return position.finished === true && chapterPosition === totalChapters;
}

/** How close to the end of a chapter counts as having finished it (fraction of the scrollable height). */
export const CHAPTER_END_THRESHOLD = 0.98;
