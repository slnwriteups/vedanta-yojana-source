/**
 * Scheduled chapters. A chapter with a `releaseDate` (YYYY-MM-DD) does not
 * exist for readers before that date: the loader and the build scripts that
 * read content files directly leave it out of every page, the search index,
 * the sitemap and the app's content. The site is rebuilt daily at 02:47 IST
 * (deploy-pages.yml), so a chapter appears with the first build on its day.
 *
 * Dates are India calendar dates: that daily build runs at 21:17 UTC on the
 * previous UTC day, so "today" must never be read in UTC.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** The calendar date in India (Asia/Kolkata) at `now`, as YYYY-MM-DD. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "Today" for releases: RELEASE_TODAY=YYYY-MM-DD when set (previews, tests), else the date in India. */
export function releaseToday(): string {
  const override = typeof process !== "undefined" ? process.env.RELEASE_TODAY : undefined;
  if (override) {
    if (!isIsoDate(override)) throw new Error(`RELEASE_TODAY must be a date written YYYY-MM-DD, not "${override}"`);
    return override;
  }
  return todayInIndia();
}

export function isReleased(record: { releaseDate?: string }, today: string): boolean {
  return !record.releaseDate || record.releaseDate <= today;
}

type Grouping = { chapters: string[] };

/** The book with chapterOrder, parts and groups cut down to `released`; parts and groups left empty are dropped. */
export function pruneBookToChapters<B extends { chapterOrder: string[]; parts: Grouping[]; groups?: Grouping[] }>(book: B, released: Set<string>): B {
  const keep = <G extends Grouping>(list: G[]) =>
    list.map((g) => ({ ...g, chapters: g.chapters.filter((slug) => released.has(slug)) })).filter((g) => g.chapters.length > 0);
  return {
    ...book,
    chapterOrder: book.chapterOrder.filter((slug) => released.has(slug)),
    parts: keep(book.parts),
    ...(book.groups ? { groups: keep(book.groups) } : {}),
  };
}

/**
 * A book and its chapters as published on `today`: unreleased chapters
 * removed and the book pruned to match, or null when the book has chapters
 * but none is released yet. For the build scripts that read content files
 * directly instead of through the loader.
 */
export function releasedBookAndChapters<B extends { chapterOrder: string[]; parts: Grouping[]; groups?: Grouping[] }, C extends { slug: string; releaseDate?: string }>(
  book: B,
  chapters: C[],
  today: string
): { book: B; chapters: C[] } | null {
  const released = chapters.filter((c) => isReleased(c, today));
  if (released.length === chapters.length) return { book, chapters };
  if (released.length === 0) return null;
  return { book: pruneBookToChapters(book, new Set(released.map((c) => c.slug))), chapters: released };
}
