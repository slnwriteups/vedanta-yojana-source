"use client";

import { useMemo, type ReactNode } from "react";
import type { Chapter } from "@/content-lib/schemas";
import { localizeChapter } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { useReadingPreferences } from "@/lib/reading-preferences-context";
import { useT } from "@/lib/ui-strings";
import { LongFormSection } from "@/components/shared/LongFormSection";

/**
 * The client boundary for a chapter page's localizable content: title +
 * body (content-lib/i18n.ts's localizeChapter), with the reader's
 * font-scale preference applied to the body via a `--reading-font-scale`
 * CSS variable (see app/globals.css's `.prose-body` rule) -- Phase 2's
 * localization and Phase 3's font-scale wrapper share this one client
 * leaf since both only ever render together.
 *
 * `badge`, `bookmarkButton`, and `images` are rendered nodes passed in
 * from the server-rendered page.tsx (DraftBadge/BookmarkButton are
 * their own client components already; RecordImages needs node:fs and
 * must stay server-side) so the visual order matches the English-only
 * page exactly, same pattern as LocalizedDivyaDesamContent.tsx.
 */
export function LocalizedChapterBody({
  chapter,
  badge,
  bookmarkButton,
  images,
}: {
  chapter: Chapter;
  badge: ReactNode;
  bookmarkButton: ReactNode;
  images: ReactNode;
}) {
  const { language } = useLanguage();
  const { preferences } = useReadingPreferences();
  const t = useT();
  const localized = useMemo(() => localizeChapter(chapter, language), [chapter, language]);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          {badge}
          <h1 className="page-title">{localized.title}</h1>
        </div>
        {bookmarkButton}
      </div>

      {images}

      <div style={{ "--reading-font-scale": preferences.fontScale } as React.CSSProperties}>
        {localized.body ? (
          <LongFormSection text={localized.body} />
        ) : (
          <p className="prose-body text-[var(--muted)]">{t("noChapterContentYet")}</p>
        )}
      </div>
    </>
  );
}
