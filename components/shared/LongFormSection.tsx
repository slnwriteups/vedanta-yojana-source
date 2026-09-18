import {
  extractSpecialNote,
  isListItemLine,
  isVerseLine,
  looksLikeSubheading,
  paragraphsForReading,
} from "@/content-lib/text-format";
import { SpecialNote } from "@/components/shared/SpecialNote";
import type { LanguageCode } from "@/lib/preferences";

/**
 * Renders a long-form migrated text field as readable paragraphs, WITHOUT
 * altering the underlying text. Originally Phase 5K (Sthala Puranam /
 * Azhwar Pasuram); relocated to components/shared/ and given an optional
 * `heading` in Phase 5L so it can also render a Chapter/Knowledge body
 * directly beneath the page's own <h1> title, with no separate heading
 * invented for it. Existing callers that always pass a heading (the
 * Divya Desam detail page) are unaffected.
 *
 * The stored value is source prose, not authored markdown. Real
 * blank-line paragraph breaks are always honored first; on top of that,
 * paragraphsForReading (content-lib/text-format.ts) only adds a visual
 * break at an EXISTING sentence boundary when a block is too long to
 * read comfortably as one paragraph -- it never rewrites, trims interior
 * whitespace, truncates, or otherwise touches the text content itself.
 *
 * A paragraph block that looksLikeSubheading() (a chapter's own internal
 * section label, e.g. artha-panchakam's "Meaning:" or JAYA's embedded
 * "PART IV: ..." markers) renders bold with extra top spacing instead of
 * the plain paragraph style, mirroring mobile/components/Section.tsx --
 * still exactly the same text, just visually set apart from the
 * surrounding prose instead of reading as one undifferentiated block.
 */
export function LongFormSection({
  heading,
  headingId: explicitHeadingId,
  text,
  paragraphIdPrefix,
  language = null,
}: {
  heading?: string;
  /**
   * Overrides the auto-derived id. Needed whenever `heading` is a
   * localized (ta/kn/hi) string: deriving an id from non-Latin text via
   * the a-z0-9 slug below would strip nearly every character, so two
   * differently-headed sections could collide on the same near-empty id
   * -- pass a fixed, script-independent id (e.g. "sthala-puranam-heading")
   * in that case instead.
   */
  headingId?: string;
  text: string;
  /**
   * When set, every paragraph gets `id={`${paragraphIdPrefix}-${index}`}`
   * -- `index` is this paragraph's position in paragraphsForReading(text)'s
   * own output, the exact index getTableOfContents() (content-lib/
   * text-format.ts) uses as `paragraphIndex`. This is the web equivalent
   * of mobile's jumpToSection()/paragraphRefs+measureLayout: a chapter's
   * table-of-contents entry links straight to `#${paragraphIdPrefix}-N`
   * rather than needing any imperative scroll code.
   */
  paragraphIdPrefix?: string;
  /** Only needed for the "Special Note" callout's own label -- omitted callers (none currently have one) fall back to English. */
  language?: LanguageCode | null;
}) {
  const paragraphs = paragraphsForReading(text);
  const headingId =
    explicitHeadingId ?? (heading ? `${heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-heading` : undefined);

  return (
    <section aria-labelledby={headingId} className="max-w-2xl space-y-3">
      {heading ? (
        <h2 id={headingId} className="section-heading">
          {heading}
        </h2>
      ) : null}
      <div className="prose-body space-y-5 whitespace-pre-line">
        {paragraphs.map((paragraph, index) => {
          const specialNote = extractSpecialNote(paragraph);
          if (specialNote !== null) {
            return <SpecialNote key={index} text={specialNote} language={language} />;
          }
          const classNames = [
            (looksLikeSubheading(paragraph) && !isListItemLine(paragraph)) || isVerseLine(paragraphs, index)
              ? "mt-2 font-bold"
              : null,
            paragraphIdPrefix ? "scroll-mt-6" : null,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <p
              key={index}
              id={paragraphIdPrefix ? `${paragraphIdPrefix}-${index}` : undefined}
              className={classNames || undefined}
            >
              {paragraph}
            </p>
          );
        })}
      </div>
    </section>
  );
}
