"use client";

import { useLanguage } from "@/lib/language-context";
import { useT } from "@/lib/ui-strings";
import { nakshatramLabel, pakshaLabel, tithiLabel } from "@/lib/panchangam-labels";
import type { PanchangamData } from "@/lib/panchangam-service";

/**
 * Web port of mobile/components/PanchangamCard.tsx -- Home's full
 * daily-calendar card, the expanded counterpart to HomeHeader's compact
 * one-line pill. Every field lib/panchangam-service.ts extracts
 * (festival, tithi/paksha, nakshatram, upcoming Ekadashi) gets its own
 * labeled row, the same way SankalpamCard is the expanded counterpart
 * for the Sankalpam text. Renders nothing while `panchangam` is still
 * loading (null).
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
            {pakshaTithi ? <Row label={t("homeCalendarTithiLabel")} value={pakshaTithi} /> : null}
            {nakshatram ? <Row label={t("homeCalendarNakshatramLabel")} value={nakshatram} /> : null}
            {panchangam.upcomingEkadashiText ? (
              <Row label={t("homeCalendarEkadashiLabel")} value={panchangam.upcomingEkadashiText} />
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
