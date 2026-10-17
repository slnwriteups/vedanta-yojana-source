"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import type { PublicBook, PublicChapter } from "@/lib/public-content";
import { localizeBook, localizeChapter } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { useReadingPreferences } from "@/lib/reading-preferences-context";
import { chapterPositionLabel, minReadLabel, useT } from "@/lib/ui-strings";
import { estimateReadingMinutes, paragraphsForReading, stripLeadingDuplicateTitle } from "@/content-lib/text-format.ts";
import { LongFormSection } from "@/components/shared/LongFormSection";
import { ImageLightboxGrid, type LightboxImage } from "@/components/shared/ImageLightboxGrid";
import { partLabelFor } from "@/content-lib/library-parts.ts";
import { placeInlineImages } from "@/content-lib/inline-images.ts";

/** A chapter image with its public URL already resolved by the server page, and where in the text it goes. */
export interface ChapterImageItem extends LightboxImage {
  placementAnchor?: string;
  placementAnchorTranslations?: Partial<Record<string, string>>;
}

/**
 * The client boundary for a chapter page's localizable content: title +
 * body (content-lib/i18n.ts's localizeChapter), with the reader's
 * font-scale preference applied to the body via a `--reading-font-scale`
 * CSS variable (see app/globals.css's `.prose-body` rule) -- Phase 2's
 * localization and Phase 3's font-scale wrapper share this one client
 * leaf since both only ever render together.
 *
 * `badge` and `bookmarkButton` are rendered nodes passed in from the
 * server-rendered page.tsx (DraftBadge/BookmarkButton are their own
 * client components already), same pattern as
 * LocalizedDivyaDesamContent.tsx. `images` arrive with their URLs already
 * resolved server-side (that lookup needs node:fs); each is drawn either
 * above the text or, when it has a placementAnchor, directly after the
 * paragraph it belongs to (content-lib/inline-images.ts).
 *
 * Parity pass with mobile's [chapter].tsx: the "CHAPTER X OF Y · N MIN
 * READ" label, the book title line above the chapter title, and the
 * Previous/Next pager. There is deliberately no in-chapter table of
 * contents: a chapter with named sections is split into short chapters
 * grouped under a part (BookPart) instead, so each section is its own
 * page in the chapter list rather than a jump-link inside a long one.
 * The pager (findAdjacentChapters,
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
  book: PublicBook;
  bookSlug: string;
  chapter: PublicChapter;
  /** This chapter's 0-indexed position among its book's chapters, or -1 if not found. */
  position: number;
  total: number;
  previous: PublicChapter | null;
  next: PublicChapter | null;
  badge: ReactNode;
  bookmarkButton: ReactNode;
  images: ChapterImageItem[];
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
  const paragraphs = useMemo(() => (displayBody ? paragraphsForReading(displayBody) : []), [displayBody]);
  const placement = useMemo(() => placeInlineImages(paragraphs, images, language), [paragraphs, images, language]);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {badge}
            {position !== -1 ? (
              <p className="eyebrow text-[var(--muted)]">
                {chapterPositionLabel(language, position + 1, total, book.kind)}
                {readingMinutes > 0 ? ` · ${minReadLabel(language, readingMinutes)}` : ""}
              </p>
            ) : null}
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {localizedBook.title}
            {partLabelFor(localizedBook, chapter.slug, localized.title) ? ` · ${partLabelFor(localizedBook, chapter.slug, localized.title)}` : ""}
          </p>
          <h1 className="page-title">{localized.title}</h1>
        </div>
        {bookmarkButton}
      </div>

      {placement.top.length > 0 ? <ImageLightboxGrid images={placement.top} /> : null}

      <div style={{ "--reading-font-scale": preferences.fontScale } as React.CSSProperties}>
        {displayBody ? (
          <LongFormSection
            text={displayBody}
            renderAfter={(index) => {
              const inline = placement.after.get(index);
              return inline ? <ImageLightboxGrid key={`images-${index}`} images={inline} className="grid grid-cols-2 gap-3 py-1 sm:grid-cols-3" /> : null;
            }}
          />
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
