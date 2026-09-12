import type { Metadata } from "next";
import { SearchClient } from "@/components/search/SearchClient";
import { LocalizedPageHeading } from "@/components/shared/LocalizedPageHeading";
import { siteUrl } from "@/lib/site";

/**
 * Phase 5N's canonical rule is unchanged: the canonical for every
 * /search?q=... variant is the bare /search page. Search results are not
 * given their own indexed page per arbitrary query (an infinite,
 * low-value URL space).
 *
 * What changed in the GitHub Pages migration is that this can no longer
 * be decided per request. `output: "export"` pre-renders exactly one
 * /search document, so the previous searchParams-driven generateMetadata
 * (index when bare, noindex when queried) is not expressible -- there is
 * no server to vary the response. The single emitted page is the bare
 * one, so it is indexable, and the query variants a crawler might reach
 * are the same URL with a fragment of state applied client-side.
 */
export const metadata: Metadata = {
  title: "Search",
  alternates: { canonical: siteUrl("/search") },
  robots: { index: true, follow: true },
};

/**
 * A static shell -- a localized title (matching mobile's Search tab, no
 * separate description paragraph, mirroring the same Library/Divya
 * Desams convention) plus the client search experience. The query is
 * read, and results are computed, in the browser -- see
 * components/search/SearchClient.tsx for why.
 */
export default function SearchPage() {
  return (
    <div className="space-y-8">
      <LocalizedPageHeading stringKey="tabSearch" />
      <SearchClient />
    </div>
  );
}
