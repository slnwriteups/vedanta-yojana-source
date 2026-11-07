/**
 * Books whose slug has changed, old slug -> current slug.
 *
 * Old slugs still reach us after a rename: reading positions, bookmarks and
 * downloaded books saved on readers' devices, and links to the old website
 * URLs. The website redirects the old URLs (app/library/...) and both the
 * website and the app rewrite saved data on load, all from this one map.
 * Never remove an entry: a device can come back after months.
 */
export const RENAMED_BOOK_SLUGS: Readonly<Record<string, string>> = {
  // Renamed 2026-11-07 from the placeholder name to match the book's title.
  "untitled-recovered-book-pending-editorial-title": "a-brief-insight-to-visishtadvaita-philosophy",
};

/** The current slug for a book, following a rename if there was one. */
export function canonicalBookSlug(slug: string): string {
  return RENAMED_BOOK_SLUGS[slug] ?? slug;
}

/**
 * Rewrites renamed book slugs in a saved list. Entries that now share a key
 * (for example an old and a new reading position for the same book) are
 * merged, keeping the newest by savedAt. Returns the input array unchanged
 * when nothing needed rewriting.
 */
export function withCanonicalBookSlugs<T extends { bookSlug: string; savedAt: number }>(
  entries: T[],
  key: (entry: T) => string
): T[] {
  if (!entries.some((entry) => entry.bookSlug in RENAMED_BOOK_SLUGS)) return entries;
  const rewritten = entries.map((entry) => ({ ...entry, bookSlug: canonicalBookSlug(entry.bookSlug) }));
  const newest = new Map<string, T>();
  for (const entry of rewritten) {
    const current = newest.get(key(entry));
    if (!current || entry.savedAt >= current.savedAt) newest.set(key(entry), entry);
  }
  return rewritten.filter((entry) => newest.get(key(entry)) === entry);
}
