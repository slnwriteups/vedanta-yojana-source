"use client";

import { useLanguage } from "@/lib/language-context";
import { useT, type UiStringKey } from "@/lib/ui-strings";
import { localizeUpcomingEkadashi, pakshaLabel, tithiLabel } from "@/lib/panchangam-labels";
import type { PanchangamData } from "@/lib/panchangam-service";

/**
 * Web port of mobile/components/HomeHeader.tsx -- Home's greeting +
 * compact Panchangam banner. `panchangam` is owned by the page's own
 * client dashboard component (one fetchAhobilaPanchangam() call shared
 * with SankalpamCard/PanchangamCard, so this never triggers its own
 * network request) -- `null` means "still loading", never "no data", so
 * the skeleton and the empty/offline state stay visually distinct.
 */
function greetingKeyForHour(hour: number): UiStringKey {
  if (hour < 12) return "homeGreetingMorning";
  if (hour < 17) return "homeGreetingAfternoon";
  if (hour < 21) return "homeGreetingEvening";
  return "homeGreetingNight";
}

export function HomeHeader({ panchangam }: { panchangam: PanchangamData | null }) {
  const t = useT();
  const { language } = useLanguage();
  const greeting = `${t(greetingKeyForHour(new Date().getHours()))}, ${t("homeReaderNoun")}`;

  const pakshaTithi = panchangam
    ? [pakshaLabel(panchangam.paksha, language), tithiLabel(panchangam.tithi, language)].filter(Boolean).join(" ")
    : "";
  const bannerText = panchangam
    ? [localizeUpcomingEkadashi(panchangam.upcomingEkadashiText, language), pakshaTithi].filter(Boolean).join(" • ")
    : "";

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
      <p className="prose-body text-[var(--muted)]">{t("homeGreetingSubtitle")}</p>
      {panchangam === null ? (
        <div className="mt-2 h-9 w-56 max-w-full animate-pulse rounded-full bg-[var(--border)]" />
      ) : bannerText ? (
        <div className="mt-2 inline-flex h-9 max-w-full items-center rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-4">
          <span className="truncate text-sm font-semibold">{`📅 ${bannerText}`}</span>
        </div>
      ) : null}
    </div>
  );
}
