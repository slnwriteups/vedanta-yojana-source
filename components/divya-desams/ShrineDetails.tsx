import type { Shrine } from "@/content-lib/schemas";
import {
  extractSpecialNote,
  isListItemLine,
  isVerseLine,
  looksLikeSubheading,
  paragraphsForReading,
} from "@/content-lib/text-format";
import { shrineOrdinalLabel, translateUi, type UiStringKey } from "@/lib/ui-strings";
import type { LanguageCode } from "@/lib/preferences";
import { SpecialNote } from "@/components/shared/SpecialNote";

/**
 * Renders each shrine's OWN temple information/prose, distinct from the
 * record-level TempleInformation/LongFormSection rendered above it on the
 * detail page. Only shrines that actually carry `name`, `templeInformation`,
 * `sthalaPuranam`, or `azhwarPasuram` produce any output (Phase 6E-C:
 * currently Tanjai Mamanikoyil and Tiruvaali Tirunagari only) -- every
 * other record's shrines[] entries have none of these fields, so this
 * renders nothing and existing single-shrine records' pages are
 * unaffected.
 *
 * Heading/field labels/ordinal fallback are localized the same way as
 * TempleInformation.tsx and mobile's [slug].tsx screen (shrinesHeading,
 * fieldMoolavar/etc., shrineOrdinalLabel).
 *
 * Deliberately NOT built by reusing <TempleInformation> per shrine: that
 * component hard-codes a single "temple-information-heading" id, which
 * would collide across multiple shrine instances on the same page.
 */

const FIELD_LABEL_KEYS: Record<"moolavar" | "thayaar" | "vimanam" | "theertham", UiStringKey> = {
  moolavar: "fieldMoolavar",
  thayaar: "fieldThayaar",
  vimanam: "fieldVimanam",
  theertham: "fieldTheertham",
};

const FIELD_ORDER: ("moolavar" | "thayaar" | "vimanam" | "theertham")[] = [
  "moolavar",
  "thayaar",
  "vimanam",
  "theertham",
];

function ProseBlock({ text, language }: { text: string; language: LanguageCode | null }) {
  const paragraphs = paragraphsForReading(text);
  return (
    <div className="prose-body space-y-3 whitespace-pre-line">
      {paragraphs.map((paragraph, index) => {
        const specialNote = extractSpecialNote(paragraph);
        if (specialNote !== null) {
          return <SpecialNote key={index} text={specialNote} language={language} />;
        }
        const bold =
          (looksLikeSubheading(paragraph) && !isListItemLine(paragraph)) || isVerseLine(paragraphs, index);
        return (
          <p key={index} className={bold ? "mt-2 font-bold" : undefined}>
            {paragraph}
          </p>
        );
      })}
    </div>
  );
}

/** A single templeInformation field's value -- see TempleFieldValue in mobile's [slug].tsx for why this needs its own paragraph split rather than one raw <dd>. A <dl> may hold several <dd> per <dt>, so each paragraph gets its own instead of being merged into one. */
function FieldValue({ value, language }: { value: string; language: LanguageCode | null }) {
  return (
    <>
      {paragraphsForReading(value).map((paragraph, index) => {
        const specialNote = extractSpecialNote(paragraph);
        if (specialNote !== null) {
          return (
            <dd key={index}>
              <SpecialNote text={specialNote} language={language} />
            </dd>
          );
        }
        return (
          <dd key={index} className="prose-body mt-1">
            {paragraph}
          </dd>
        );
      })}
    </>
  );
}

export function ShrineDetails({ shrines, language }: { shrines: Shrine[]; language: LanguageCode | null }) {
  const detailed = shrines.filter(
    (s) => s.name || s.templeInformation || s.sthalaPuranam || s.azhwarPasuram
  );
  if (detailed.length === 0) return null;

  return (
    <section aria-labelledby="shrine-details-heading" className="space-y-8">
      <h2 id="shrine-details-heading" className="section-heading">
        {translateUi("shrinesHeading", language)}
      </h2>
      {detailed.map((shrine, index) => {
        const heading = shrine.name ?? shrine.label ?? shrineOrdinalLabel(language, index + 1);
        const headingId = `shrine-detail-${index}-heading`;
        const presentFields = shrine.templeInformation
          ? FIELD_ORDER.filter((key) => shrine.templeInformation?.[key])
          : [];

        return (
          <div
            key={headingId}
            className="space-y-4 border-t border-[var(--border)] pt-6 first:border-t-0 first:pt-0"
          >
            <h3 id={headingId} className="text-lg font-semibold">
              {heading}
            </h3>
            {presentFields.length > 0 ? (
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {presentFields.map((key) => (
                  <div key={key}>
                    <dt className="eyebrow">{translateUi(FIELD_LABEL_KEYS[key], language)}</dt>
                    <FieldValue value={shrine.templeInformation?.[key] ?? ""} language={language} />
                  </div>
                ))}
              </dl>
            ) : null}
            {shrine.sthalaPuranam ? <ProseBlock text={shrine.sthalaPuranam} language={language} /> : null}
            {shrine.azhwarPasuram ? <ProseBlock text={shrine.azhwarPasuram} language={language} /> : null}
          </div>
        );
      })}
    </section>
  );
}
