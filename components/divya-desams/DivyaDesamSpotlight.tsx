"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { PublicDivyaDesam } from "@/lib/public-content";
import { localizeDivyaDesam } from "@/content-lib/i18n.ts";
import { regionLabel } from "@/content-lib/divya-desam-region-labels.ts";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme";
import { sectionTint } from "@/lib/section-tints";
import { useT } from "@/lib/ui-strings";

/**
 * Client half of the web port of mobile/components/DivyaDesamSpotlight.tsx
 * -- localizes the day's record (picked server-side in
 * DivyaDesamSpotlightSection.tsx, same shared day-rotation logic from
 * content-lib/divya-desam-spotlight.ts) and renders it as a full-width
 * card, same visual language (image background or a tinted fallback,
 * title/region/deity overlay) as mobile, linking to the same detail
 * route via next/link instead of expo-router's router.push.
 */
export function DivyaDesamSpotlight({
  record,
  numberLabel,
  imageHref,
}: {
  record: PublicDivyaDesam;
  numberLabel: string;
  imageHref: string | null;
}) {
  const { language } = useLanguage();
  const scheme = useTheme();
  const t = useT();
  const localized = useMemo(() => localizeDivyaDesam(record, language), [record, language]);

  const tint = sectionTint("divya-desams", scheme);
  const region = localized.region ? regionLabel(localized.region, language) : "";
  const deity = localized.templeInformation.moolavar ?? "";
  const titleLine = `${numberLabel}. ${localized.displayName}`;

  return (
    <div className="space-y-2">
      <p className="eyebrow px-1">{t("homeSpotlightLabel")}</p>
      <Link
        href={`/divya-desams/${record.slug}`}
        aria-label={[titleLine, region, deity].filter(Boolean).join(". ")}
        className="block overflow-hidden rounded-lg transition-opacity hover:opacity-95"
      >
        <div
          className="relative flex h-45 items-end bg-cover bg-center"
          style={{
            backgroundColor: tint,
            backgroundImage: imageHref ? `url(${imageHref})` : undefined,
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
