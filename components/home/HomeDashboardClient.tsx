"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme";
import { sectionTint } from "@/lib/section-tints";
import { bookCoverAsset } from "@/lib/book-covers";
import { useT } from "@/lib/ui-strings";
import { useReadingPosition } from "@/lib/reading-position-context";
import { resolveAllLastRead, type HomeCatalogEntry } from "@/lib/resolve-last-read";
import { fetchAhobilaPanchangam, type PanchangamData } from "@/lib/panchangam-service";
import { HomeHeader } from "@/components/home/HomeHeader";
import { ContinueReadingCard } from "@/components/home/ContinueReadingCard";
import { PanchangamCard } from "@/components/home/PanchangamCard";
import { PanchangamCalendar } from "@/components/home/PanchangamCalendar";
import { SankalpamCard } from "@/components/home/SankalpamCard";

/**
 * Web port of mobile/app/(tabs)/index.tsx's HomeScreen -- the full Home
 * dashboard, previously entirely absent on web (which showed only a
 * static two-tile landing page with stale, non-localized copy). Same
 * composition as mobile: greeting + Panchangam pill (HomeHeader), a
 * "Continue Reading" section once a reading position exists, else a
 * "Get Started" pair of entry-point cards, the Divya Desam spotlight
 * (already ported separately -- rendered by the server page around this
 * component, since it needs node:fs to resolve its image), the full
 * Panchangam card, and the Sankalpam card.
 *
 * The Panchangam fetch is owned here, once, and passed down to both
 * HomeHeader and PanchangamCard/SankalpamCard as a plain prop -- avoids
 * three components independently re-fetching (and re-reading the same
 * localStorage cache key) for the same day's data.
 *
 * `catalog` (every book + its chapters) is resolved server-side (the
 * content loader is server-only) and passed in as plain props so
 * lib/resolve-last-read.ts can resolve a saved reading position into
 * real, current, localized titles without needing its own loader call.
 *
 * `spotlight` is DivyaDesamSpotlightSection, rendered by the server page
 * around this component (it needs node:fs to resolve the day's image)
 * and slotted in here so the visual order matches mobile's exactly:
 * header -> continue-reading/get-started -> spotlight -> Panchangam ->
 * Sankalpam.
 */
export function HomeDashboardClient({
  catalog,
  spotlight,
}: {
  catalog: HomeCatalogEntry[];
  spotlight: ReactNode;
}) {
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const { lastReadByBook } = useReadingPosition();
  const resolvedList = resolveAllLastRead(lastReadByBook, catalog, language);

  const [panchangam, setPanchangam] = useState<PanchangamData | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchAhobilaPanchangam().then((data) => {
      if (!cancelled) setPanchangam(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <HomeHeader panchangam={panchangam} />

      {resolvedList.length > 0 ? (
        <div className="space-y-2">
          <p className="eyebrow">{t("homeContinueReadingLabel")}</p>
          <div className="space-y-3">
            {resolvedList.map((resolved) => (
              <ContinueReadingCard
                key={resolved.bookSlug}
                chapterTitle={resolved.chapterTitle}
                bookTitle={resolved.bookTitle}
                coverHref={bookCoverAsset(resolved.bookSlug)}
                tintColor={sectionTint(resolved.bookSlug, theme)}
                monogram={resolved.bookTitle.trim().charAt(0).toUpperCase()}
                position={resolved.chapterPosition}
                total={resolved.totalChapters}
                minutesLeft={resolved.minutesLeft}
                href={`/library/${resolved.bookSlug}/${resolved.chapterSlug}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="eyebrow">{t("homeGetStartedLabel")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <GetStartedCard
              href="/divya-desams"
              title={t("tabDivyaDesams")}
              subtitle={t("divyaDesamsCardSubtitle")}
              monogram="D"
              tintColor={sectionTint("divya-desams", theme)}
            />
            <GetStartedCard
              href="/library"
              title={t("tabLibrary")}
              subtitle={t("libraryCardSubtitle")}
              monogram="L"
              tintColor="var(--accent)"
            />
          </div>
        </div>
      )}

      <PanchangamCalendar />

      {spotlight}

      <PanchangamCard panchangam={panchangam} />
      <SankalpamCard panchangam={panchangam} />
    </div>
  );
}

/**
 * Web port of mobile's shared ContentCard (mobile/components/ContentCard.tsx)
 * as rendered for Home's two "Get Started" entry points, which have no
 * cover photo: a thin left-edge tint stripe plus a tinted monogram
 * swatch in place of a thumbnail -- previously missing entirely on web,
 * which rendered these two tiles as plain bordered text blocks.
 */
function GetStartedCard({
  href,
  title,
  subtitle,
  monogram,
  tintColor,
}: {
  href: string;
  title: string;
  subtitle: string;
  monogram: string;
  tintColor: string;
}) {
  return (
    <Link
      href={href}
      className="relative flex items-center gap-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: tintColor }} />
      <span
        aria-hidden
        className="flex h-14 w-14 flex-none items-center justify-center rounded-md text-lg font-bold"
        style={{ backgroundColor: tintColor, color: "#fffaf5" }}
      >
        {monogram}
      </span>
      <div>
        <h2 className="section-heading">{title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      </div>
    </Link>
  );
}
