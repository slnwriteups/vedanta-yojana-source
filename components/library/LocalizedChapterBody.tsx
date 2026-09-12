"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import type { Book, Chapter } from "@/content-lib/schemas";
import { localizeBook, localizeChapter } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { useReadingPreferences } from "@/lib/reading-preferences-context";
import { chapterPositionLabel, minReadLabel, useT } from "@/lib/ui-strings";
import { estimateReadingMinutes, getTableOfContents, stripLeadingDuplicateTitle } from "@/content-lib/text-format.ts";
import { LongFormSection } from "@/components/shared/LongFormSection";

const TOC_ID_PREFIX = "chapter-para";

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
 *
 * Parity pass with mobile's [chapter].tsx: the "CHAPTER X OF Y · N MIN
 * READ" label, the book title line above the chapter title, the
 * in-chapter table of contents (getTableOfContents, content-lib/
 * text-format.ts), and the Previous/Next pager (findAdjacentChapters,
 * content-lib/chapter-navigation.ts) -- all previously entirely absent
 * on web. `book`/`previous`/`next` arrive unlocalized (loader output)
 * from the server page, since which language to render in is only known
 * client-side; they're localized here alongside `chapter` itself.
 * Mobile-only conveniences (swipe-to-page gesture, scroll-position
 * progress bar, haptics, VoiceOver announcement on page-turn) have no
 * meaningful web equivalent and are intentionally not ported -- a normal
 * link click and the browser's own back/forward/scroll behavior already
 * cover the same ground on web.
 */
export function LocalizedChapterBody({
  book,
  bookSlug,
  chapter,
  position,
  total,
  previous,
  next,
  badge,
  bookmarkButton,
  images,
}: {
  book: Book;
  bookSlug: string;
  chapter: Chapter;
  /** This chapter's 0-indexed position among its book's chapters, or -1 if not found. */
  position: number;
  total: number;
  previous: Chapter | null;
  next: Chapter | null;
  badge: ReactNode;
  bookmarkButton: ReactNode;
  images: ReactNode;
}) {
  const { language } = useLanguage();
  const { preferences } = useReadingPreferences();
  const t = useT();
  const localized = useMemo(() => localizeChapter(chapter, language), [chapter, language]);
  const localizedBook = useMemo(() => localizeBook(book, language), [book, language]);
  const localizedPrevious = useMemo(() => (previous ? localizeChapter(previous, language) : null), [previous, language]);
  const localizedNext = useMemo(() => (next ? localizeChapter(next, language) : null), [next, language]);
  // Mirrors mobile's chapter screen: some chapter bodies repeat their own
  // title as a leading line (a leftover of the source material's own
  // formatting) -- redundant under a screen that already shows the same
  // title in its own <h1> above, so it's stripped for display only, the
  // stored body itself untouched. Exact-match only, never fuzzy.
  const displayBody = localized.body ? stripLeadingDuplicateTitle(localized.body, localized.title) : localized.body;
  const readingMinutes = displayBody ? estimateReadingMinutes(displayBody) : 0;
  const toc = displayBody ? getTableOfContents(displayBody, localized.title) : [];

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {badge}
            {position !== -1 ? (
              <p className="eyebrow text-[var(--muted)]">
                {chapterPositionLabel(language, position + 1, total)}
                {readingMinutes > 0 ? ` · ${minReadLabel(language, readingMinutes)}` : ""}
              </p>
            ) : null}
          </div>
          <p className="truncate text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {localizedBook.title}
          </p>
          <h1 className="page-title">{localized.title}</h1>
        </div>
        {bookmarkButton}
      </div>

      {toc.length > 0 ? (
        <nav aria-label={t("tableOfContentsLabel")} className="max-w-2xl space-y-2 rounded-md border border-[var(--border)] p-4">
          <p className="eyebrow text-[var(--muted)]">{t("tableOfContentsLabel")}</p>
          <ul role="list" className="space-y-2">
            {toc.map((entry) => (
              <li key={entry.paragraphIndex}>
                <a href={`#${TOC_ID_PREFIX}-${entry.paragraphIndex}`} className="font-semibold text-[var(--accent)] hover:underline">
                  {entry.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {images}

      <div style={{ "--reading-font-scale": preferences.fontScale } as React.CSSProperties}>
        {displayBody ? (
          <LongFormSection text={displayBody} paragraphIdPrefix={TOC_ID_PREFIX} />
        ) : (
          <p className="prose-body text-[var(--muted)]">{t("noChapterContentYet")}</p>
        )}
      </div>

      {localizedPrevious || localizedNext ? (
        <div className="grid max-w-2xl grid-cols-2 gap-3 pt-2">
          {localizedPrevious ? (
            <Link
              href={`/library/${bookSlug}/${localizedPrevious.slug}`}
              aria-label={`Previous chapter: ${localizedPrevious.title}`}
              className="min-h-[44px] rounded-md border border-[var(--border)] p-3 hover:border-[var(--accent)]"
            >
              <p className="eyebrow text-[var(--muted)]">{t("pagerPrevious")}</p>
              <p className="text-sm font-semibold text-[var(--accent)]">{localizedPrevious.title}</p>
            </Link>
          ) : (
            <div />
          )}
          {localizedNext ? (
            <Link
              href={`/library/${bookSlug}/${localizedNext.slug}`}
              aria-label={`Next chapter: ${localizedNext.title}`}
              className="min-h-[44px] rounded-md border border-[var(--border)] p-3 text-right hover:border-[var(--accent)]"
            >
              <p className="eyebrow text-[var(--muted)]">{t("pagerNext")}</p>
              <p className="text-sm font-semibold text-[var(--accent)]">{localizedNext.title}</p>
            </Link>
          ) : (
            <div />
          )}
        </div>
      ) : null}
    </>
  );
}
