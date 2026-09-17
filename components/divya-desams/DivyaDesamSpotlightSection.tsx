import { loadDivyaDesams } from "@/content-lib/loader";
import { sourcePageNumber, divyaDesamNumberLabels } from "@/content-lib/ordering.ts";
import { resolveImageHref } from "@/lib/image-file";
import { toPublicDivyaDesam } from "@/lib/public-content";
import { DivyaDesamSpotlight, type SpotlightEntry } from "@/components/divya-desams/DivyaDesamSpotlight";

/**
 * Server half of the web port of mobile/components/DivyaDesamSpotlight.tsx:
 * loads the real corpus and resolves every record's image (needs
 * node:fs via resolveImageHref -- server-only, see lib/image-file.ts),
 * then hands the whole array down to the client component, which picks
 * and localizes the day's record itself.
 *
 * Deliberately does NOT call pickSpotlightRecord() here. This page is a
 * Next.js static export (see next.config.ts's `output: "export"`, no
 * per-request server) -- a server-side `new Date()` would only ever run
 * once, at build time, and every visitor would see that build day's
 * pick forever, until the next deploy. See DivyaDesamSpotlight.tsx for
 * the client-side pick that actually rotates once per calendar day for
 * every visitor, matching the mobile app's own (already client-side)
 * behavior.
 */
export function DivyaDesamSpotlightSection() {
  const sortedRecords = [...loadDivyaDesams()].sort(
    (a, b) => sourcePageNumber(a.migration.sourcePageId) - sourcePageNumber(b.migration.sourcePageId)
  );
  const numberLabels = divyaDesamNumberLabels(sortedRecords.map((r) => r.slug));

  const entries: SpotlightEntry[] = sortedRecords.map((record) => {
    let imageHref: string | null = null;
    for (const image of record.images) {
      const href = resolveImageHref(image.sourceAssetUuid);
      if (href) {
        imageHref = href;
        break;
      }
    }
    return { record: toPublicDivyaDesam(record), numberLabel: numberLabels.get(record.slug) ?? "", imageHref };
  });

  return <DivyaDesamSpotlight entries={entries} />;
}
