"use client";

import { useMemo, type ReactNode } from "react";
import type { PublicDivyaDesam } from "@/lib/public-content";
import { localizeDivyaDesam } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { translateUi } from "@/lib/ui-strings";
import { TempleInformation } from "@/components/divya-desams/TempleInformation";
import { ShrineLinks } from "@/components/divya-desams/ShrineLinks";
import { ResourceLinks } from "@/components/divya-desams/ResourceLinks";
import { SthalaPuranamWithImages, type ResolvedImage } from "@/components/divya-desams/SthalaPuranamWithImages";
import { LongFormSection } from "@/components/shared/LongFormSection";
import { ShrineDetails } from "@/components/divya-desams/ShrineDetails";

/**
 * The one client boundary on the Divya Desam detail page. Wraps the
 * fields content-lib/i18n.ts's localizeDivyaDesam() actually translates
 * (displayName, templeInformation, sthalaPuranam, azhwarPasuram, and
 * each shrine's own name/templeInformation/sthalaPuranam/azhwarPasuram)
 * AND every section heading/field label around them (ui-strings.ts,
 * same keys mobile's [slug].tsx screen uses) -- so switching languages
 * translates the whole page, not just the prose. `shrines`/`resources`
 * are rendered here (not pre-rendered server-side as ReactNode) because
 * their own headings need `language`; their underlying data
 * (mapsLink/url) isn't translated content either way. Images and the
 * breadcrumb/JsonLd metadata aren't localized content and stay
 * server-rendered in page.tsx, passed in here as already-rendered nodes
 * so the visual order matches the English-only page exactly.
 *
 * `resolvedAfterSthalaPuranamImages` is resolved server-side (uuid ->
 * public URL) since that lookup needs node:fs -- see
 * lib/image-file.ts -- and can't run in a client component.
 */
export function LocalizedDivyaDesamContent({
  record,
  badge,
  topImages,
  resolvedAfterSthalaPuranamImages,
}: {
  record: PublicDivyaDesam;
  badge: ReactNode;
  topImages: ReactNode;
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

      {topImages}

      <TempleInformation info={localized.templeInformation} language={language} />
      {/* Kept right beside Temple Information's own "How to reach" field
          (not down with the narrative sections below) so a traveler gets
          the travel note and the actual clickable map together, in one
          place. Matches mobile's own [slug].tsx screen order: images,
          then Temple Information, then the Shrine Locations/Maps links. */}
      <ShrineLinks shrines={record.shrines} language={language} />
      {localized.sthalaPuranam ? (
        resolvedAfterSthalaPuranamImages.length > 0 ? (
          <SthalaPuranamWithImages
            text={localized.sthalaPuranam}
            images={resolvedAfterSthalaPuranamImages}
            heading={translateUi("sthalaPuranamHeading", language)}
          />
        ) : (
          <LongFormSection
            heading={translateUi("sthalaPuranamHeading", language)}
            headingId="sthala-puranam-heading"
            text={localized.sthalaPuranam}
          />
        )
      ) : null}
      {localized.azhwarPasuram ? (
        <LongFormSection
          heading={translateUi("azhwarPasuramHeading", language)}
          headingId="azhwar-pasuram-heading"
          text={localized.azhwarPasuram}
        />
      ) : null}
      <ShrineDetails shrines={localized.shrines} language={language} />
      <ResourceLinks resources={record.resources} language={language} />
    </>
  );
}
