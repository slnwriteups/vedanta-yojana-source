"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { PublicChapter } from "@/lib/public-content";
import { localizeChapter } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme";
import { sectionTint } from "@/lib/section-tints";
import { chapterOrdinalLabel } from "@/lib/ui-strings";
import { DraftBadge } from "@/components/shared/DraftBadge";

/**
 * One row of a Book's chapter list -- a bordered/shadowed card (not a
 * flat hairline-divided strip) with this book's own tint accent stripe,
 * and DraftBadge → title → "Chapter N" ordinal in that order, all
 * mirroring mobile's shared ContentCard exactly
 * (mobile/app/(tabs)/library/[book].tsx).
 *
 * Client component so the title follows the reader's language
 * preference (content-lib/i18n.ts's localizeChapter).
 */
export function ChapterListItem({
  bookSlug,
  chapter,
  position,
}: {
  bookSlug: string;
  chapter: PublicChapter;
  /** This chapter's 1-indexed position in the book's own chapter order -- mobile's `index + 1`. */
  position: number;
}) {
  const { language } = useLanguage();
  const theme = useTheme();
  const localized = useMemo(() => localizeChapter(chapter, language), [chapter, language]);
  const tint = sectionTint(bookSlug, theme);

  return (
    <li>
      <Link
        href={`/library/${bookSlug}/${chapter.slug}`}
        className="relative block overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: tint }} />
        <DraftBadge status={chapter.status} needsReview={chapter.migration.needsReview} />
        <span className="font-medium">{localized.title}</span>
        <p className="mt-1 text-sm text-[var(--muted)]">{chapterOrdinalLabel(language, position)}</p>
      </Link>
    </li>
  );
}
