"use client";

import { useLanguage } from "@/lib/language-context";
import type { BookGroup } from "@/content-lib/schemas/book-parts.ts";

/** A place's heading on a Library entry's page (above its parts), in the reader's language when it has a translation. */
export function LocalizedPlaceHeading({ group }: { group: Pick<BookGroup, "title" | "translations"> }) {
  const { language } = useLanguage();
  return <h2 className="section-heading pt-3">{(language && group.translations?.[language]?.title) || group.title}</h2>;
}
