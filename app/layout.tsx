import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/SiteHeader";
import { WelcomeGate } from "@/components/WelcomeGate";
import { OnboardingGate } from "@/components/OnboardingGate";
import { AppProviders } from "@/components/providers/AppProviders";
import { SitePing } from "@/components/SitePing";
import { ServiceWorkerRegistration } from "@/components/shared/ServiceWorkerRegistration";
import { getSiteOrigin, siteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { defaultShareImage } from "@/lib/metadata";
import { resolveImageHref } from "@/lib/image-file";
import "./globals.css";

const WELCOME_IMAGE_UUID = "a0635841-903d-4856-90a8-eca5becb3c5e";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Cloudflare Web Analytics site token. Supplied by the deployment
 * (deploy-pages.yml reads it from a repository *variable*, not a
 * secret) and empty everywhere it is not configured -- `next dev`, the
 * test suite, and any fork's build, none of which should be reporting
 * page views into this project's account.
 *
 * Empty means the beacon is not rendered at all, rather than rendered
 * with a placeholder token: a tag that loads a third-party script and
 * then fails is strictly worse than no tag. This is why it is read as a
 * plain value here and guarded at the render site below.
 *
 * The token is not a credential -- it is public by design, visible in
 * the HTML of every page, and grants nothing except the ability to
 * report page views into this site's own bucket. It is a repository
 * variable rather than a secret for exactly that reason; treating it as
 * a secret would imply a confidentiality it does not have.
 *
 * What this measures and why it is compatible with this project's
 * privacy commitments: Cloudflare Web Analytics is cookieless, sets no
 * client-side state, uses no cross-site identifier, and reports only
 * aggregate page views with a country-level breakdown. It covers the
 * WEBSITE only. The mobile app contains no analytics of any kind and
 * this token is not present in it -- see docs/privacy-policy.html and
 * docs/ANALYTICS.md, both of which state that split explicitly.
 */
const CF_WEB_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ?? "";

/**
 * A real Devanagari-shaping-capable font (correct conjuncts, matra
 * reordering, reph, etc.), self-hosted at build time -- no runtime
 * request to Google's CDN, and no layout-shift-prone external
 * stylesheet. This was never actually a font problem before now (the
 * Sanskrit quoted in the JAYA book had literally missing conjunct
 * characters, a data-extraction bug, fixed at the content level) --
 * but the browser's default UI font otherwise has no Devanagari glyphs
 * at all, so without an explicit fallback the OS's own substitute font
 * varied in quality/style across browsers. Exposed as a CSS variable
 * (`--font-devanagari`) and layered in globals.css's `body` font stack
 * as a fallback -- Latin/IAST text keeps using the primary UI font;
 * only Devanagari-range characters (Hindi UI copy, or a quoted Sanskrit
 * shloka in any language) fall through to this font.
 */
const notoSansDevanagari = localFont({
  src: [{ path: "./fonts/noto-sans-devanagari.woff2", weight: "400" }, { path: "./fonts/noto-sans-devanagari.woff2", weight: "600" }, { path: "./fonts/noto-sans-devanagari.woff2", weight: "700" }],
  variable: "--font-devanagari",
  display: "swap",
  adjustFontFallback: "Arial",
  declarations: [{ prop: "unicode-range", value: "U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A" }],
});

/**
 * The reading face: long-form text (chapters, Sthala Puranam, Knowledge)
 * is set in Noto Serif, matching the app's serif reader
 * (mobile/theme.ts's readingFontFamily), with the Noto Serif face for
 * each Indic script the content is translated into. Stored in
 * app/fonts/ like the Devanagari UI font above (see its README for the
 * sources); each is limited by unicode-range, so a browser only
 * downloads the scripts a page actually contains. Only the Latin face
 * is preloaded -- it is the one every reading page uses.
 * Applied through globals.css's `.reading-text`, never to the UI.
 */
const notoSerif = localFont({
  src: [{ path: "./fonts/noto-serif-latin.woff2", weight: "400" }, { path: "./fonts/noto-serif-latin.woff2", weight: "700" }],
  variable: "--font-reading-latin",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF, U+0302-0303, U+0305, U+0307-0308, U+0310, U+0312, U+0315, U+031A, U+0326-0327, U+032C, U+032F-0330, U+0332-0333, U+0338, U+033A, U+0346, U+034D, U+0391-03A1, U+03A3-03A9, U+03B1-03C9, U+03D1, U+03D5-03D6, U+03F0-03F1, U+03F4-03F5, U+2016-2017, U+2034-2038, U+203C, U+2040, U+2043, U+2047, U+2050, U+2057, U+205F, U+2070-2071, U+2074-209F, U+20D0-20DC, U+20E1, U+20E5-20EF, U+2100-2112, U+2114-2115, U+2117-2121, U+2123-214F, U+2190, U+2192, U+2194-21AE, U+21B0-21E5, U+21F1-21F2, U+21F4-2211, U+2213-2214, U+2216-22FF, U+2308-230B, U+2310, U+2319, U+231C-2321, U+2336-237A, U+237C, U+2395, U+239B-23B7, U+23D0, U+23DC-23E1, U+2474-2475, U+25AF, U+25B3, U+25B7, U+25BD, U+25C1, U+25CA, U+25CC, U+25FB, U+266D-266F, U+27C0-27FF, U+2900-2AFF, U+2B0E-2B11, U+2B30-2B4C, U+2BFE, U+3030, U+FF5B, U+FF5D, U+1D400-1D7FF, U+1EE00-1EEFF" }],
});
const notoSerifTamil = localFont({
  src: [{ path: "./fonts/noto-serif-tamil.woff2", weight: "400" }, { path: "./fonts/noto-serif-tamil.woff2", weight: "700" }],
  variable: "--font-reading-tamil",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  declarations: [{ prop: "unicode-range", value: "U+0964-0965, U+0B82-0BFA, U+200C-200D, U+20B9, U+25CC" }],
});
const notoSerifKannada = localFont({
  src: [{ path: "./fonts/noto-serif-kannada.woff2", weight: "400" }, { path: "./fonts/noto-serif-kannada.woff2", weight: "700" }],
  variable: "--font-reading-kannada",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  declarations: [{ prop: "unicode-range", value: "U+0951-0952, U+0964-0965, U+0B83, U+0C80-0CF3, U+1CD0, U+1CD2-1CD3, U+1CDA, U+1CF2, U+1CF4, U+200C-200D, U+20B9, U+25CC, U+A830-A835" }],
});
const notoSerifTelugu = localFont({
  src: [{ path: "./fonts/noto-serif-telugu.woff2", weight: "400" }, { path: "./fonts/noto-serif-telugu.woff2", weight: "700" }],
  variable: "--font-reading-telugu",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  declarations: [{ prop: "unicode-range", value: "U+0951-0952, U+0964-0965, U+0B83, U+0C00-0C7F, U+1CD5-1CD6, U+1CD8, U+1CDA, U+1CF2, U+200C-200D, U+25CC" }],
});
const notoSerifDevanagari = localFont({
  src: [{ path: "./fonts/noto-serif-devanagari.woff2", weight: "400" }, { path: "./fonts/noto-serif-devanagari.woff2", weight: "700" }],
  variable: "--font-reading-devanagari",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  declarations: [{ prop: "unicode-range", value: "U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A" }],
});
const readingFontVariables = [notoSerif, notoSerifTamil, notoSerifKannada, notoSerifTelugu, notoSerifDevanagari]
  .map((font) => font.variable)
  .join(" ");

const siteOrigin = getSiteOrigin();

/**
 * Search-engine ownership tokens (Google Search Console's "HTML tag"
 * method and Bing Webmaster Tools'), supplied by the deployment from
 * repository variables -- see deploy-pages.yml and docs/SEO.md. Like the
 * analytics token above they are public by design (they sit in every
 * page's HTML) and prove nothing on their own; unset simply means the
 * tag is not rendered, which is the right state for forks and local
 * builds.
 */
const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "";
const BING_SITE_VERIFICATION = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? "";

export const metadata: Metadata = {
  // Only set when a real deployment origin has been configured (see
  // lib/site.ts) -- omitted entirely otherwise, rather than fabricating
  // a production domain. With no metadataBase, Next.js resolves
  // relative URLs as-is instead of into absolute URLs; that is an
  // accepted, documented limitation of not yet having a deployment
  // target, not an oversight.
  //
  // Built via siteUrl so it carries the basePath. Each page's
  // `alternates.canonical` is already fully resolved through siteUrl
  // too, so metadataBase never has to re-resolve one -- which matters,
  // because resolving an absolute path against a base discards the
  // base's own path segment.
  ...(siteOrigin ? { metadataBase: new URL(siteUrl("/")) } : {}),
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  // Sitewide default: indexable. The application's content is
  // universally status="draft" (an editorial workflow state), which
  // must NOT be read as "hide from search engines" -- that would be an
  // invented indexing policy, not one this project has actually stated.
  // Routes that genuinely shouldn't be indexed (the 404 boundary,
  // parameterized search-result URLs) override this individually.
  robots: {
    index: true,
    follow: true,
    // Allow large image previews and full-length snippets in results --
    // the defaults are more conservative than this site needs.
    "max-image-preview": "large",
    "max-snippet": -1,
  },
  // Link-preview defaults for routes that don't build their own via
  // pageMetadata() (lib/metadata.ts).
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [defaultShareImage()],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [defaultShareImage().url],
  },
  ...(GOOGLE_SITE_VERIFICATION || BING_SITE_VERIFICATION
    ? {
        verification: {
          ...(GOOGLE_SITE_VERIFICATION ? { google: GOOGLE_SITE_VERIFICATION } : {}),
          ...(BING_SITE_VERIFICATION ? { other: { "msvalidate.01": BING_SITE_VERIFICATION } } : {}),
        },
      }
    : {}),
};

// Theme-color matches the exact light/dark --background tokens already
// defined in app/globals.css -- not a new color decision, just exposing
// the existing palette to the browser's own chrome (address bar, etc.)
// via the Next.js-supported Viewport export.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1712" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${notoSansDevanagari.variable} ${readingFontVariables}`}>
      <body className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] antialiased">
        <AppProviders>
          {/*
            Page views and visits by country and approximate city, source,
            page and language
            Inside AppProviders so it can
            read the reader's language; reports only from the production
            host -- see components/SitePing.tsx.
          */}
          <SitePing />
          {/* Offline Pasurams that follow Prapatti.com's corrections, same as the app -- see public/sw.js. */}
          <ServiceWorkerRegistration />
          <WelcomeGate imageHref={resolveImageHref(WELCOME_IMAGE_UUID)} audioHref={`${BASE_PATH}/audio/vy-welcome.mp3`}>
            <OnboardingGate>
              <a href="#main-content" className="skip-link">
                Skip to content
              </a>
              <SiteHeader />
              <main id="main-content" className="site-container flex-1 py-10 sm:py-12">
                {children}
              </main>
            </OnboardingGate>
          </WelcomeGate>
        </AppProviders>
        {/*
          Rendered last, deferred, and omitted entirely when
          unconfigured -- the beacon must never be able to delay or
          break the page it is measuring. `data-cf-beacon` is built with
          JSON.stringify rather than a hand-written string so the token
          cannot produce malformed JSON in the attribute.
        */}
        {CF_WEB_ANALYTICS_TOKEN ? (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: CF_WEB_ANALYTICS_TOKEN })}
          />
        ) : null}
      </body>
    </html>
  );
}
