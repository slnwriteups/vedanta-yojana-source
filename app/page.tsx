import type { Metadata } from "next";
import { loadBooks, loadChapters } from "@/content-lib/loader";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_DESCRIPTION, SITE_HOME_TITLE, SITE_NAME, SITE_PROFILES, getSiteOrigin, siteUrl } from "@/lib/site";
import { pageMetadata } from "@/lib/metadata";
import { DivyaDesamSpotlightSection } from "@/components/divya-desams/DivyaDesamSpotlightSection";
import { HomeDashboardClient } from "@/components/home/HomeDashboardClient";
import { toPublicBook } from "@/lib/public-content";
import { toHomeChapterSummary, type HomeCatalogEntry } from "@/lib/resolve-last-read";

export const metadata: Metadata = {
  ...pageMetadata({ description: SITE_DESCRIPTION, path: "/" }),
  title: { absolute: SITE_HOME_TITLE },
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
    book: toPublicBook(book),
    chapters: loadChapters(book.slug).map(toHomeChapterSummary),
  }));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          description: SITE_DESCRIPTION,
          inLanguage: "en",
          ...(origin ? { url: origin } : {}),
        }}
      />
      {origin ? (
        // Who publishes the site -- the entity a search engine attaches
        // the logo and the social profiles to.
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: SITE_NAME,
            url: origin,
            logo: siteUrl("/icon.png"),
            sameAs: SITE_PROFILES,
          }}
        />
      ) : null}
      <HomeDashboardClient catalog={catalog} spotlight={<DivyaDesamSpotlightSection />} />
    </>
  );
}
