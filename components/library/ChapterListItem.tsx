"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Chapter } from "@/content-lib/schemas";
import { localizeChapter } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { chapterOrdinalLabel } from "@/lib/ui-strings";
import { DraftBadge } from "@/components/shared/DraftBadge";

/**
 * One row of a Book's chapter list. Below the title: a "Chapter N"
 * ordinal (chapterOrdinalLabel, localized) and this chapter's own
 * DraftBadge -- both previously absent here, matching mobile's
 * [book].tsx screen (mobile/app/(tabs)/library/[book].tsx), which shows
 * both per row via its shared ContentCard.
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
  chapter: Chapter;
  /** This chapter's 1-indexed position in the book's own chapter order -- mobile's `index + 1`. */
  position: number;
}) {
  const { language } = useLanguage();
  const localized = useMemo(() => localizeChapter(chapter, language), [chapter, language]);

  return (
    <li className="space-y-1 py-3">
      <Link href={`/library/${bookSlug}/${chapter.slug}`} className="block hover:underline">
        <span className="font-medium">{localized.title}</span>
      </Link>
      <p className="text-sm text-[var(--muted)]">{chapterOrdinalLabel(language, position)}</p>
      <DraftBadge status={chapter.status} needsReview={chapter.migration.needsReview} />
    </li>
  );
}
