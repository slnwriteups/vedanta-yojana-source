import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadKnowledgeRecord } from "@/content-lib/loader";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { DraftBadge } from "@/components/shared/DraftBadge";
import { RecordImages } from "@/components/shared/RecordImages";
import { LocalizedKnowledgeContent } from "@/components/knowledge/LocalizedKnowledgeContent";
import { RelatedContentLinks } from "@/components/knowledge/RelatedContentLinks";
import { JsonLd } from "@/components/seo/JsonLd";
import { truncateForDescription } from "@/lib/metadata";
import { siteUrl } from "@/lib/site";
import { toPublicKnowledge } from "@/lib/public-content";

/**
 * The sole Knowledge record (an introduction to the 108 Divyadesams)
 * moved here from the (now-removed) generic /knowledge
 * section, at the user's request -- its own content explicitly serves
 * as an introduction to the Divya Desams, so it belongs there rather
 * than in an unrelated general-purpose section. This is a routing
 * change only: the record itself is untouched (still schema-validated
 * as Knowledge, still loaded via the same loadKnowledgeRecord()), only
 * where it's reachable from has changed. A static route co-located with
 * the dynamic [slug] route -- Next.js resolves the exact "introduction"
 * path here rather than treating it as a Divya Desam slug, so this
 * never collides with a real (or future) temple named "introduction".
 */

const INTRODUCTION_SLUG = "introduction";

export async function generateMetadata(): Promise<Metadata> {
  const record = loadKnowledgeRecord(INTRODUCTION_SLUG);
  if (!record) return { title: "Divya Desams" };

  return {
    title: record.title,
    description: truncateForDescription(record.body),
    alternates: { canonical: siteUrl("/divya-desams/introduction") },
  };
}

export default function DivyaDesamsIntroductionPage() {
  const record = loadKnowledgeRecord(INTRODUCTION_SLUG);
  if (!record) notFound();

  return (
    <div className="space-y-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: record.title,
        }}
      />
      <Breadcrumbs
        trail={[{ href: "/divya-desams", label: "Divya Desams" }]}
        current={record.title}
      />

      <LocalizedKnowledgeContent
        record={toPublicKnowledge(record)}
        badge={<DraftBadge status={record.status} needsReview={record.migration.needsReview} />}
        images={<RecordImages images={record.images} />}
      />

      <RelatedContentLinks items={record.relatedContent} />
    </div>
  );
}
