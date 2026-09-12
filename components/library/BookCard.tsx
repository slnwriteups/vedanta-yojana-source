"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Book } from "@/content-lib/schemas";
import { localizeBook } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme";
import { sectionTint } from "@/lib/section-tints";
import { chapterCountLabel } from "@/lib/ui-strings";
import { DraftBadge } from "@/components/shared/DraftBadge";
import { bookCoverAsset } from "@/lib/book-covers";

/**
 * One row of the Library index -- a bordered/shadowed card (not a flat
 * divide-y row), a per-book tint accent stripe + monogram fallback for a
 * book with no cover art, and an uncropped ("contain", not "cover") book
 * cover -- all mirroring mobile's shared ContentCard
 * (mobile/components/ContentCard.tsx, `variant="cover"`) exactly, whose
 * own comment explains why cover art is never cropped: "a cropped book
 * cover loses its title/author lettering." `chapterCount` is passed down
 * from the server page (loadChapters(book.slug).length -- chapters that
 * actually load/validate, the same source mobile's Library index uses)
 * rather than derived here, since the loader is server-only.
 *
 * No description line here -- mobile's Library index screen
 * (mobile/app/(tabs)/library/index.tsx) only ever passes `title`/
 * `subtitle` (the chapter count) to ContentCard; a book's description
 * only appears on its own detail page (LocalizedBookHeader.tsx), never
 * repeated on this index row.
 *
 * Client component so title follows the reader's language preference
 * (content-lib/i18n.ts's localizeBook), same as every other content
 * list on the site.
 */
export function BookCard({ book, chapterCount }: { book: Book; chapterCount: number }) {
  const { language } = useLanguage();
  const theme = useTheme();
  const localized = useMemo(() => localizeBook(book, language), [book, language]);
  const cover = bookCoverAsset(book.slug);
  const tint = sectionTint(book.slug, theme);
  const monogram = localized.title.trim().charAt(0).toUpperCase();

  return (
    <li>
      <Link
        href={`/library/${book.slug}`}
        className="relative flex items-center gap-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: tint }} />
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-24 w-16 flex-none rounded-sm border border-[var(--border)] bg-[var(--border)] object-contain"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-16 w-16 flex-none items-center justify-center rounded-md text-lg font-bold"
            style={{ backgroundColor: tint, color: "#fffaf5" }}
          >
            {monogram}
          </span>
        )}
        <div className="min-w-0">
          <DraftBadge status={book.status} needsReview={book.migration.needsReview} />
          <span className="font-medium">{localized.title}</span>
          <p className="mt-1 text-sm text-[var(--muted)]">{chapterCountLabel(language, chapterCount)}</p>
        </div>
      </Link>
    </li>
  );
}
