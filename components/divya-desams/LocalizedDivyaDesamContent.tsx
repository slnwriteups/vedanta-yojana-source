"use client";

import { useMemo, type ReactNode } from "react";
import type { DivyaDesam } from "@/content-lib/schemas";
import { localizeDivyaDesam } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { TempleInformation } from "@/components/divya-desams/TempleInformation";
import { SthalaPuranamWithImages, type ResolvedImage } from "@/components/divya-desams/SthalaPuranamWithImages";
import { LongFormSection } from "@/components/shared/LongFormSection";
import { ShrineDetails } from "@/components/divya-desams/ShrineDetails";

/**
 * The one client boundary on the Divya Desam detail page -- wraps only
 * the fields content-lib/i18n.ts's localizeDivyaDesam() actually
 * translates (displayName, templeInformation, sthalaPuranam,
 * azhwarPasuram, and each shrine's own name/templeInformation/
 * sthalaPuranam/azhwarPasuram). Everything else on the page (images,
 * shrine map links, resource links, the breadcrumb/JsonLd metadata)
 * isn't localized content and stays server-rendered in page.tsx,
 * passed in here as already-rendered nodes so the visual order matches
 * the English-only page exactly.
 *
 * `resolvedAfterSthalaPuranamImages` is resolved server-side (uuid ->
 * public URL) since that lookup needs node:fs -- see
 * lib/image-file.ts -- and can't run in a client component.
 */
export function LocalizedDivyaDesamContent({
  record,
  badge,
  shrineLinks,
  topImages,
  resourceLinks,
  resolvedAfterSthalaPuranamImages,
}: {
  record: DivyaDesam;
  badge: ReactNode;
  shrineLinks: ReactNode;
  topImages: ReactNode;
  resourceLinks: ReactNode;
  resolvedAfterSthalaPuranamImages: ResolvedImage[];
}) {
  const { language } = useLanguage();
  const localized = useMemo(() => localizeDivyaDesam(record, language), [record, language]);

  return (
    <>
      <div className="space-y-2">
        {badge}
        <h1 className="page-title">{localized.displayName}</h1>
      </div>

      <TempleInformation info={localized.templeInformation} />
      {shrineLinks}
      {topImages}
      {localized.sthalaPuranam ? (
        resolvedAfterSthalaPuranamImages.length > 0 ? (
          <SthalaPuranamWithImages text={localized.sthalaPuranam} images={resolvedAfterSthalaPuranamImages} />
        ) : (
          <LongFormSection heading="Sthala Puranam" text={localized.sthalaPuranam} />
        )
      ) : null}
      {localized.azhwarPasuram ? <LongFormSection heading="Azhwar Pasuram" text={localized.azhwarPasuram} /> : null}
      <ShrineDetails shrines={localized.shrines} />
      {resourceLinks}
    </>
  );
}
