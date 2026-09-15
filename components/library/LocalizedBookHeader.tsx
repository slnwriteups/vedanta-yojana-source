"use client";

import { useMemo } from "react";
import type { PublicBook } from "@/lib/public-content";
import { localizeBook } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme";
import { sectionTint } from "@/lib/section-tints";

/**
 * Localizes a Book detail page's own title/description (content-lib/
 * i18n.ts's localizeBook). The title is tinted with this book's own
 * section-identity color, matching mobile's book screen
 * (mobile/app/(tabs)/library/[book].tsx) -- previously plain foreground
 * text on web, the one place mobile's per-book color coding didn't
 * reach at all.
 */
export function LocalizedBookHeader({ book }: { book: PublicBook }) {
  const { language } = useLanguage();
  const theme = useTheme();
  const localized = useMemo(() => localizeBook(book, language), [book, language]);

  return (
    <>
      <h1 className="page-title" style={{ color: sectionTint(book.slug, theme) }}>
        {localized.title}
      </h1>
      {localized.description ? (
        <p className="prose-body max-w-2xl text-[var(--muted)]">{localized.description}</p>
      ) : null}
    </>
  );
}
