import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadBook, loadBooks, loadChapter, loadChapters } from "@/content-lib/loader";
import { findAdjacentChapters } from "@/content-lib/chapter-navigation.ts";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { DraftBadge } from "@/components/shared/DraftBadge";
import { RecordImages } from "@/components/shared/RecordImages";
import { LocalizedChapterBody } from "@/components/library/LocalizedChapterBody";
import { ReadingPositionTracker } from "@/components/library/ReadingPositionTracker";
import { BookmarkButton } from "@/components/library/BookmarkButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { truncateForDescription } from "@/lib/metadata";
import { siteUrl } from "@/lib/site";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}): Promise<Metadata> {
  const { book: bookSlug, chapter: chapterSlug } = await params;
  const chapter = loadChapter(bookSlug, chapterSlug);
  if (!chapter) return { title: "Chapter" };

  return {
    title: chapter.title,
    description: truncateForDescription(chapter.body),
    alternates: { canonical: siteUrl(`/library/${bookSlug}/${chapter.slug}`) },
  };
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
          "@type": "WebPage",
          name: chapter.title,
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
        book={book}
        bookSlug={book.slug}
        chapter={chapter}
        position={position}
        total={chapters.length}
        previous={previous}
        next={next}
        badge={<DraftBadge status={chapter.status} needsReview={chapter.migration.needsReview} />}
        bookmarkButton={<BookmarkButton bookSlug={book.slug} chapterSlug={chapter.slug} />}
        images={<RecordImages images={chapter.images} />}
      />
    </div>
  );
}
