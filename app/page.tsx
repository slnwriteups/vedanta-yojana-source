import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_DESCRIPTION, SITE_NAME, getSiteOrigin, siteUrl } from "@/lib/site";
import { DivyaDesamSpotlightSection } from "@/components/divya-desams/DivyaDesamSpotlightSection";

export const metadata: Metadata = {
  alternates: { canonical: siteUrl("/") },
};

/**
 * Home page -- Phase 5J core shell.
 *
 * Replaces the Phase 5B route-placeholder list. Copy is intentionally
 * generic and non-editorial: it restates the site's already-established
 * scope (the 108 Divya Desams + a recovered library), not any specific
 * temple/chapter content pulled from the source extraction.
 *
 * The generic "Knowledge" section (previously a third tile here) was
 * retired: its one real record, "An Introduction to the 108
 * Divyadesams," was moved to live under /divya-desams/introduction
 * instead, since its own content explicitly serves that section rather
 * than a general-purpose category.
 */

const SECTIONS = [
  {
    href: "/divya-desams",
    title: "Divya Desams",
    description:
      "The 108 sacred abodes of Vishnu venerated by the Alwars, presented one temple at a time.",
  },
  {
    href: "/library",
    title: "Library",
    description:
      "A recovered book, presented chapter by chapter as it is prepared for publication.",
  },
];

export default function HomePage() {
  // The site's own URL, including any basePath -- not the bare origin,
  // which on a project-page deployment is someone else's landing page.
  const origin = getSiteOrigin() ? siteUrl("/") : undefined;

  return (
    <div className="space-y-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          description: SITE_DESCRIPTION,
          ...(origin ? { url: origin } : {}),
        }}
      />
      <div className="space-y-4">
        <h1 className="page-title">Vedanta Yojana</h1>
        <p className="prose-body max-w-2xl text-[var(--muted)]">
          A reference for the 108 Divya Desams and related Vaishnava
          teachings. The Divya Desams are complete; the Library is still
          being prepared for publication.
        </p>
      </div>

      <DivyaDesamSpotlightSection />

      <div className="grid gap-6 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--accent)]"
          >
            <h2 className="section-heading">{section.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
