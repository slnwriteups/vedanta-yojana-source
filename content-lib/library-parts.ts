/**
 * Grouping a Library entry's chapters under its parts (BookPart), shared
 * by the web book page and the app's book screen. A book with no parts
 * yields a single untitled group, so callers render it exactly as before.
 */

export interface PartsSource {
  parts?: { title: string; order: number; chapters?: string[] }[];
}

export interface PartGroup<T> {
  /** The part's title, or null for chapters that belong to no part. */
  title: string | null;
  items: { item: T; index: number }[];
}

/** The title of the part `chapterSlug` belongs to, or null. */
export function partTitleFor(book: PartsSource, chapterSlug: string): string | null {
  return book.parts?.find((part) => part.chapters?.includes(chapterSlug))?.title ?? null;
}

/**
 * Consecutive runs of `items` (in their given order) that share a part.
 * Each item keeps its overall index, so numbering continues across parts
 * ("Post 9" stays post 9 whichever part it is in).
 */
export function groupByPart<T extends { slug: string }>(book: PartsSource, items: T[]): PartGroup<T>[] {
  const groups: PartGroup<T>[] = [];
  items.forEach((item, index) => {
    const title = partTitleFor(book, item.slug);
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.items.push({ item, index });
    else groups.push({ title, items: [{ item, index }] });
  });
  return groups;
}
