import test from "node:test";
import assert from "node:assert/strict";
import { booksNeedingResync, mergeCatalog, type BundledBookGroup } from "../services/libraryCatalogCore.ts";
import type { ContentManifest, ContentManifestBookEntry } from "../../content-lib/content-manifest.ts";
import type { MobileBook, MobileChapterSummary } from "../../content-lib/mobile-content.ts";

function book(slug: string, title: string): MobileBook {
  return { slug, title, status: "published", migration: { needsReview: false }, parts: [], chapterOrder: [] };
}

function chapter(slug: string, title: string, order = 1): MobileChapterSummary {
  return { title, slug, order, status: "published", migration: { needsReview: false } };
}

function remoteEntry(slug: string, title: string, contentHash: string): ContentManifestBookEntry {
  return {
    book: book(slug, title),
    chapters: [chapter(`${slug}-ch1`, "Chapter One")],
    payloadSchemaVersion: 1,
    contentHash,
    byteSize: 1000,
    url: `https://example.com/books/${slug}.json`,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function manifest(entries: ContentManifestBookEntry[]): ContentManifest {
  return { contentManifestVersion: 1, generatedAt: "2026-01-01T00:00:00.000Z", books: entries };
}

test("mergeCatalog: with no remote manifest, returns the bundled catalog unchanged (aside from slug sort)", () => {
  const bundled: BundledBookGroup[] = [
    { book: book("zeta", "Zeta"), chapters: [chapter("z1", "One")] },
    { book: book("alpha", "Alpha"), chapters: [chapter("a1", "One")] },
  ];
  const merged = mergeCatalog(bundled, null);
  assert.deepEqual(
    merged.map((e) => e.book.slug),
    ["alpha", "zeta"]
  );
  assert.equal(merged[0].remote, null);
});

test("mergeCatalog: a slug present in both prefers the remote entry's book/chapters", () => {
  const bundled: BundledBookGroup[] = [{ book: book("jaya", "Jaya (old title)"), chapters: [chapter("old-ch", "Old Chapter")] }];
  const remote = manifest([remoteEntry("jaya", "Jaya: A Journey (updated title)", "hash-new")]);

  const merged = mergeCatalog(bundled, remote);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].book.title, "Jaya: A Journey (updated title)");
  assert.equal(merged[0].chapters[0].slug, "jaya-ch1");
  assert.equal(merged[0].remote?.contentHash, "hash-new");
});

test("mergeCatalog: a remote-only slug (a brand new book) appears in the merged catalog", () => {
  const bundled: BundledBookGroup[] = [{ book: book("jaya", "Jaya"), chapters: [] }];
  const remote = manifest([remoteEntry("jaya", "Jaya", "h1"), remoteEntry("bhagavad-gita", "Bhagavad Gita", "h2")]);

  const merged = mergeCatalog(bundled, remote);
  assert.deepEqual(
    merged.map((e) => e.book.slug),
    ["bhagavad-gita", "jaya"]
  );
  const newBook = merged.find((e) => e.book.slug === "bhagavad-gita");
  assert.equal(newBook?.remote?.url, "https://example.com/books/bhagavad-gita.json");
});

test("mergeCatalog: a bundled-only slug (remote catalog never reached, or doesn't mention it) still appears", () => {
  const bundled: BundledBookGroup[] = [{ book: book("jaya", "Jaya"), chapters: [chapter("c1", "One")] }];
  const remote = manifest([remoteEntry("sri-rama-charithram", "Sri Rama Charithram", "h1")]);

  const merged = mergeCatalog(bundled, remote);
  assert.deepEqual(
    merged.map((e) => e.book.slug),
    ["jaya", "sri-rama-charithram"]
  );
  const jaya = merged.find((e) => e.book.slug === "jaya");
  assert.equal(jaya?.remote, null);
  assert.equal(jaya?.chapters[0].slug, "c1", "falls back to the bundled chapters, not an empty list");
});

test("booksNeedingResync: a downloaded book whose local hash differs from the remote's is flagged", () => {
  const catalog = mergeCatalog([{ book: book("jaya", "Jaya"), chapters: [] }], manifest([remoteEntry("jaya", "Jaya", "hash-v2")]));

  const stale = booksNeedingResync(
    catalog,
    (slug) => slug === "jaya",
    (slug) => (slug === "jaya" ? "hash-v1" : null)
  );
  assert.equal(stale.length, 1);
  assert.equal(stale[0].contentHash, "hash-v2");
});

test("booksNeedingResync: a downloaded book whose local hash already matches the remote's is NOT flagged", () => {
  const catalog = mergeCatalog([{ book: book("jaya", "Jaya"), chapters: [] }], manifest([remoteEntry("jaya", "Jaya", "hash-v2")]));

  const stale = booksNeedingResync(
    catalog,
    (slug) => slug === "jaya",
    (slug) => (slug === "jaya" ? "hash-v2" : null)
  );
  assert.deepEqual(stale, []);
});

test("booksNeedingResync: a book the person has NOT downloaded is never flagged, however different its hash", () => {
  const catalog = mergeCatalog([], manifest([remoteEntry("bhagavad-gita", "Bhagavad Gita", "hash-v1")]));

  const stale = booksNeedingResync(
    catalog,
    () => false,
    () => null
  );
  assert.deepEqual(stale, [], "must never auto-download a book the person never opted into");
});

test("booksNeedingResync: a downloaded book with no recorded local hash (pre-dates this field) is treated as stale, not skipped", () => {
  const catalog = mergeCatalog([{ book: book("jaya", "Jaya"), chapters: [] }], manifest([remoteEntry("jaya", "Jaya", "hash-v1")]));

  const stale = booksNeedingResync(
    catalog,
    () => true,
    () => null
  );
  assert.equal(stale.length, 1, '"unknown" must never be silently trusted as "current"');
});

test("booksNeedingResync: a bundled-only book (no remote entry at all) is never flagged", () => {
  const catalog = mergeCatalog([{ book: book("jaya", "Jaya"), chapters: [] }], null);

  const stale = booksNeedingResync(
    catalog,
    () => true,
    () => null
  );
  assert.deepEqual(stale, []);
});
