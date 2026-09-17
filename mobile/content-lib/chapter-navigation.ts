/**
 * Phase 6D -- pure previous/next lookup over an already-loaded,
 * already-ordered chapter list (loadChapters() already returns chapters
 * ascending by their own `order` field -- this never re-sorts). Kept
 * separate from the screen so it's testable under `node --test` without
 * a react-native renderer.
 *
 * Generic over any `{ slug: string }` shape (not tied to loader.ts's
 * bundled ChapterSummary) since the book-bundle-removal work introduced
 * a second, full-content chapter shape (bookOfflineService.ts's
 * downloaded MobileChapter, with body/images) that also needs
 * previous/next navigation once a book's chapter screen has it loaded.
 */
export interface AdjacentChapters<T extends { slug: string }> {
  previous: T | null;
  next: T | null;
}

export function findAdjacentChapters<T extends { slug: string }>(chapters: T[], currentSlug: string): AdjacentChapters<T> {
  const index = chapters.findIndex((chapter) => chapter.slug === currentSlug);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: index > 0 ? chapters[index - 1] : null,
    next: index < chapters.length - 1 ? chapters[index + 1] : null,
  };
}
