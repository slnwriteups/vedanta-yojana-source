"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Announcement } from "@/content-lib/announcements.ts";
import { WhatsNewList } from "@/components/whats-new/WhatsNewList";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme";
import { sectionTint } from "@/lib/section-tints";
import { bookCoverAsset } from "@/lib/book-covers";
import { useT } from "@/lib/ui-strings";
import { useReadingPosition } from "@/lib/reading-position-context";
import { resolveAllLastRead, type HomeCatalogEntry } from "@/lib/resolve-last-read";
import { fetchPanchangam, type PanchangamData } from "@/lib/panchangam-service";
import { loadPanchangamPlace, usePanchangamPlace } from "@/lib/panchangam-place-store";
import { HomeHeader } from "@/components/home/HomeHeader";
import { ContinueReadingCard } from "@/components/home/ContinueReadingCard";
import { PanchangamCalendar } from "@/components/home/PanchangamCalendar";

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
 * and slotted in here beside the header. Order: header, What's New and
 * continue-reading/get-started beside the spotlight -> Panchangam.
 */
export function HomeDashboardClient({
  catalog,
  announcements,
  spotlight,
}: {
  catalog: HomeCatalogEntry[];
  /** Newest first, from content/announcements.json -- the What's New card shows the latest two. */
  announcements: Announcement[];
  spotlight: ReactNode;
}) {
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const { lastReadByBook } = useReadingPosition();
  const resolvedList = resolveAllLastRead(lastReadByBook, catalog, language);

  // Today's Panchangam for the chosen city, or the browser's location when
  // none is chosen; recomputed when the reader changes the city, and when
  // it stops being current (its Sankalpam's validity ends, or midnight) --
  // so a tab left open never shows a stale Sankalpam as the present one.
  const [panchangam, setPanchangam] = useState<PanchangamData | null>(null);
  const [refreshes, setRefreshes] = useState(0);
  const { place, ready: placeReady } = usePanchangamPlace();
  useEffect(() => {
    void loadPanchangamPlace();
  }, []);
  useEffect(() => {
    setPanchangam(null);
  }, [place]);
  useEffect(() => {
    if (!placeReady) return;
    let cancelled = false;
    fetchPanchangam(undefined, place).then((data) => {
      if (!cancelled) setPanchangam(data);
    });
    return () => {
      cancelled = true;
    };
  }, [place, placeReady, refreshes]);
  const currentUntil = panchangam?.currentUntil;
  useEffect(() => {
    if (currentUntil === undefined) return;
    const refresh = () => setRefreshes((n) => n + 1);
    // Coming back to the tab recomputes: its timers are throttled in the background,
    // and the reader may have moved since (the location is read again).
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setTimeout(refresh, Math.max(0, currentUntil - Date.now()) + 1000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [currentUntil]);

  const readingOrStart =
    resolvedList.length > 0 ? (
      <section aria-labelledby="home-continue-reading" className="space-y-4">
        <h2 id="home-continue-reading" className="section-heading">
          {t("homeContinueReadingLabel")}
        </h2>
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
              kind={resolved.kind}
              href={`/library/${resolved.bookSlug}/${resolved.chapterSlug}`}
            />
          ))}
        </div>
      </section>
    ) : (
      <section aria-labelledby="home-get-started" className="space-y-4">
        <h2 id="home-get-started" className="section-heading">
          {t("homeGetStartedLabel")}
        </h2>
        <div className="space-y-4">
          <GetStartedCard href="/divya-desams" title={t("tabDivyaDesams")} subtitle={t("divyaDesamsCardSubtitle")} />
          <GetStartedCard href="/library" title={t("tabLibrary")} subtitle={t("libraryCardSubtitle")} />
        </div>
      </section>
    );

  return (
    <div className="space-y-16">
      {/* Desktop: the greeting, What's New and entry points beside the
          day's Divya Desam photograph, so the first screen holds them all;
          a phone stacks them in that order. */}
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="space-y-12">
          <HomeHeader />
          {/* Right under the greeting, as a short list of titles, so a notice
              that needs acting on (an app update to install) is seen first --
              What's New is not in the site navigation. */}
          {announcements.length > 0 ? (
            <section aria-labelledby="home-whats-new" className="space-y-4">
              <h2 id="home-whats-new" className="section-heading">
                {t("whatsNewLabel")}
              </h2>
              <WhatsNewList announcements={announcements} limit={3} compact />
              <Link href="/whats-new" className="inline-block font-semibold text-[var(--accent)] hover:underline">
                {t("whatsNewSeeAll")} <span aria-hidden="true">→</span>
              </Link>
            </section>
          ) : null}
          {readingOrStart}
        </div>
        {spotlight}
      </div>

      <PanchangamCalendar initialPanchangam={panchangam} />
    </div>
  );
}

/**
 * Home's two "Get Started" entry points: a surface one tone step off the
 * page, with the title at heading size and an arrow -- no outline, no
 * monogram tile.
 */
function GetStartedCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="group block rounded-lg bg-[var(--surface-alt)] p-6 transition-colors hover:bg-[var(--surface)]"
    >
      <span className="block text-2xl font-semibold tracking-tight">
        {title} <span aria-hidden="true" className="text-[var(--accent)]">→</span>
      </span>
      <span className="mt-2 block text-[var(--muted)]">{subtitle}</span>
    </Link>
  );
}
