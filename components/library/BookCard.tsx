"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { PublicBook } from "@/lib/public-content";
import { localizeBook } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme";
import { sectionTint } from "@/lib/section-tints";
import { libraryEntryCountLabel } from "@/lib/ui-strings";
import { DraftBadge } from "@/components/shared/DraftBadge";
import { bookCoverAsset } from "@/lib/book-covers";

/**
 * One book on the Library shelf -- the cover large, uncropped ("contain",
 * not "cover": "a cropped book cover loses its title/author lettering",
 * per mobile's ContentCard), with the title and chapter count beneath
 * it. A book with no cover art gets a tinted 2:3 panel with its initial
 * in the same place, so the shelf keeps one rhythm. `chapterCount` is
 * passed down from the server page (loadChapters(book.slug).length --
 * chapters that actually load/validate, the same source mobile's Library
 * index uses) rather than derived here, since the loader is server-only.
 *
 * No description line here -- a book's description only appears on its
 * own detail page (LocalizedBookHeader.tsx), never repeated on the shelf.
 *
 * Client component so title follows the reader's language preference
 * (content-lib/i18n.ts's localizeBook), same as every other content
 * list on the site.
 */
export function BookCard({ book, chapterCount }: { book: PublicBook; chapterCount: number }) {
  const { language } = useLanguage();
  const theme = useTheme();
  const localized = useMemo(() => localizeBook(book, language), [book, language]);
  const cover = bookCoverAsset(book.slug);
  const tint = sectionTint(book.slug, theme);
  const monogram = localized.title.trim().charAt(0).toUpperCase();

  return (
    <li>
      <Link href={`/library/${book.slug}`} className="group block">
        <div className="aspect-[2/3] overflow-hidden rounded-md bg-[var(--surface-alt)]">
          {cover ? (
            <img
              src={cover}
              alt=""
              width={400}
              height={600}
              loading="lazy"
              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-full w-full items-center justify-center text-5xl font-semibold"
              style={{ backgroundColor: tint, color: "#fffaf5" }}
            >
              {monogram}
            </span>
          )}
        </div>
        <div className="mt-3 min-w-0">
          <DraftBadge status={book.status} needsReview={book.migration.needsReview} />
          <span className="block font-semibold text-balance group-hover:underline">{localized.title}</span>
          <span className="mt-1 block text-[var(--muted)]">{libraryEntryCountLabel(language, book.kind, chapterCount)}</span>
        </div>
      </Link>
    </li>
  );
}
