/**
 * Grouping a Library entry's chapters under its parts (BookPart), shared
 * by the web book page and the app's book screen. A book with no parts
 * yields a single untitled group, so callers render it exactly as before.
 */

export interface PartsSource {
  parts?: { title: string; order: number; chapters?: string[]; translations?: Record<string, { title: string } | undefined> }[];
}

export interface PartGroup<T> {
  /** The part's title, or null for chapters that belong to no part. */
  title: string | null;
  /** The part itself (for its translations), or null. */
  part: NonNullable<PartsSource["parts"]>[number] | null;
  items: { item: T; index: number }[];
}

/** The title of the part `chapterSlug` belongs to, or null. */
export function partTitleFor(book: PartsSource, chapterSlug: string): string | null {
  return book.parts?.find((part) => part.chapters?.includes(chapterSlug))?.title ?? null;
}

/**
 * The part title to show above a chapter's own title, or null -- also
 * null when the part is named after this very chapter (a split chapter's
 * first sub-chapter keeps the chapter's title), so the reader never sees
 * the same name twice in a row.
 */
export function partLabelFor(book: PartsSource, chapterSlug: string, chapterTitle: string): string | null {
  const title = partTitleFor(book, chapterSlug);
  return title && title.trim() !== chapterTitle.trim() ? title : null;
}

/**
 * Consecutive runs of `items` (in their given order) that share a part.
 * Each item keeps its overall index, so numbering continues across parts
 * ("Post 9" stays post 9 whichever part it is in).
 */
export function groupByPart<T extends { slug: string }>(book: PartsSource, items: T[]): PartGroup<T>[] {
  const groups: PartGroup<T>[] = [];
  items.forEach((item, index) => {
    const part = book.parts?.find((p) => p.chapters?.includes(item.slug)) ?? null;
    const last = groups[groups.length - 1];
    if (last && last.part === part) last.items.push({ item, index });
    else groups.push({ title: part?.title ?? null, part, items: [{ item, index }] });
  });
  return groups;
}
