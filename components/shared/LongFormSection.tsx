import {
  extractSpecialNote,
  isListItemLine,
  isVerseLine,
  looksLikeSubheading,
  paragraphsForReading,
  specialNoteListItemSpan,
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
  language = null,
  renderAfter,
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
  /** Only needed for the "Special Note" callout's own label -- omitted callers (none currently have one) fall back to English. */
  language?: LanguageCode | null;
  /** Anything to draw directly after block `index` (paragraphsForReading(text)'s own indexes) -- a chapter's inline images. */
  renderAfter?: (index: number) => React.ReactNode;
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
        {(() => {
          const nodes: React.ReactNode[] = [];
          for (let index = 0; index < paragraphs.length; index++) {
            const paragraph = paragraphs[index];
            const specialNote = extractSpecialNote(paragraph);
            if (specialNote !== null) {
              const span = specialNoteListItemSpan(paragraphs, index);
              const items = paragraphs.slice(index + 1, index + 1 + span);
              nodes.push(<SpecialNote key={index} text={specialNote} items={items} language={language} />);
              for (let covered = index; covered <= index + span; covered++) {
                const after = renderAfter?.(covered);
                if (after) nodes.push(after);
              }
              index += span;
              continue;
            }
            const classNames = [
              (looksLikeSubheading(paragraph) && !isListItemLine(paragraph)) || isVerseLine(paragraphs, index, text)
                ? "mt-2 font-bold"
                : null,
            ]
              .filter(Boolean)
              .join(" ");
            nodes.push(
              <p
                key={index}
                className={classNames || undefined}
              >
                {paragraph}
              </p>
            );
            const after = renderAfter?.(index);
            if (after) nodes.push(after);
          }
          return nodes;
        })()}
      </div>
    </section>
  );
}
