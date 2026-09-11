import { loadDivyaDesams } from "@/content-lib/loader";
import { sourcePageNumber, divyaDesamNumberLabels } from "@/content-lib/ordering.ts";
import { pickSpotlightRecord } from "@/content-lib/divya-desam-spotlight.ts";
import { resolveImageHref } from "@/lib/image-file";
import { DivyaDesamSpotlight } from "@/components/divya-desams/DivyaDesamSpotlight";

/**
 * Server half of the web port of mobile/components/DivyaDesamSpotlight.tsx:
 * loads the real corpus and resolves the day's record's image (needs
 * node:fs via resolveImageHref -- server-only, see lib/image-file.ts),
 * then hands the English record + resolved data down to the client
 * component that actually localizes and renders it.
 */
export function DivyaDesamSpotlightSection() {
  const sortedRecords = [...loadDivyaDesams()].sort(
    (a, b) => sourcePageNumber(a.migration.sourcePageId) - sourcePageNumber(b.migration.sourcePageId)
  );
  const record = pickSpotlightRecord(sortedRecords);
  if (!record) return null;

  const numberLabel = divyaDesamNumberLabels(sortedRecords.map((r) => r.slug)).get(record.slug) ?? "";

  let imageHref: string | null = null;
  for (const image of record.images) {
    const href = resolveImageHref(image.sourceAssetUuid);
    if (href) {
      imageHref = href;
      break;
    }
  }

  return <DivyaDesamSpotlight record={record} numberLabel={numberLabel} imageHref={imageHref} />;
}
