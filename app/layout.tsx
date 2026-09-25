import type { Metadata, Viewport } from "next";
import { Noto_Sans_Devanagari } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { WelcomeGate } from "@/components/WelcomeGate";
import { OnboardingGate } from "@/components/OnboardingGate";
import { AppProviders } from "@/components/providers/AppProviders";
import { SitePing } from "@/components/SitePing";
import { getSiteOrigin, siteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
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
const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
});

const siteOrigin = getSiteOrigin();

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
  },
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
    <html lang="en" className={notoSansDevanagari.variable}>
      <body className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] antialiased">
        <AppProviders>
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
        {/*
          Page views and visits by country and approximate city, for the
          private dashboard (cloudflare/analytics-dashboard/). Reports
          only from the production host; see components/SitePing.tsx.
        */}
        <SitePing />
      </body>
    </html>
  );
}
