/**
 * Wix has no "export all posts" button, so posts are discovered the way a
 * search engine finds them: the site's blog-posts sitemap (Wix generates
 * it automatically and lists every published post), topped up with the
 * blog RSS feed. Each post page is then fetched once and its server-
 * rendered article body, metadata (JSON-LD + Open Graph) and raw HTML are
 * kept.
 *
 * If a site blocks automated fetching, save the post pages from a browser
 * ("Save Page As -> Webpage, HTML only") into a folder and pass it with
 * --wix-html-dir: the same parser runs over those files offline.
 */
import { decodeEntities, extractElement, metaContent } from "./html.ts";
import { slugify } from "./slug.ts";
import type { ImportedPost } from "./types.ts";

export type FetchText = (url: string) => Promise<string | null>;

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/g)].map((m) => decodeEntities(m[1].trim()));
}

export function isWixPostUrl(url: string): boolean {
  try {
    return /\/post\/[^/]+\/?$/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Every blog post URL the site advertises, de-duplicated, in sitemap order. */
export async function listWixPostUrls(siteUrl: string, fetchText: FetchText): Promise<string[]> {
  const base = siteUrl.replace(/\/+$/, "");
  const found: string[] = [];

  const index = await fetchText(`${base}/sitemap.xml`);
  const sitemaps = new Set<string>();
  if (index) {
    for (const loc of locs(index)) {
      if (/blog-posts?-sitemap|blog-sitemap/i.test(loc)) sitemaps.add(loc);
      else if (isWixPostUrl(loc)) found.push(loc);
    }
  }
  if (!sitemaps.size) sitemaps.add(`${base}/blog-posts-sitemap.xml`);

  for (const sm of sitemaps) {
    const xml = await fetchText(sm);
    if (!xml) continue;
    for (const loc of locs(xml)) {
      if (isWixPostUrl(loc)) found.push(loc);
      // Large blogs paginate the sitemap (blog-posts-sitemap.xml?page=2).
      else if (/sitemap.*\.xml/i.test(loc) && !sitemaps.has(loc)) {
        const nested = await fetchText(loc);
        if (nested) found.push(...locs(nested).filter(isWixPostUrl));
      }
    }
  }

  const feed = await fetchText(`${base}/blog-feed.xml`);
  if (feed) {
    for (const m of feed.matchAll(/<link>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/link>/g)) {
      const link = decodeEntities(m[1].trim());
      if (isWixPostUrl(link)) found.push(link);
    }
  }

  return [...new Set(found.map((u) => u.replace(/\/+$/, "")))];
}

type JsonLd = Record<string, unknown>;

function jsonLdArticle(html: string): JsonLd | null {
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const queue: unknown[] = [data];
    while (queue.length) {
      const node = queue.shift();
      if (Array.isArray(node)) queue.push(...node);
      else if (node && typeof node === "object") {
        const obj = node as JsonLd;
        const type = ([] as unknown[]).concat(obj["@type"] ?? []);
        if (type.some((t) => t === "BlogPosting" || t === "Article" || t === "NewsArticle")) return obj;
        if (obj["@graph"]) queue.push(obj["@graph"]);
      }
    }
  }
  return null;
}

function str(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) return str(value[0]);
  if (value && typeof value === "object") {
    const o = value as JsonLd;
    return str(o.url ?? o.name ?? o["@id"]);
  }
  return null;
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(list);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

/** Containers Wix has used for the rendered post body, most specific first. */
const BODY_CONTAINERS = [
  /<[a-z]+[^>]*data-hook=["']post-description["'][^>]*>/i,
  /<[a-z]+[^>]*data-id=["']content-viewer["'][^>]*>/i,
  /<[a-z]+[^>]*data-hook=["']ricos-viewer["'][^>]*>/i,
  /<article(?=[\s>])[^>]*>/i,
];

export function parseWixPostPage(html: string, url: string): ImportedPost {
  const ld = jsonLdArticle(html) ?? {};
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title =
    str(ld.headline) ??
    metaContent(html, "og:title") ??
    (titleTag ? decodeEntities(titleTag).replace(/\s*[|–-][^|–-]*$/, "").trim() : null) ??
    "(untitled)";

  let body: string | null = null;
  for (const pattern of BODY_CONTAINERS) {
    body = extractElement(html, pattern);
    if (body) break;
  }
  if (!body && typeof ld.articleBody === "string") {
    body = ld.articleBody
      .split(/\n\s*\n/)
      .map((p) => `<p>${p.trim()}</p>`)
      .join("\n");
  }

  let pathSlug = "";
  try {
    pathSlug = decodeURIComponent(new URL(url).pathname.split("/post/")[1] ?? "").replace(/\/+$/, "");
  } catch {
    // fall back to the title
  }

  return {
    platform: "wix",
    sourceId: url,
    sourceUrl: url,
    title: decodeEntities(title),
    slug: slugify(pathSlug) || slugify(title) || "untitled",
    sourceStatus: "publish",
    publishedAt: str(ld.datePublished) ?? metaContent(html, "article:published_time"),
    modifiedAt: str(ld.dateModified) ?? metaContent(html, "article:modified_time"),
    author: str((ld.author as JsonLd | undefined)?.name ?? ld.author) ?? metaContent(html, "article:author"),
    categories: [...new Set(list(ld.articleSection))],
    tags: [...new Set(list(ld.keywords))],
    excerpt: metaContent(html, "og:description") ?? metaContent(html, "description"),
    coverImageUrl: metaContent(html, "og:image") ?? str(ld.image),
    html: body ?? "",
  };
}
