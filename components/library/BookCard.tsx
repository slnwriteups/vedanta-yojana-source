"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Book } from "@/content-lib/schemas";
import { localizeBook } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { chapterCountLabel } from "@/lib/ui-strings";
import { DraftBadge } from "@/components/shared/DraftBadge";
import { bookCoverAsset } from "@/lib/book-covers";

/**
 * One row of the Library index. `chapterCount` is passed down from the
 * server page (loadChapters(book.slug).length -- chapters that actually
 * load/validate, the same source mobile's Library index uses) rather
 * than derived here from `book.chapterOrder.length` (the book's merely
 * declared order), since the loader is server-only. Author/description
 * are rendered only when actually present; today's real books have
 * neither, so this section correctly renders nothing extra rather than
 * inventing them.
 *
 * Client component so title/description follow the reader's language
 * preference (content-lib/i18n.ts's localizeBook), same as every other
 * content list on the site.
 */
export function BookCard({ book, chapterCount }: { book: Book; chapterCount: number }) {
  const { language } = useLanguage();
  const localized = useMemo(() => localizeBook(book, language), [book, language]);
  const cover = bookCoverAsset(book.slug);

  return (
    <li className="flex gap-4 py-4">
      {cover ? (
        <img
          src={cover}
          alt=""
          loading="lazy"
          className="h-20 w-14 flex-none rounded-sm border border-[var(--border)] object-cover"
        />
      ) : null}
      <div className="min-w-0">
        <Link href={`/library/${book.slug}`} className="block hover:underline">
          <span className="font-medium">{localized.title}</span>
        </Link>
        <p className="mt-1 text-sm text-[var(--muted)]">{chapterCountLabel(language, chapterCount)}</p>
        {localized.description ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{localized.description}</p>
        ) : null}
        <div className="mt-1">
          <DraftBadge status={book.status} needsReview={book.migration.needsReview} />
        </div>
      </div>
    </li>
  );
}
