import type { MobileBook, MobileChapterSummary } from "../../content-lib/mobile-content.ts";
import type { ContentManifest, ContentManifestBookEntry } from "../../content-lib/content-manifest.ts";

/**
 * Pure merge/decision logic for the Library's content-update
 * architecture -- deliberately zero expo-file-system/fetch imports, so
 * this stays unit-testable under plain `node --test`
 * (tests/library-catalog-core.test.ts), matching bookOfflineCore.ts's
 * own split between orchestration logic and its real adapter
 * (libraryCatalogService.ts).
 *
 * Two delivery models meet here, deliberately NOT merged (see
 * pasuramArchive.ts's own doc comment for the Pasuram side of that
 * distinction):
 *
 * - The BUNDLED catalog (mobile/content-lib/loader.ts's loadBooks()/
 *   loadChapters(), baked into the APK at build time) is what a device
 *   shows on its very first, ever-offline launch -- it can never go
 *   stale in a way that breaks anything, but it also can never reflect
 *   a content change made after this APK was built.
 * - The REMOTE catalog (content-manifest.json, fetched by
 *   libraryCatalogService.ts and cached locally once reached) is the
 *   source of truth once reachable: a book's title changing, a new
 *   book appearing, or an existing book's content changing all show up
 *   here without any app update.
 *
 * mergeCatalog() combines the two into one list the Library screens
 * render, preferring the remote entry for any slug both sides know
 * about. booksNeedingResync() is the other half: given that merged
 * view, which ALREADY-DOWNLOADED books have changed upstream and
 * should be quietly refreshed. Deliberately does NOT decide anything
 * about books the person has never downloaded -- see
 * BookDownloadControl.tsx's own doc comment for why a first download
 * only ever happens from an explicit tap; refreshing a book already
 * opted into is a different, much narrower action than that, not an
 * exception to it.
 */

export interface BundledBookGroup {
  book: MobileBook;
  chapters: MobileChapterSummary[];
}

export interface CatalogEntry {
  book: MobileBook;
  chapters: MobileChapterSummary[];
  /** The matching content-manifest.json entry for this slug, or null if only the bundled catalog knows about it (expected only when the remote catalog has never been reached). Carries the url/contentHash/byteSize a download or staleness check needs. */
  remote: ContentManifestBookEntry | null;
}

export function mergeCatalog(bundled: readonly BundledBookGroup[], remote: ContentManifest | null): CatalogEntry[] {
  const remoteBySlug = new Map((remote?.books ?? []).map((entry) => [entry.book.slug, entry] as const));
  const seenSlugs = new Set<string>();
  const merged: CatalogEntry[] = [];

  for (const group of bundled) {
    const remoteEntry = remoteBySlug.get(group.book.slug) ?? null;
    merged.push({
      book: remoteEntry ? remoteEntry.book : group.book,
      chapters: remoteEntry ? remoteEntry.chapters : group.chapters,
      remote: remoteEntry,
    });
    seenSlugs.add(group.book.slug);
  }

  for (const entry of remoteBySlug.values()) {
    if (seenSlugs.has(entry.book.slug)) continue;
    merged.push({ book: entry.book, chapters: entry.chapters, remote: entry });
  }

  return merged.sort((a, b) => a.book.slug.localeCompare(b.book.slug));
}

/**
 * Every remote entry whose content has changed since an already-
 * downloaded local copy was obtained -- libraryCatalogService.ts
 * re-downloads exactly these, silently, on the theory that refreshing a
 * book the person already has locally is a bounded, targeted action
 * (not the "uncontrolled background download of a large payload" the
 * architecture spec explicitly warns against), unlike fetching a book
 * body the person has never asked for, which never happens
 * automatically. A local copy with NO recorded hash (getLocalContentHash
 * returns null; only possible for a copy downloaded before this field
 * existed) is treated as stale rather than skipped, since "unknown" must
 * never be silently trusted as "current".
 */
export function booksNeedingResync(
  catalog: readonly CatalogEntry[],
  isBookAvailable: (slug: string) => boolean,
  getLocalContentHash: (slug: string) => string | null
): ContentManifestBookEntry[] {
  const stale: ContentManifestBookEntry[] = [];
  for (const entry of catalog) {
    if (!entry.remote) continue;
    if (!isBookAvailable(entry.book.slug)) continue;
    if (getLocalContentHash(entry.book.slug) !== entry.remote.contentHash) {
      stale.push(entry.remote);
    }
  }
  return stale;
}
