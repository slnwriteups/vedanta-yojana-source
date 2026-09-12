"use client";

import { useLanguage } from "@/lib/language-context";
import { useT } from "@/lib/ui-strings";
import { localizeSankalpamText } from "@/lib/panchangam-labels";
import type { PanchangamData } from "@/lib/panchangam-service";

/**
 * Web port of mobile/components/SankalpamCard.tsx -- the full SAM
 * Sankalpam declaration (lib/panchangam-service.ts) for right now,
 * distinct from HomeHeader's compact Ekadasi/tithi pill: this renders
 * the whole, unabridged sentence, since a Sankalpam is recited in full.
 * Renders nothing while `panchangam` is still loading (null) or once
 * loaded with no usable Sankalpam text (offline fallback) -- never a
 * placeholder card with empty content.
 *
 * The fixed English wrapper phrasing ("Sankalpam for X on Y At Z...")
 * is re-templated per language via localizeSankalpamText
 * (lib/panchangam-labels.ts); the Sanskrit declaration itself stays
 * untranslated, exactly as it does on mobile.
 */
export function SankalpamCard({ panchangam }: { panchangam: PanchangamData | null }) {
  const { language } = useLanguage();
  const t = useT();

  if (!panchangam || !panchangam.sankalpamText) return null;

  return (
    <div className="space-y-2">
      <p className="eyebrow">{t("homeSankalpamLabel")}</p>
      {/* Same reading-comfort treatment as chapter body text
          (LongFormSection): the serif reading face, full body size, and
          a taller line-height -- a Sankalpam is dense, comma-separated
          Sanskrit prose. */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="prose-body whitespace-pre-line">
          {localizeSankalpamText(panchangam.sankalpamText, language)}
        </p>
      </div>
    </div>
  );
}
