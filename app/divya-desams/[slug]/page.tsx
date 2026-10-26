import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadDivyaDesam, loadDivyaDesams } from "@/content-lib/loader";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { DraftBadge } from "@/components/shared/DraftBadge";
import { RecordImages } from "@/components/shared/RecordImages";
import { LocalizedDivyaDesamContent } from "@/components/divya-desams/LocalizedDivyaDesamContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata, truncateForDescription } from "@/lib/metadata";
import { getSiteOrigin, siteUrl } from "@/lib/site";
import { resolveImageHref } from "@/lib/image-file";
import { toPublicDivyaDesam, toPublicImage } from "@/lib/public-content";

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

  // "Divya Desam" and "Sthala Puranam" in the title are what people
  // actually search alongside a temple's name.
  return pageMetadata({
    title: `${record.displayName} Divya Desam: Sthala Puranam & Temple Details`,
    description: source ? truncateForDescription(source) : undefined,
    path: `/divya-desams/${record.slug}`,
    image: firstImageHref(record.images),
    type: "article",
  });
}

/** The record's own first photo that actually resolves to a file, if any. */
function firstImageHref(images: { sourceAssetUuid: string }[]): string | null {
  for (const image of images) {
    const href = resolveImageHref(image.sourceAssetUuid);
    if (href) return href;
  }
  return null;
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
  const imageHref = firstImageHref(record.images);
  const description = record.sthalaPuranam ?? record.azhwarPasuram;

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
    return href ? [{ image: toPublicImage(image), href }] : [];
  });

  return (
    <div className="space-y-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          // HinduTemple is schema.org's own Place subtype for exactly this.
          "@type": ["Place", "HinduTemple"],
          name: record.displayName,
          url: siteUrl(`/divya-desams/${record.slug}/`),
          ...(description ? { description: truncateForDescription(description) } : {}),
          ...(imageHref ? { image: `${getSiteOrigin() ?? ""}${imageHref}` } : {}),
          ...(firstMapsLink ? { hasMap: firstMapsLink } : {}),
        }}
      />
      <Breadcrumbs
        trail={[{ href: "/divya-desams", label: "Divya Desams" }]}
        current={record.displayName}
      />

      <LocalizedDivyaDesamContent
        record={toPublicDivyaDesam(record)}
        badge={<DraftBadge status={record.status} needsReview={record.migration.needsReview} />}
        topImages={<RecordImages images={topImages} />}
        resolvedAfterSthalaPuranamImages={resolvedAfterSthalaPuranamImages}
      />
    </div>
  );
}
