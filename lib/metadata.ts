import type { Metadata } from "next";
import { SITE_NAME, getSiteOrigin, siteUrl } from "./site.ts";

const DEFAULT_MAX_LENGTH = 155;

/**
 * A plain length-based truncation of REAL stored content for use as a
 * meta description -- not a rewrite, not a summary, not fabricated
 * boilerplate. Collapses whitespace, cuts at a word boundary where
 * possible, and appends an ellipsis only when the text was actually
 * truncated. The same kind of "real text, mechanically shortened"
 * treatment already established for search excerpts
 * (content-lib/search/excerpt.ts), applied here to metadata instead.
 */
export function truncateForDescription(text: string, maxLength: number = DEFAULT_MAX_LENGTH): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;

  const cut = collapsed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const safeCut = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${safeCut}…`;
}

/** The sitewide social-share card (public/og-image.png, 1200x630). */
export function defaultShareImage() {
  return { url: siteUrl("/og-image.png"), width: 1200, height: 630 };
}

/**
 * One page's title/description/canonical plus the Open Graph and Twitter
 * card fields link previews (WhatsApp, X, Facebook, Slack...) read.
 *
 * Next.js merges metadata shallowly: a page that sets `openGraph` at all
 * replaces the layout's whole `openGraph` object rather than extending
 * it, so every page builds the complete set here instead of relying on
 * the layout's defaults. `title` is the page's own title; social cards
 * don't get the layout's "%s — Vedanta Yojana" template, so it is
 * applied here by hand.
 *
 * `image` is a record's own photo as resolveImageHref returns it -- already
 * basePath-prefixed, so only the origin is added here (resolving it
 * against metadataBase would double the basePath). Pages without one
 * share the sitewide card.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
}: {
  title?: string;
  description?: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
}): Metadata {
  const socialTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  const images = image ? [{ url: `${getSiteOrigin() ?? ""}${image}` }] : [defaultShareImage()];
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    alternates: { canonical: siteUrl(path) },
    openGraph: {
      type,
      siteName: SITE_NAME,
      title: socialTitle,
      ...(description ? { description } : {}),
      url: siteUrl(path),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      ...(description ? { description } : {}),
      images: images.map((i) => i.url),
    },
  };
}
