import type { Metadata } from "next";
import { loadBooks, loadChapters } from "@/content-lib/loader";
import { BookCard } from "@/components/library/BookCard";
import { LocalizedPageHeading } from "@/components/shared/LocalizedPageHeading";
import { LocalizedText } from "@/components/shared/LocalizedText";
import { siteUrl } from "@/lib/site";
import { toPublicBook } from "@/lib/public-content";

export const metadata: Metadata = {
  title: "Library",
  description: "Sacred texts and teachings, presented chapter by chapter.",
  alternates: { canonical: siteUrl("/library") },
};

/**
 * Library index -- matches mobile's Library tab exactly: a localized
 * title (mobile's Stack.Screen title) and the book list, with no
 * separate description paragraph (mobile's index screen has none; the
 * "Sacred texts..." line only ever appears as the Home dashboard's
 * "Get Started" card subtitle, both here via the shared
 * libraryCardSubtitle ui-string, in metadata.description above).
 *
 * chapterCount is computed the same way mobile's Library index does
 * (loadChapters(slug).length -- chapters that actually load/validate)
 * rather than book.chapterOrder.length (the book's declared order,
 * which could in principle diverge from what actually resolves) and
 * passed down, since BookCard is a Client Component and the loader is
 * server-only.
 */
export default function LibraryIndexPage() {
  const books = loadBooks();

  return (
    <div className="space-y-6">
      <LocalizedPageHeading stringKey="tabLibrary" />

      {books.length > 0 ? (
        <ul role="list" className="space-y-3">
          {books.map((book) => (
            <BookCard key={book.slug} book={toPublicBook(book)} chapterCount={loadChapters(book.slug).length} />
          ))}
        </ul>
      ) : (
        <LocalizedText stringKey="noBooksYet" className="prose-body text-[var(--muted)]" />
      )}
    </div>
  );
}
