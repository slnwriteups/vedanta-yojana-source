import type { TempleInformation as TempleInformationData } from "@/content-lib/schemas";
import { translateUi, type UiStringKey } from "@/lib/ui-strings";
import type { LanguageCode } from "@/lib/preferences";

/**
 * Renders only the templeInformation fields actually present. A handful
 * of records (the known Page24/Page38/Page40 multi-shrine cases, plus at
 * least one other record where the source text had no recognizable
 * labels) have an entirely empty templeInformation object -- in that
 * case this renders nothing at all, not an empty heading or fabricated
 * "Unknown" placeholders.
 *
 * Heading/field labels are localized via ui-strings.ts's translateUi,
 * the same keys mobile's [slug].tsx screen uses (templeInformationHeading,
 * fieldMoolavar/fieldThayaar/fieldVimanam/fieldTheertham/fieldTravelNote)
 * -- `language` is a plain prop (this stays a non-"use client" component)
 * rather than read via useLanguage(), since its caller
 * (LocalizedDivyaDesamContent.tsx) already has it in scope.
 */

const FIELD_LABEL_KEYS: Record<keyof TempleInformationData, UiStringKey> = {
  moolavar: "fieldMoolavar",
  thayaar: "fieldThayaar",
  vimanam: "fieldVimanam",
  theertham: "fieldTheertham",
  travelNote: "fieldTravelNote",
};

const FIELD_ORDER: (keyof TempleInformationData)[] = [
  "moolavar",
  "thayaar",
  "vimanam",
  "theertham",
  "travelNote",
];

export function TempleInformation({
  info,
  language,
}: {
  info: TempleInformationData;
  language: LanguageCode | null;
}) {
  const presentFields = FIELD_ORDER.filter((key) => info[key]);
  if (presentFields.length === 0) return null;

  return (
    <section aria-labelledby="temple-information-heading" className="space-y-3">
      <h2 id="temple-information-heading" className="section-heading">
        {translateUi("templeInformationHeading", language)}
      </h2>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {presentFields.map((key) => (
          <div key={key}>
            <dt className="eyebrow">{translateUi(FIELD_LABEL_KEYS[key], language)}</dt>
            <dd className="prose-body mt-1">{info[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
