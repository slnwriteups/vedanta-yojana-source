"use client";

import { useLanguage } from "@/lib/language-context";
import type { BookPart } from "@/content-lib/schemas/book-parts.ts";

/** A part's heading on a Library entry's page, in the reader's language when the part has a translation. */
export function LocalizedPartHeading({ part }: { part: Pick<BookPart, "title" | "translations"> }) {
  const { language } = useLanguage();
  return <h2 className="section-heading pt-3">{(language && part.translations?.[language]?.title) || part.title}</h2>;
}
