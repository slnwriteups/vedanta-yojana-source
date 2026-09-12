import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadBook, loadBooks, loadChapters } from "@/content-lib/loader";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { DraftBadge } from "@/components/shared/DraftBadge";
import { ChapterListItem } from "@/components/library/ChapterListItem";
import { LocalizedBookHeader } from "@/components/library/LocalizedBookHeader";
import { LocalizedText } from "@/components/shared/LocalizedText";
import { JsonLd } from "@/components/seo/JsonLd";
import { truncateForDescription } from "@/lib/metadata";
import { siteUrl } from "@/lib/site";

/**
 * Phase 5L -- real, loader-driven Book detail page.
 *
 * Chapter ordering: loadChapters() already returns chapters sorted
 * ascending by their own `order` field (content-lib/loader/index.ts),
 * which is the exact same sequence as the book's own `chapterOrder`
 * array (established and verified during the full-content migration/
 * validation phases) -- so no separate re-sort or renumbering happens
 * here. Chapter titles are rendered exactly as stored.
 */

/** Every Book URL to pre-render -- see the Divya Desam page for why. */
export function generateStaticParams() {
  return loadBooks().map((book) => ({ book: book.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ book: string }>;
}): Promise<Metadata> {
  const { book: bookSlug } = await params;
  const book = loadBook(bookSlug);
  if (!book) return { title: "Library" };

  return {
    title: book.title,
    description: book.description ? truncateForDescription(book.description) : undefined,
    alternates: { canonical: siteUrl(`/library/${book.slug}`) },
  };
}

export default async function LibraryBookPage({
  params,
}: {
  params: Promise<{ book: string }>;
}) {
  const { book: bookSlug } = await params;
  const book = loadBook(bookSlug);
  if (!book) notFound();
  const chapters = loadChapters(bookSlug);

  return (
    <div className="space-y-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: book.title,
          ...(book.description ? { description: book.description } : {}),
        }}
      />
      <Breadcrumbs trail={[{ href: "/library", label: "Library" }]} current={book.title} />

      <div className="space-y-2">
        <DraftBadge status={book.status} needsReview={book.migration.needsReview} />
        <LocalizedBookHeader book={book} />
      </div>

      <div className="space-y-3">
        {chapters.length > 0 ? (
          <ol role="list" className="divide-y divide-[var(--border)]">
            {chapters.map((chapter, index) => (
              <ChapterListItem key={chapter.slug} bookSlug={book.slug} chapter={chapter} position={index + 1} />
            ))}
          </ol>
        ) : (
          <LocalizedText stringKey="noChaptersYet" className="prose-body text-[var(--muted)]" />
        )}
      </div>
    </div>
  );
}
