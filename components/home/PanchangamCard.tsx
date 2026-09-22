"use client";

import { useLanguage } from "@/lib/language-context";
import { useT } from "@/lib/ui-strings";
import { localizeUpcomingEkadashi, nakshatramLabel, pakshaLabel, tithiLabel } from "@/lib/panchangam-labels";
import type { PanchangamData } from "@/lib/panchangam-service";

/**
 * Web port of mobile/components/PanchangamCard.tsx -- Home's full
 * daily-calendar card, the expanded counterpart to HomeHeader's compact
 * one-line pill. Every field lib/panchangam-service.ts extracts
 * (festival, the place it was computed for, tithi/paksha, nakshatram,
 * upcoming Ekadashi) gets its own labeled row, the same way
 * SankalpamCard is the expanded counterpart for the Sankalpam text.
 * Renders nothing while `panchangam` is still loading (null).
 *
 * The location row comes first: every other row is only true FOR that
 * place (tithi/nakshatra transition times shift with longitude), so it
 * frames the rows beneath it rather than trailing them as a footnote.
 * It is omitted entirely when no place name resolved, never filled with
 * a placeholder.
 */
export function PanchangamCard({ panchangam }: { panchangam: PanchangamData | null }) {
  const t = useT();
  const { language } = useLanguage();

  if (!panchangam) return null;

  const hasData = panchangam.tithi || panchangam.nakshatram || panchangam.festival;
  const pakshaTithi = [pakshaLabel(panchangam.paksha, language), tithiLabel(panchangam.tithi, language)]
    .filter(Boolean)
    .join(" ");
  const nakshatram = nakshatramLabel(panchangam.nakshatram, language);

  return (
    <div className="space-y-2">
      <p className="eyebrow">{t("homeCalendarLabel")}</p>
      <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        {hasData ? (
          <>
            {panchangam.festival ? (
              <p className="mb-1 text-base font-bold text-[var(--accent)]">{panchangam.festival}</p>
            ) : null}
            {panchangam.location ? (
              <Row label={t("homeCalendarLocationLabel")} value={panchangam.location} />
            ) : null}
            {pakshaTithi ? <Row label={t("homeCalendarTithiLabel")} value={pakshaTithi} /> : null}
            {nakshatram ? <Row label={t("homeCalendarNakshatramLabel")} value={nakshatram} /> : null}
            {panchangam.upcomingEkadashiText ? (
              <Row
                label={t("homeCalendarEkadashiLabel")}
                value={localizeUpcomingEkadashi(panchangam.upcomingEkadashiText, language)}
              />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">{t("homeLocationUnavailable")}</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-right text-sm font-semibold">{value}</span>
    </div>
  );
}
