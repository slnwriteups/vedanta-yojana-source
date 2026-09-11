import type { Metadata } from "next";
import Link from "next/link";
import { loadDivyaDesams, loadKnowledgeRecord } from "@/content-lib/loader";
import { sourcePageNumber, divyaDesamNumberLabels } from "@/content-lib/ordering.ts";
import { DivyaDesamCard } from "@/components/divya-desams/DivyaDesamCard";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Divya Desams",
  description:
    "The 108 Divya Desams are the sacred abodes of Vishnu venerated by the Alwars.",
  alternates: { canonical: siteUrl("/divya-desams") },
};

/**
 * Phase 5K -- real, loader-driven Divya Desam index.
 *
 * Ordering: the schema has no explicit editorial order field, and
 * inventing one (or sorting alphabetically, which would scramble the
 * traditional pilgrimage sequence for no reason) is out of scope. Per
 * the Phase 5K brief section 6, this uses the existing source-derived
 * `migration.sourcePageId` ("page.PageN") as the sort key -- the same
 * source/migration provenance already used to order the recovered book's
 * chapters during the earlier full-content migration, applied here as a
 * presentation-layer sort (no content or schema change). See
 * content-lib/ordering.ts for the shared implementation (also used by
 * lib/sitemap.ts and the mobile app).
 */
export default function DivyaDesamsIndexPage() {
  const records = [...loadDivyaDesams()].sort(
    (a, b) => sourcePageNumber(a.migration.sourcePageId) - sourcePageNumber(b.migration.sourcePageId)
  );
  const numberLabels = divyaDesamNumberLabels(records.map((record) => record.slug));

  // Links to the "Introduction" record only when it actually resolves
  // through the loader -- never a fabricated link to content that
  // doesn't exist.
  const introduction = loadKnowledgeRecord("introduction");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="page-title">Divya Desams</h1>
        <p className="prose-body max-w-2xl text-[var(--muted)]">
          The 108 Divya Desams are the sacred abodes of Vishnu venerated by
          the Alwars. {records.length} records are presented below.
        </p>
      </div>

      {introduction ? (
        <Link
          href="/divya-desams/introduction"
          className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--accent)]"
        >
          <h2 className="section-heading">{introduction.title}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Start here before exploring the temples below.</p>
        </Link>
      ) : null}

      <ul role="list" className="divide-y divide-[var(--border)]">
        {records.map((record) => (
          <DivyaDesamCard key={record.slug} record={record} number={numberLabels.get(record.slug)!} />
        ))}
      </ul>
    </div>
  );
}
