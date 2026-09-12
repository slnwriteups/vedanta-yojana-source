import type { Metadata } from "next";
import { loadDivyaDesams, loadKnowledgeRecord } from "@/content-lib/loader";
import { sourcePageNumber, divyaDesamNumberLabels } from "@/content-lib/ordering.ts";
import { resolveImageHref } from "@/lib/image-file";
import { LocalizedPageHeading } from "@/components/shared/LocalizedPageHeading";
import { DivyaDesamsIndexClient, type DivyaDesamIndexEntry } from "@/components/divya-desams/DivyaDesamsIndexClient";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Divya Desams",
  description: "The 108 sacred abodes of Vishnu venerated by the Alwars.",
  alternates: { canonical: siteUrl("/divya-desams") },
};

/**
 * Divya Desam index -- matches mobile's Divya Desams tab: a localized
 * title with no separate description paragraph (mobile's index screen
 * has none), the "Geographical Classification" region-filter tabs with
 * per-tab traditional counts, a localized introduction card, and a
 * photo thumbnail per row -- all previously entirely absent on web (see
 * components/divya-desams/DivyaDesamsIndexClient.tsx).
 *
 * Ordering: the schema has no explicit editorial order field, and
 * inventing one (or sorting alphabetically, which would scramble the
 * traditional pilgrimage sequence for no reason) is out of scope. This
 * uses the existing source-derived `migration.sourcePageId`
 * ("page.PageN") as the sort key -- the same source/migration
 * provenance already used to order the recovered book's chapters. See
 * content-lib/ordering.ts for the shared implementation (also used by
 * lib/sitemap.ts and the mobile app).
 *
 * Each record's first resolvable image is resolved here, server-side
 * (resolveImageHref needs node:fs), and handed down as a plain
 * `imageHref` string -- the region-tab filtering and every other
 * interactive/localized bit lives in the client component below.
 */
export default function DivyaDesamsIndexPage() {
  const records = [...loadDivyaDesams()].sort(
    (a, b) => sourcePageNumber(a.migration.sourcePageId) - sourcePageNumber(b.migration.sourcePageId)
  );
  const numberLabels = Object.fromEntries(divyaDesamNumberLabels(records.map((record) => record.slug)));

  const entries: DivyaDesamIndexEntry[] = records.map((record) => {
    let imageHref: string | null = null;
    for (const image of record.images) {
      const href = resolveImageHref(image.sourceAssetUuid);
      if (href) {
        imageHref = href;
        break;
      }
    }
    return { record, number: numberLabels[record.slug] ?? "", imageHref };
  });

  // Links to the "Introduction" record only when it actually resolves
  // through the loader -- never a fabricated link to content that
  // doesn't exist.
  const introduction = loadKnowledgeRecord("introduction");

  return (
    <div className="space-y-6">
      <LocalizedPageHeading stringKey="tabDivyaDesams" />
      <DivyaDesamsIndexClient entries={entries} numberLabels={numberLabels} introduction={introduction} />
    </div>
  );
}
