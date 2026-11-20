"use client";

import { useLanguage } from "@/lib/language-context";
import type { BookPart } from "@/content-lib/schemas/book-parts.ts";

/**
 * A part's heading on a Library entry's page, in the reader's language when
 * the part has a translation. Level 3 when the part sits inside a place.
 */
export function LocalizedPartHeading({ part, level = 2 }: { part: Pick<BookPart, "title" | "translations">; level?: 2 | 3 }) {
  const { language } = useLanguage();
  const title = (language && part.translations?.[language]?.title) || part.title;
  return level === 3
    ? <h3 className="text-xl font-semibold tracking-tight text-balance pt-1">{title}</h3>
    : <h2 className="section-heading pt-3">{title}</h2>;
}
