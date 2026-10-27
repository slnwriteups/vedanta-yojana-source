"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { useT, type UiStringKey } from "@/lib/ui-strings";
import { localizeUpcomingEkadashi, nakshatramLabel, pakshaLabel, tithiLabel } from "@/lib/panchangam-labels";
import type { PanchangamData } from "@/lib/panchangam-service";

/**
 * Web port of mobile/components/HomeHeader.tsx -- Home's first screen.
 * The day itself is the title: once today's Panchangam is in, the h1 is
 * its Paksha + Tithi at display size, with the greeting as a small line
 * above it; until then (or when no place is known) the greeting is the
 * title. `panchangam` is owned by the page's own client dashboard
 * component (one fetchPanchangam() call shared with SankalpamCard/
 * PanchangamCard, so this never triggers its own network request) --
 * `null` means "still loading", never "no data", so the skeleton and
 * the empty/offline state stay visually distinct.
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
  const greeting = t(greetingKeyForHour(new Date().getHours()));

  const pakshaTithi = panchangam
    ? [pakshaLabel(panchangam.paksha, language), tithiLabel(panchangam.tithi, language)].filter(Boolean).join(" ")
    : "";
  const nakshatram = panchangam?.nakshatram ? nakshatramLabel(panchangam.nakshatram, language) : "";
  const ekadashi = panchangam ? localizeUpcomingEkadashi(panchangam.upcomingEkadashiText, language) : "";

  return (
    <div>
      <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]">
        {pakshaTithi ? (
          <span className="mb-2 block text-lg leading-normal font-medium tracking-normal text-[var(--muted)]">{greeting}</span>
        ) : null}
        <span className="block">{pakshaTithi || greeting}</span>
      </h1>

      {panchangam === null ? (
        <div className="mt-5 h-6 w-64 max-w-full rounded bg-[var(--surface-alt)] motion-safe:animate-pulse" />
      ) : (
        <div className="mt-5 space-y-1 text-lg">
          {nakshatram ? <p>{`${t("homeCalendarNakshatramLabel")}: ${nakshatram}`}</p> : null}
          {ekadashi ? <p className="text-[var(--muted)]">{ekadashi}</p> : null}
        </div>
      )}

      <p className="prose-body mt-5 max-w-md text-[var(--muted)]">{t("homeGreetingSubtitle")}</p>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <a
          href="#panchangam"
          className="inline-flex h-12 items-center rounded-full bg-[var(--accent)] px-6 font-semibold text-[var(--surface)] transition-opacity hover:opacity-90"
        >
          {t("homeCalendarLabel")}
        </a>
        <Link href="/divya-desams" className="font-semibold text-[var(--accent)] hover:underline">
          {t("tabDivyaDesams")} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
