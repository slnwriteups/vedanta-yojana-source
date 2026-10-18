import type { Metadata } from "next";
import { loadBooks, loadChapters } from "@/content-lib/loader";
import { BookCard } from "@/components/library/BookCard";
import { LocalizedPageHeading } from "@/components/shared/LocalizedPageHeading";
import { LocalizedText } from "@/components/shared/LocalizedText";
import { siteUrl } from "@/lib/site";
import { toPublicBook } from "@/lib/public-content";

export const metadata: Metadata = {
  title: "Library",
  description: "Sacred texts and teachings, presented chapter by chapter, and the author's blogs.",
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
  const entries = loadBooks();
  const books = entries.filter((entry) => entry.kind !== "blog");
  const blogs = entries.filter((entry) => entry.kind === "blog");

  return (
    <div className="space-y-6">
      <LocalizedPageHeading stringKey="tabLibrary" />

      {entries.length === 0 ? (
        <LocalizedText stringKey="noBooksYet" className="prose-body text-[var(--muted)]" />
      ) : (
        <>
          <LibraryShelf headingKey="libraryBooksHeading" entries={books} showHeading={blogs.length > 0} />
          <LibraryShelf headingKey="libraryBlogsHeading" entries={blogs} showHeading />
        </>
      )}
    </div>
  );
}

/**
 * One shelf of the Library: the published books, or the author's blog
 * series (Book.kind === "blog"). The Books heading is only shown once
 * there is a Blogs shelf to tell it apart from; an empty shelf renders
 * nothing.
 */
function LibraryShelf({
  headingKey,
  entries,
  showHeading,
}: {
  headingKey: "libraryBooksHeading" | "libraryBlogsHeading";
  entries: ReturnType<typeof loadBooks>;
  showHeading: boolean;
}) {
  if (entries.length === 0) return null;
  return (
    <section className="space-y-3">
      {showHeading ? <LocalizedText as="h2" stringKey={headingKey} className="section-heading" /> : null}
      <ul role="list" className="space-y-3">
        {entries.map((entry) => (
          <BookCard key={entry.slug} book={toPublicBook(entry)} chapterCount={loadChapters(entry.slug).length} />
        ))}
      </ul>
    </section>
  );
}
