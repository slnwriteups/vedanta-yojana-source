import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadDivyaDesam, loadDivyaDesams } from "@/content-lib/loader";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { DraftBadge } from "@/components/shared/DraftBadge";
import { RecordImages } from "@/components/shared/RecordImages";
import { ShrineLinks } from "@/components/divya-desams/ShrineLinks";
import { ResourceLinks } from "@/components/divya-desams/ResourceLinks";
import { LocalizedDivyaDesamContent } from "@/components/divya-desams/LocalizedDivyaDesamContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { truncateForDescription } from "@/lib/metadata";
import { siteUrl } from "@/lib/site";
import { resolveImageHref } from "@/lib/image-file";

/**
 * Phase 5K -- real, loader-driven Divya Desam detail page.
 *
 * Every section below is independently optional and renders nothing when
 * its underlying field is absent (see each component's own doc comment).
 * This is what makes the three known multi-shrine records (Page24/38/40,
 * empty templeInformation) and Page93 (no shrines, no fabricated Maps
 * link) render as intentional, complete-looking pages rather than
 * visibly broken ones -- without inventing anything to fill the gaps.
 */

/**
 * Enumerates every Divya Desam URL to pre-render. Required by
 * `output: "export"`: with no server at runtime, the complete set of
 * concrete paths must be known at build time. Sourced from the same
 * loader the page body uses, so the two cannot drift apart.
 */
export function generateStaticParams() {
  return loadDivyaDesams().map((record) => ({ slug: record.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const record = loadDivyaDesam(slug);
  if (!record) return { title: "Divya Desam" };

  // Real stored prose, mechanically truncated -- never an invented
  // description. Falls back to azhwarPasuram, then omits description
  // entirely, if sthalaPuranam is absent (e.g. the multi-shrine records).
  const source = record.sthalaPuranam ?? record.azhwarPasuram;

  return {
    title: record.displayName,
    description: source ? truncateForDescription(source) : undefined,
    alternates: { canonical: siteUrl(`/divya-desams/${record.slug}`) },
  };
}

export default async function DivyaDesamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const record = loadDivyaDesam(slug);
  if (!record) notFound();

  // "Place" is justified: a Divya Desam genuinely is a physical temple
  // location. Only `name` and (when a real shrine Maps link exists)
  // `hasMap` are included -- no fabricated postal address, geo
  // coordinates, or phone number, none of which exist in the migrated
  // data. Page93 and the multi-shrine records (empty shrines[] or
  // ambiguous shrine data) simply omit `hasMap`.
  const firstMapsLink = record.shrines[0]?.mapsLink;

  // Most images keep the source's own top-of-page position ("default").
  // A minority (per record) were placed AFTER Sthala Puranam in the
  // original source -- e.g. photos illustrating a multi-shrine legend --
  // and render there instead of in one undifferentiated cluster. See
  // each ImageEntry's `placement` field (content-lib/schemas/shared.ts)
  // for how that was determined.
  const topImages = record.images.filter((img) => img.placement !== "after-sthala-puranam");
  const afterSthalaPuranamImages = record.images.filter((img) => img.placement === "after-sthala-puranam");

  // Resolved here (server-side, needs node:fs via resolveImageHref) and
  // passed down as plain data -- SthalaPuranamWithImages renders inside
  // the client-side LocalizedDivyaDesamContent (its `text` prop must
  // react to the reader's language preference), so it can no longer do
  // this lookup itself.
  const resolvedAfterSthalaPuranamImages = afterSthalaPuranamImages.flatMap((image) => {
    const href = resolveImageHref(image.sourceAssetUuid);
    return href ? [{ image, href }] : [];
  });

  return (
    <div className="space-y-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Place",
          name: record.displayName,
          ...(firstMapsLink ? { hasMap: firstMapsLink } : {}),
        }}
      />
      <Breadcrumbs
        trail={[{ href: "/divya-desams", label: "Divya Desams" }]}
        current={record.displayName}
      />

      <LocalizedDivyaDesamContent
        record={record}
        badge={<DraftBadge status={record.status} needsReview={record.migration.needsReview} />}
        // Kept right beside Temple Information's own "How to reach" field
        // (not down with the narrative sections below) so a traveler gets
        // the travel note and the actual clickable map together, in one
        // place, before anything else.
        shrineLinks={<ShrineLinks shrines={record.shrines} />}
        topImages={<RecordImages images={topImages} />}
        resourceLinks={<ResourceLinks resources={record.resources} />}
        resolvedAfterSthalaPuranamImages={resolvedAfterSthalaPuranamImages}
      />
    </div>
  );
}
