"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PublicDivyaDesam } from "@/lib/public-content";
import { localizeDivyaDesam } from "@/content-lib/i18n.ts";
import { pickSpotlightRecord } from "@/content-lib/divya-desam-spotlight.ts";
import { regionLabel } from "@/content-lib/divya-desam-region-labels.ts";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme";
import { sectionTint } from "@/lib/section-tints";
import { useT } from "@/lib/ui-strings";

export interface SpotlightEntry {
  record: PublicDivyaDesam;
  numberLabel: string;
  imageHref: string | null;
}

/**
 * Client half of the web port of mobile/components/DivyaDesamSpotlight.tsx
 * -- picks and localizes the day's record itself, from the full entry
 * list resolved server-side in DivyaDesamSpotlightSection.tsx (same
 * shared day-rotation logic from content-lib/divya-desam-spotlight.ts,
 * same shuffle order mobile's own client-side pick uses), then renders
 * it as a full-width card: same visual language (image background or a
 * tinted fallback, title/region/deity overlay) as mobile, linking to
 * the same detail route via next/link instead of expo-router's
 * router.push.
 *
 * The pick deliberately happens in an effect, not directly in render:
 * this page is statically exported, so the pre-hydration markup was
 * generated at build time by this exact same code -- if the pick ran
 * directly in render using the visitor's real `new Date()`, any visit
 * on a later calendar day than the last deploy would render different
 * content client-side than what's in the static HTML, producing a
 * React hydration mismatch. Deferring the pick to useEffect (client-
 * only, after mount) means the initial paint renders nothing, then
 * settles to the correct day's record an instant later, every time --
 * never a mismatch, and never stuck on the build day.
 */
export function DivyaDesamSpotlight({ entries }: { entries: SpotlightEntry[] }) {
  const { language } = useLanguage();
  const scheme = useTheme();
  const t = useT();
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    setToday(new Date());
  }, []);

  const entry = useMemo(() => (today ? pickSpotlightRecord(entries, today) : null), [entries, today]);
  const localized = useMemo(
    () => (entry ? localizeDivyaDesam(entry.record, language) : null),
    [entry, language]
  );

  if (!entry || !localized) return null;

  const tint = sectionTint("divya-desams", scheme);
  const region = localized.region ? regionLabel(localized.region, language) : "";
  const deity = localized.templeInformation.moolavar ?? "";
  const titleLine = `${entry.numberLabel}. ${localized.displayName}`;

  return (
    <div className="space-y-2">
      <p className="eyebrow px-1">{t("homeSpotlightLabel")}</p>
      <Link
        href={`/divya-desams/${entry.record.slug}`}
        aria-label={[titleLine, region, deity].filter(Boolean).join(". ")}
        className="block overflow-hidden rounded-lg transition-opacity hover:opacity-95"
      >
        <div
          className="relative flex h-45 items-end bg-cover bg-center"
          style={{
            backgroundColor: tint,
            backgroundImage: entry.imageHref ? `url(${entry.imageHref})` : undefined,
          }}
        >
          <div className="w-full p-4" style={{ backgroundColor: "var(--overlay)" }}>
            <p className="line-clamp-2 text-lg font-bold text-[#fffaf5]">{titleLine}</p>
            {region ? <p className="text-sm text-[#fffaf5] opacity-90">{region}</p> : null}
            {deity ? <p className="text-sm text-[#fffaf5] opacity-90">{deity}</p> : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
