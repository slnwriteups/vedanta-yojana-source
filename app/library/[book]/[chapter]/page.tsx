import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadBook, loadBooks, loadChapter, loadChapters } from "@/content-lib/loader";
import { findAdjacentChapters } from "@/content-lib/chapter-navigation.ts";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { DraftBadge } from "@/components/shared/DraftBadge";
import { resolveImageHref } from "@/lib/image-file";
import { LocalizedChapterBody } from "@/components/library/LocalizedChapterBody";
import { ReadingPositionTracker } from "@/components/library/ReadingPositionTracker";
import { BookmarkButton } from "@/components/library/BookmarkButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata, truncateForDescription } from "@/lib/metadata";
import { siteUrl } from "@/lib/site";
import { toPublicBook, toPublicChapter } from "@/lib/public-content";

/**
 * Phase 5L -- real, loader-driven Chapter detail page.
 *
 * The chapter body is rendered via LongFormSection with NO heading
 * (the page's own <h1> is already the chapter title -- no second,
 * invented heading is added above the body). The stored body text is
 * rendered exactly as migrated: no rewriting, spelling correction,
 * capitalization normalization, summarization, or markdown conversion.
 * Several real chapters' stored body text happens to repeat the title as
 * its own first line (a source/content characteristic, not something
 * this page adds or removes).
 */

/**
 * The full book x chapter cross-product to pre-render. Chapters are
 * enumerated per book rather than globally, because a chapter slug is
 * only unique within its own book.
 */
export function generateStaticParams() {
  return loadBooks().flatMap((book) =>
    loadChapters(book.slug).map((chapter) => ({ book: book.slug, chapter: chapter.slug }))
  );
}

/** Chapter titles used in more than one book, computed once per build. */
let sharedTitlesCache: Set<string> | null = null;
function sharedChapterTitles(): Set<string> {
  if (sharedTitlesCache) return sharedTitlesCache;
  const booksByTitle = new Map<string, Set<string>>();
  for (const book of loadBooks()) {
    for (const chapter of loadChapters(book.slug)) {
      booksByTitle.set(chapter.title, (booksByTitle.get(chapter.title) ?? new Set()).add(book.slug));
    }
  }
  sharedTitlesCache = new Set([...booksByTitle].filter(([, books]) => books.size > 1).map(([title]) => title));
  return sharedTitlesCache;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}): Promise<Metadata> {
  const { book: bookSlug, chapter: chapterSlug } = await params;
  const chapter = loadChapter(bookSlug, chapterSlug);
  if (!chapter) return { title: "Chapter" };

  // A chapter whose name another book also uses ("Invocation",
  // "Gajendra Moksham") gets its book's title added, so search engines
  // don't see two pages with the same title. Unique names stay short.
  const book = loadBook(bookSlug);
  return pageMetadata({
    title: book && sharedChapterTitles().has(chapter.title) ? `${chapter.title} — ${book.title}` : chapter.title,
    description: truncateForDescription(chapter.body),
    path: `/library/${bookSlug}/${chapter.slug}`,
    type: "article",
  });
}

export default async function LibraryChapterPage({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}) {
  const { book: bookSlug, chapter: chapterSlug } = await params;
  const book = loadBook(bookSlug);
  if (!book) notFound();
  const chapter = loadChapter(bookSlug, chapterSlug);
  if (!chapter) notFound();
  const chapters = loadChapters(bookSlug);
  const position = chapters.findIndex((c) => c.slug === chapterSlug);
  const { previous, next } = findAdjacentChapters(chapters, chapterSlug);

  return (
    <div className="space-y-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": book.kind === "blog" ? "BlogPosting" : "Chapter",
          name: chapter.title,
          headline: chapter.title,
          url: siteUrl(`/library/${book.slug}/${chapter.slug}/`),
          description: truncateForDescription(chapter.body),
          isPartOf: {
            "@type": book.kind === "blog" ? "Blog" : "Book",
            name: book.title,
            url: siteUrl(`/library/${book.slug}/`),
          },
        }}
      />
      <Breadcrumbs
        trail={[
          { href: "/library", label: "Library" },
          { href: `/library/${book.slug}`, label: book.title },
        ]}
        current={chapter.title}
      />

      <ReadingPositionTracker bookSlug={book.slug} chapterSlug={chapter.slug} />

      <LocalizedChapterBody
        book={toPublicBook(book)}
        bookSlug={book.slug}
        chapter={toPublicChapter(chapter)}
        position={position}
        total={chapters.length}
        previous={previous ? toPublicChapter(previous) : null}
        next={next ? toPublicChapter(next) : null}
        badge={<DraftBadge status={chapter.status} needsReview={chapter.migration.needsReview} />}
        bookmarkButton={<BookmarkButton bookSlug={book.slug} chapterSlug={chapter.slug} />}
        images={chapter.images.flatMap((image) => {
          // Resolved here, during the static pre-render (node:fs); an image
          // whose file is missing is dropped rather than shown broken.
          const href = resolveImageHref(image.sourceAssetUuid);
          return href
            ? [{ id: image.assetId, href, alt: image.alt ?? "", altStatus: image.altStatus, ...(image.placementAnchor ? { placementAnchor: image.placementAnchor } : {}), ...(image.placementAnchorTranslations ? { placementAnchorTranslations: image.placementAnchorTranslations } : {}) }]
            : [];
        })}
      />
    </div>
  );
}
