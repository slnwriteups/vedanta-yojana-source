/**
 * Traditional 1-108 Divya Desam numbering, derived positionally from a
 * slug list already sorted by each record's own `sourceOrder`
 * (content-lib/mobile-content.ts -- derived once at manifest-generation
 * time from the internal migration.sourcePageId this app must not ship,
 * the same "page.PageN" parse this file used to do itself at render
 * time via a now-removed sourcePageNumber()) -- not a schema field (see
 * the "no explicit editorial order field" note on the web index page
 * this mirrors).
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
