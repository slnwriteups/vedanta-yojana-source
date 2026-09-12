import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { WelcomeGate } from "@/components/WelcomeGate";
import { OnboardingGate } from "@/components/OnboardingGate";
import { AppProviders } from "@/components/providers/AppProviders";
import { getSiteOrigin, siteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { resolveImageHref } from "@/lib/image-file";
import "./globals.css";

const WELCOME_IMAGE_UUID = "a0635841-903d-4856-90a8-eca5becb3c5e";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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
    <html lang="en">
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
      </body>
    </html>
  );
}
