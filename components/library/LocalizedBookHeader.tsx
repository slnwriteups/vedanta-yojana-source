"use client";

import { useMemo } from "react";
import type { Book } from "@/content-lib/schemas";
import { localizeBook } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";

/** Localizes a Book detail page's own title/description (content-lib/i18n.ts's localizeBook). */
export function LocalizedBookHeader({ book }: { book: Book }) {
  const { language } = useLanguage();
  const localized = useMemo(() => localizeBook(book, language), [book, language]);

  return (
    <>
      <h1 className="page-title">{localized.title}</h1>
      {localized.description ? (
        <p className="prose-body max-w-2xl text-[var(--muted)]">{localized.description}</p>
      ) : null}
    </>
  );
}
