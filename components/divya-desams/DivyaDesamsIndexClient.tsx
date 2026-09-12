"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DivyaDesam, Knowledge } from "@/content-lib/schemas";
import { DIVYA_DESAM_REGION_ORDER, type DivyaDesamRegion } from "@/content-lib/schemas/index.ts";
import { localizeKnowledge } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme";
import { sectionTint } from "@/lib/section-tints";
import { regionLabel } from "@/content-lib/divya-desam-region-labels.ts";
import { translateUi, useT, type UiStringKey } from "@/lib/ui-strings";
import type { LanguageCode } from "@/lib/preferences";
import { DivyaDesamCard } from "@/components/divya-desams/DivyaDesamCard";

/** One region is a celestial abode, not a terrestrial one -- gets "Celestial Divya Desam(s)" instead of "Divya Desam(s)" in the count line. Ported verbatim from mobile/app/(tabs)/divya-desams/index.tsx. */
const CELESTIAL_REGION: DivyaDesamRegion = "Viṇṇulaga Tiruppatigaḷ";

/**
 * "All 108" is a UI-only pseudo-tab, not a content classification -- kept
 * as a distinct sentinel so `selectedTab` can hold either this or a real
 * region, exactly as mobile's own ALL_TAB does.
 */
const ALL_TAB = "All 108" as const;
type DivyaDesamTab = typeof ALL_TAB | DivyaDesamRegion;
const TABS: readonly DivyaDesamTab[] = [ALL_TAB, ...DIVYA_DESAM_REGION_ORDER];

/** Ported verbatim from mobile/app/(tabs)/divya-desams/index.tsx's tabCountLabel(). */
function tabCountLabel(tab: DivyaDesamTab, count: number, language: LanguageCode | null): string {
  const nounKey: UiStringKey = tab === CELESTIAL_REGION ? "celestialDivyaDesamCountNoun" : "divyaDesamCountNoun";
  const noun = translateUi(nounKey, language);
  const suffix = language === null && count !== 1 ? "s" : "";
  return `${count} ${noun}${suffix}`;
}

/**
 * The traditional Divya Desam count for a set of records -- NOT
 * records.length, since one record (Tiruttetriambalam Tirumanikoodam)
 * represents TWO traditionally-numbered Divya Desams (#36-37). Ported
 * verbatim from mobile/app/(tabs)/divya-desams/index.tsx's
 * traditionalCount(). Without this, "All 108" would read 107.
 */
function traditionalCount(records: DivyaDesam[], numberLabels: Record<string, string>): number {
  let total = 0;
  for (const record of records) {
    total += numberLabels[record.slug]?.includes("-") ? 2 : 1;
  }
  return total;
}

export interface DivyaDesamIndexEntry {
  record: DivyaDesam;
  number: string;
  imageHref: string | null;
}

/**
 * Client half of the Divya Desam index: the "Geographical Classification"
 * region-filter tab row (mobile's `mobile/app/(tabs)/divya-desams/index.tsx`
 * lines 80-88/114-118/143-191, previously entirely absent on web) plus the
 * per-tab traditional count line, the localized introduction card, and the
 * (already-localized) record list. `entries`/`numberLabels`/`introduction`
 * are all resolved server-side (app/divya-desams/page.tsx) since the
 * content loader and image resolver are server-only; this component only
 * localizes and filters.
 */
export function DivyaDesamsIndexClient({
  entries,
  numberLabels,
  introduction,
}: {
  entries: DivyaDesamIndexEntry[];
  numberLabels: Record<string, string>;
  introduction: Knowledge | null;
}) {
  const { language } = useLanguage();
  const theme = useTheme();
  const tint = sectionTint("divya-desams", theme);
  const t = useT();
  const [selectedTab, setSelectedTab] = useState<DivyaDesamTab>(ALL_TAB);

  const localizedIntroduction = useMemo(
    () => (introduction ? localizeKnowledge(introduction, language) : null),
    [introduction, language]
  );

  const visibleEntries = useMemo(
    () => (selectedTab === ALL_TAB ? entries : entries.filter((e) => e.record.region === selectedTab)),
    [entries, selectedTab]
  );

  return (
    <div className="space-y-6">
      {localizedIntroduction ? (
        <Link
          href="/divya-desams/introduction"
          className="relative block overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--accent)]"
        >
          <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: tint }} />
          <h2 className="section-heading">{localizedIntroduction.title}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("introCardSubtitle")}</p>
        </Link>
      ) : null}

      <div className="space-y-3">
        <p className="eyebrow">{t("geoClassificationEyebrow")}</p>
        <div
          className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label={t("geoClassificationEyebrow")}
        >
          {TABS.map((tab) => {
            const active = tab === selectedTab;
            const label = tab === ALL_TAB ? t("allDivyaDesamsTab") : regionLabel(tab, language);
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedTab(tab)}
                className={`flex-none whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[#fffaf5]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-[var(--muted)]">
          {tabCountLabel(selectedTab, traditionalCount(visibleEntries.map((e) => e.record), numberLabels), language)}
        </p>
      </div>

      <ul role="list" className="space-y-3">
        {visibleEntries.map(({ record, number, imageHref }) => (
          <DivyaDesamCard key={record.slug} record={record} number={number} imageHref={imageHref} />
        ))}
      </ul>
    </div>
  );
}
