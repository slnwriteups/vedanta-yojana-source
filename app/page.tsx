import type { Metadata } from "next";
import { loadBooks, loadChapters } from "@/content-lib/loader";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_DESCRIPTION, SITE_NAME, getSiteOrigin, siteUrl } from "@/lib/site";
import { DivyaDesamSpotlightSection } from "@/components/divya-desams/DivyaDesamSpotlightSection";
import { HomeDashboardClient } from "@/components/home/HomeDashboardClient";
import type { HomeCatalogEntry } from "@/lib/resolve-last-read";

export const metadata: Metadata = {
  alternates: { canonical: siteUrl("/") },
};

/**
 * Home -- rebuilt to match mobile's own Home dashboard
 * (mobile/app/(tabs)/index.tsx) exactly: a time-of-day greeting, a
 * "Continue Reading" hero (or a "Get Started" pair of cards before any
 * reading position exists) using the same ui-strings.ts subtitles as
 * mobile rather than the previous static, non-localized "A reference
 * for the 108 Divya Desams..." copy, the Divya Desam spotlight, and the
 * full daily Panchangam + Sankalpam cards -- both previously missing
 * from web entirely. See components/home/HomeDashboardClient.tsx for
 * the client half (greeting/reading-position/Panchangam all need
 * client-side state) and lib/panchangam-service.ts for the data source.
 *
 * `catalog` (every book + its own chapters) is resolved here since the
 * content loader is server-only, then handed to the client dashboard as
 * plain props so it can resolve a saved reading position into real,
 * current, localized titles without needing its own loader call.
 */
export default function HomePage() {
  // The site's own URL, including any basePath -- not the bare origin,
  // which on a project-page deployment is someone else's landing page.
  const origin = getSiteOrigin() ? siteUrl("/") : undefined;

  const catalog: HomeCatalogEntry[] = loadBooks().map((book) => ({
    book,
    chapters: loadChapters(book.slug),
  }));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          description: SITE_DESCRIPTION,
          ...(origin ? { url: origin } : {}),
        }}
      />
      <HomeDashboardClient catalog={catalog} spotlight={<DivyaDesamSpotlightSection />} />
    </>
  );
}
