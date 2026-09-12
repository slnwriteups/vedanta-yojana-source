"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { continueReadingProgressLabel, useT } from "@/lib/ui-strings";

/**
 * Web port of mobile/components/ContinueReadingCard.tsx -- Home's hero
 * "Continue Reading" card: cover thumbnail, chapter/book title, a
 * horizontal progress bar, and a Resume link, all in one full-width row.
 * `position`/`total` are the chapter's place in its book's own
 * chapterOrder; `minutesLeft` is estimateReadingMinutes() of the chapter
 * body itself, i.e. "time left in this chapter", not the whole book --
 * both real, derived numbers (lib/resolve-last-read.ts), nothing
 * fabricated.
 */
export function ContinueReadingCard({
  chapterTitle,
  bookTitle,
  coverHref,
  tintColor,
  monogram,
  position,
  total,
  minutesLeft,
  href,
}: {
  chapterTitle: string;
  bookTitle: string;
  coverHref: string | null;
  tintColor: string;
  monogram: string;
  position: number;
  total: number;
  minutesLeft: number;
  href: string;
}) {
  const t = useT();
  const { language } = useLanguage();
  const percentComplete = total > 0 ? Math.round((position / total) * 100) : 0;
  const progressLabel = continueReadingProgressLabel(language, position, total, percentComplete, minutesLeft);

  return (
    <Link
      href={href}
      aria-label={[chapterTitle, bookTitle, progressLabel].join(". ")}
      className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-alt)]"
    >
      {coverHref ? (
        <img
          src={coverHref}
          alt=""
          className="h-24 w-16 flex-none rounded-md border border-[var(--border)] object-contain"
        />
      ) : (
        <div
          className="flex h-24 w-16 flex-none items-center justify-center rounded-md text-2xl font-bold text-[#fffaf5]"
          style={{ backgroundColor: tintColor }}
        >
          {monogram}
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-bold">{chapterTitle}</p>
        <p className="truncate text-sm text-[var(--muted)]">{bookTitle}</p>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full rounded-full" style={{ width: `${percentComplete}%`, backgroundColor: tintColor }} />
        </div>
        <p className="truncate text-xs uppercase tracking-wide text-[var(--muted)]">{progressLabel}</p>
      </div>

      <span
        className="flex-none rounded-md px-3 py-2 text-sm font-bold text-[#fffaf5]"
        style={{ backgroundColor: tintColor }}
      >
        {`▶ ${t("resumeButtonLabel")}`}
      </span>
    </Link>
  );
}
