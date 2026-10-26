import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_NAME, getSiteOrigin, siteUrl } from "@/lib/site";

/**
 * Generic breadcrumb trail. `trail` entries are linked; `current` is the
 * page's own title, rendered as plain text with aria-current="page" (the
 * current page is never a link to itself).
 *
 * Phase 5N: rendered as a real <ol> of <li> items -- proper "structured
 * navigation" breadcrumb semantics (matching the WAI-ARIA breadcrumb
 * pattern), not a flat run of <span>s as in the original Phase 5L
 * version. `role="list"` is set explicitly because Tailwind's preflight
 * resets `list-style: none` on every <ul>/<ol> sitewide, which is known
 * to strip the implicit list semantics in Safari/VoiceOver -- the same
 * fix applied to every other list in the application this phase.
 *
 * Also emits the same trail as a schema.org BreadcrumbList, which is
 * what lets a search result show "Vedanta Yojana › Divya Desams" in
 * place of a bare URL. Only when a real origin is configured: Google
 * requires absolute item URLs, and none is fabricated otherwise.
 */
export function Breadcrumbs({
  trail,
  current,
}: {
  trail: { href: string; label: string }[];
  current: string;
}) {
  const absolute = (href: string) => siteUrl(href.endsWith("/") ? href : `${href}/`);
  const items = [{ href: "/", label: SITE_NAME }, ...trail];

  return (
    <>
      {getSiteOrigin() ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              ...items.map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: item.label,
                item: absolute(item.href),
              })),
              { "@type": "ListItem", position: items.length + 1, name: current },
            ],
          }}
        />
      ) : null}
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
        <ol role="list" className="flex flex-wrap items-center gap-1">
          {trail.map((item) => (
            <li key={item.href} className="flex items-center gap-1">
              <Link href={item.href} className="hover:underline">
                {item.label}
              </Link>
              <span aria-hidden="true">/</span>
            </li>
          ))}
          <li aria-current="page">{current}</li>
        </ol>
      </nav>
    </>
  );
}
