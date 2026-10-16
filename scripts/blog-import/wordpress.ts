/**
 * Reads a WordPress eXtended RSS (WXR) export -- the XML file produced by
 * WordPress Admin -> Tools -> Export -> "All content" (self-hosted and
 * WordPress.com alike). One file contains every post, so no per-post
 * clicking is needed.
 *
 * WXR is regular enough (every item is a flat <item> with CDATA-wrapped
 * values) that a regex reader is sufficient and keeps this dependency-free.
 */
import { decodeEntities } from "./html.ts";
import { slugify } from "./slug.ts";
import type { ImportedPost } from "./types.ts";

/** Statuses worth keeping. auto-draft/inherit/trash are WordPress bookkeeping, not writing. */
const KEEP_STATUSES = new Set(["publish", "draft", "pending", "private", "future"]);

export interface WordPressOptions {
  /** Also import static Pages, not just blog Posts. */
  includePages?: boolean;
}

function field(item: string, tag: string): string | null {
  const escaped = tag.replace(/[:]/g, "\\:");
  const m = item.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>|<${escaped}(?:\\s[^>]*)?/>`));
  if (!m) return null;
  return unwrap(m[1] ?? "");
}

function unwrap(value: string): string {
  const cdata = [...value.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)];
  // A CDATA section containing "]]>" is split by exporters into several adjacent sections.
  if (cdata.length) return cdata.map((c) => c[1]).join("");
  return decodeEntities(value.trim());
}

function toIso(gmt: string | null, local: string | null): string | null {
  const usable = (v: string | null) => v && !v.startsWith("0000-00-00");
  if (usable(gmt)) return `${gmt!.replace(" ", "T")}Z`;
  if (usable(local)) return local!.replace(" ", "T");
  return null;
}

/**
 * WordPress stores post content un-paragraphed: blank lines are paragraph
 * breaks and single newlines are <br>s, applied at render time by wpautop.
 * Reproduce that so the archived HTML reads the way the live post did.
 */
export function wpautop(content: string): string {
  const text = content.replace(/\r\n?/g, "\n").trim();
  if (!text) return "";
  const blockStart = /^<(?:p|div|h[1-6]|ul|ol|li|blockquote|pre|table|figure|hr|!--)/i;
  return text
    .split(/\n\s*\n/)
    .map((chunk) => {
      const c = chunk.trim();
      if (blockStart.test(c)) return c;
      return `<p>${c.replace(/\n/g, "<br />\n")}</p>`;
    })
    .join("\n\n");
}

export function parseWxr(xml: string, options: WordPressOptions = {}): ImportedPost[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const siteUrl = field(xml.split("<item>")[0], "wp:base_blog_url");
  const attachments = new Map<string, string>();
  for (const item of items) {
    if (field(item, "wp:post_type") === "attachment") {
      const id = field(item, "wp:post_id");
      const url = field(item, "wp:attachment_url");
      if (id && url) attachments.set(id, url);
    }
  }

  const wanted = new Set(options.includePages ? ["post", "page"] : ["post"]);
  const posts: ImportedPost[] = [];
  for (const item of items) {
    const type = field(item, "wp:post_type") ?? "post";
    const status = field(item, "wp:status") ?? "publish";
    if (!wanted.has(type) || !KEEP_STATUSES.has(status)) continue;

    const id = field(item, "wp:post_id") ?? "";
    const title = decodeEntities(field(item, "title") ?? "").trim() || "(untitled)";
    const name = field(item, "wp:post_name");
    let decodedName = name ?? "";
    try {
      decodedName = decodeURIComponent(decodedName);
    } catch {
      // keep the raw value
    }

    const categories: string[] = [];
    const tags: string[] = [];
    for (const c of item.matchAll(/<category\s+([^>]*)>([\s\S]*?)<\/category>/g)) {
      const domain = c[1].match(/domain="([^"]*)"/)?.[1];
      const label = decodeEntities(unwrap(c[2])).trim();
      if (!label) continue;
      if (domain === "post_tag") tags.push(label);
      else if (domain === "category" && label !== "Uncategorized") categories.push(label);
    }

    let thumbnailId: string | null = null;
    for (const meta of item.matchAll(/<wp:postmeta>([\s\S]*?)<\/wp:postmeta>/g)) {
      if (field(meta[1], "wp:meta_key") === "_thumbnail_id") thumbnailId = field(meta[1], "wp:meta_value");
    }

    const excerpt = (field(item, "excerpt:encoded") ?? "").trim();
    posts.push({
      platform: "wordpress",
      sourceId: id,
      sourceUrl: field(item, "link"),
      title,
      slug: slugify(decodedName) || slugify(title) || `post-${id}`,
      sourceStatus: status,
      publishedAt: toIso(field(item, "wp:post_date_gmt"), field(item, "wp:post_date")),
      modifiedAt: toIso(field(item, "wp:post_modified_gmt"), field(item, "wp:post_modified")),
      author: field(item, "dc:creator"),
      categories: [...new Set(categories)],
      tags: [...new Set(tags)],
      excerpt: excerpt || null,
      coverImageUrl: thumbnailId ? attachments.get(thumbnailId) ?? null : null,
      siteUrl,
      html: wpautop(field(item, "content:encoded") ?? ""),
    });
  }
  return posts;
}
