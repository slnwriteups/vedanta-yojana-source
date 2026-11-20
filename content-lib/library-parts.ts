/**
 * Grouping a Library entry's chapters under its parts (BookPart), shared
 * by the web book page and the app's book screen. A book with no parts
 * yields a single untitled group, so callers render it exactly as before.
 */

type Grouping = { title: string; order: number; chapters?: string[]; translations?: Record<string, { title: string } | undefined> };

export interface PartsSource {
  parts?: Grouping[];
  /** Places above parts (BookGroup); most books have none. */
  groups?: Grouping[];
}

export interface PartGroup<T> {
  /** The part's title, or null for chapters that belong to no part. */
  title: string | null;
  /** The part itself (for its translations), or null. */
  part: NonNullable<PartsSource["parts"]>[number] | null;
  items: { item: T; index: number }[];
}

export interface PlaceGroup<T> {
  /** The place's title, or null for chapters in no place. */
  title: string | null;
  /** The place itself (for its translations), or null. */
  group: Grouping | null;
  /** The place's chapters as part runs; a part titled like its place has title null (heading hidden). */
  parts: PartGroup<T>[];
}

/** The title of the part `chapterSlug` belongs to, or null. */
export function partTitleFor(book: PartsSource, chapterSlug: string): string | null {
  return book.parts?.find((part) => part.chapters?.includes(chapterSlug))?.title ?? null;
}

/** The title of the place `chapterSlug` belongs to, or null. */
export function placeTitleFor(book: PartsSource, chapterSlug: string): string | null {
  return book.groups?.find((group) => group.chapters?.includes(chapterSlug))?.title ?? null;
}

/**
 * The place and part to show above a chapter's own title ("Tirumala ·
 * Navarātri Brahmotsavam"), or null. A segment is dropped when it repeats
 * the name shown after it -- a part named after its place, or named after
 * this very chapter (a split chapter's first sub-chapter keeps the
 * chapter's title) -- so the reader never sees the same name twice in a row.
 */
export function partLabelFor(book: PartsSource, chapterSlug: string, chapterTitle: string): string | null {
  const place = placeTitleFor(book, chapterSlug)?.trim() || null;
  const part = partTitleFor(book, chapterSlug)?.trim() || null;
  const shownPart = part && part !== chapterTitle.trim() && part !== place ? part : null;
  const shownPlace = place && place !== chapterTitle.trim() ? place : null;
  const label = [shownPlace, shownPart].filter(Boolean).join(" · ");
  return label || null;
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

/**
 * Consecutive runs of `items` that share a place, each split into its part
 * runs (as groupByPart). Numbering stays overall. A book without places
 * yields one untitled place holding groupByPart's result.
 */
export function groupByPlace<T extends { slug: string }>(book: PartsSource, items: T[]): PlaceGroup<T>[] {
  const places: PlaceGroup<T>[] = [];
  for (const run of groupByPart(book, items)) {
    for (const entry of run.items) {
      const group = book.groups?.find((g) => g.chapters?.includes(entry.item.slug)) ?? null;
      let place = places[places.length - 1];
      if (!place || place.group !== group) {
        place = { title: group?.title ?? null, group, parts: [] };
        places.push(place);
      }
      const last = place.parts[place.parts.length - 1];
      if (last && last.part === run.part) last.items.push(entry);
      else {
        const hidden = run.title !== null && group !== null && run.title.trim() === group.title.trim();
        place.parts.push({ title: hidden ? null : run.title, part: run.part, items: [entry] });
      }
    }
  }
  return places;
}
