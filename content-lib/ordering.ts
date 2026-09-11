/**
 * Source-page ordering -- the shared implementation, consumed by both
 * runtimes (app/divya-desams/page.tsx and
 * mobile/app/(tabs)/divya-desams/index.tsx) so the Divya Desam index
 * presents temples in the same traditional pilgrimage sequence,
 * everywhere, not alphabetically or by insertion order.
 *
 * lib/sitemap.ts deliberately keeps its own local variant rather than
 * importing this one: it swallows a non-matching sourcePageId into
 * Number.MAX_SAFE_INTEGER (sort it last) instead of throwing, so a
 * single malformed record can never take down sitemap generation --
 * a page render, by contrast, should fail loudly on the same input.
 */
export function sourcePageNumber(sourcePageId: string): number {
  const match = sourcePageId.match(/^page\.Page(\d+)$/);
  if (!match) {
    throw new Error(
      `Cannot derive a source-ordered position: sourcePageId "${sourcePageId}" does not match the expected "page.PageN" shape.`
    );
  }
  return parseInt(match[1], 10);
}

/**
 * Traditional 1-108 Divya Desam numbering, derived positionally from a
 * slug list already sorted by sourcePageNumber() -- not a schema field
 * (see the "no explicit editorial order field" note on the web index
 * page this mirrors).
 *
 * The corpus has exactly one exception: "Tiruttetriambalam
 * Tirumanikoodam" is a single content record combining what the source
 * book numbers as two separate Divya Desams (#36 and #37 -- confirmed
 * against its own "108-36"/"108-37" image assets), so that one record
 * displays as "36-37" and the running count advances by two only there.
 * Every other record advances by one.
 */
const MERGED_DIVYA_DESAM_SLUG = "tiruttetriambalam-tirumanikoodam";

export function divyaDesamNumberLabels(sortedSlugs: string[]): Map<string, string> {
  const labels = new Map<string, string>();
  let next = 1;
  for (const slug of sortedSlugs) {
    if (slug === MERGED_DIVYA_DESAM_SLUG) {
      labels.set(slug, `${next}-${next + 1}`);
      next += 2;
    } else {
      labels.set(slug, String(next));
      next += 1;
    }
  }
  return labels;
}
