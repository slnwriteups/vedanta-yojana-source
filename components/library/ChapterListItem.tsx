"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Chapter } from "@/content-lib/schemas";
import { localizeChapter } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";

/**
 * One row of a Book's chapter list. Title and link only -- no
 * description/summary field exists on Chapter to safely show without
 * fabrication, and no icon/decoration is added per the restrained visual
 * language established in Phase 5J/5K.
 *
 * Client component so the title follows the reader's language
 * preference (content-lib/i18n.ts's localizeChapter).
 */
export function ChapterListItem({
  bookSlug,
  chapter,
}: {
  bookSlug: string;
  chapter: Chapter;
}) {
  const { language } = useLanguage();
  const localized = useMemo(() => localizeChapter(chapter, language), [chapter, language]);

  return (
    <li className="py-3">
      <Link href={`/library/${bookSlug}/${chapter.slug}`} className="hover:underline">
        {localized.title}
      </Link>
    </li>
  );
}
