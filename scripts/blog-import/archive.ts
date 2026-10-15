/**
 * Writes imported posts into blog-archive/ -- one folder per post with
 * the original HTML (never modified), a readable Markdown copy, the
 * post's images, and a post.json metadata record -- then rebuilds the
 * archive-wide index.json and INDEX.md checklist.
 *
 * Re-running an import is safe: a post is matched to its existing folder
 * by platform + source ID, its files are refreshed, and its
 * migration.status / migration.notes (the hand-maintained progress of
 * moving it into the app) are preserved.
 */
import fs from "node:fs";
import path from "node:path";
import { htmlToMarkdown, markdownImageUrls } from "./html.ts";
import { duplicateKey, slugify } from "./slug.ts";
import type { ArchivedImage, ArchivedPost, ImportedPost } from "./types.ts";

export type FetchBinary = (url: string) => Promise<{ bytes: Uint8Array; contentType: string | null } | null>;

export interface ArchiveOptions {
  root: string;
  /** Omit to keep image URLs remote instead of downloading them. */
  fetchBinary?: FetchBinary;
  log?: (msg: string) => void;
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp", "tif", "tiff"]);
const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
  "image/avif": "avif", "image/svg+xml": "svg",
};

/** Larger/original versions of a resized image URL to try first, then the URL itself. */
export function fullSizeCandidates(url: string): string[] {
  const out: string[] = [];
  const wix = url.match(/^(https?:\/\/static\.wixstatic\.com\/media\/[^/]+)\/v1\//);
  if (wix) out.push(wix[1]);
  const wpResized = url.match(/^(.*)-\d+x\d+(\.[a-z0-9]+)(\?.*)?$/i);
  if (wpResized) out.push(wpResized[1] + wpResized[2]);
  if (/[?&](w|h|resize|fit)=/.test(url) && /wp\.com|wordpress\.com/.test(url)) out.push(url.split("?")[0]);
  out.push(url);
  return [...new Set(out)];
}

function imageFileName(url: string, index: number, contentType: string | null): string {
  let base = "image";
  let ext = "";
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "");
    const dot = last.lastIndexOf(".");
    if (dot > 0) {
      const candidate = last.slice(dot + 1).toLowerCase();
      if (IMAGE_EXTENSIONS.has(candidate)) ext = candidate === "jpeg" ? "jpg" : candidate;
      base = last.slice(0, dot);
    } else if (last) base = last;
  } catch {
    // keep defaults
  }
  if (!ext) ext = CONTENT_TYPE_EXT[contentType?.split(";")[0].trim() ?? ""] ?? "img";
  return `${String(index + 1).padStart(2, "0")}-${slugify(base).slice(0, 40).replace(/-+$/, "") || "image"}.${ext}`;
}

function wordCount(markdown: string): number {
  const text = markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\]\([^)]*\)/g, "]");
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []).length;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function frontMatter(post: ArchivedPost): string {
  const lines = [
    "---",
    `title: ${yamlString(post.title)}`,
    `platform: ${post.platform}`,
    post.sourceUrl ? `source: ${yamlString(post.sourceUrl)}` : null,
    post.publishedAt ? `published: ${yamlString(post.publishedAt)}` : null,
    post.categories.length ? `categories: ${JSON.stringify(post.categories)}` : null,
    post.tags.length ? `tags: ${JSON.stringify(post.tags)}` : null,
    "---",
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/** Maps every existing post folder in the archive by "platform:sourceId". */
function existingFolders(root: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const platform of ["wordpress", "wix"]) {
    const dir = path.join(root, platform);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const meta = readJson<ArchivedPost>(path.join(dir, name, "post.json"));
      if (meta) map.set(`${meta.platform}:${meta.sourceId}`, path.join(dir, name));
    }
  }
  return map;
}

export async function archivePosts(posts: ImportedPost[], options: ArchiveOptions): Promise<ArchivedPost[]> {
  const { root, fetchBinary, log = () => {} } = options;
  const folders = existingFolders(root);
  const claimed = new Set(folders.values());
  const results: ArchivedPost[] = [];

  for (const post of posts) {
    const key = `${post.platform}:${post.sourceId}`;
    let dir = folders.get(key);
    if (!dir) {
      const date = post.publishedAt?.slice(0, 10).match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? "undated";
      const stem = path.join(root, post.platform, `${date}-${post.slug}`);
      dir = stem;
      for (let n = 2; claimed.has(dir) || fs.existsSync(dir); n++) dir = `${stem}-${n}`;
      claimed.add(dir);
    }
    fs.mkdirSync(dir, { recursive: true });
    const previous = readJson<ArchivedPost>(path.join(dir, "post.json"));

    let markdown = htmlToMarkdown(post.html);
    const urls = [...new Set([...(post.coverImageUrl ? [post.coverImageUrl] : []), ...markdownImageUrls(markdown)])];
    const images: ArchivedImage[] = [];
    for (const [i, url] of urls.entries()) {
      const image = fetchBinary ? await downloadImage(url, i, dir, fetchBinary, previous) : { originalUrl: url, file: null };
      if (image.error) log(`  ! image ${url}: ${image.error}`);
      images.push(image);
    }
    for (const image of images) {
      if (image.file) markdown = markdown.split(`](${image.originalUrl})`).join(`](${image.file})`);
    }

    const archived: ArchivedPost = {
      platform: post.platform,
      sourceId: post.sourceId,
      sourceUrl: post.sourceUrl,
      title: post.title,
      slug: post.slug,
      sourceStatus: post.sourceStatus,
      publishedAt: post.publishedAt,
      modifiedAt: post.modifiedAt,
      author: post.author,
      categories: post.categories,
      tags: post.tags,
      excerpt: post.excerpt,
      coverImage: post.coverImageUrl ? images.find((im) => im.originalUrl === post.coverImageUrl) ?? null : null,
      images,
      wordCount: wordCount(markdown),
      files: { markdown: "post.md", html: "original.html" },
      migration: previous?.migration ?? { status: "archived", notes: "" },
    };

    fs.writeFileSync(path.join(dir, "original.html"), post.html.endsWith("\n") ? post.html : `${post.html}\n`);
    fs.writeFileSync(path.join(dir, "post.md"), `${frontMatter(archived)}\n\n# ${post.title}\n\n${markdown}\n`);
    fs.writeFileSync(path.join(dir, "post.json"), `${JSON.stringify(archived, null, 2)}\n`);
    if (!post.html.trim()) log(`  ! no body found for "${post.title}" -- see ${path.relative(root, dir)}`);
    results.push(archived);
  }
  return results;
}

async function downloadImage(
  url: string,
  index: number,
  dir: string,
  fetchBinary: FetchBinary,
  previous: ArchivedPost | null
): Promise<ArchivedImage> {
  const already = previous?.images.find((im) => im.originalUrl === url && im.file);
  if (already?.file && fs.existsSync(path.join(dir, already.file))) return already;
  let absolute: string;
  try {
    absolute = new URL(url).href;
  } catch {
    return { originalUrl: url, file: null, error: "not an absolute URL" };
  }
  for (const candidate of fullSizeCandidates(absolute)) {
    const res = await fetchBinary(candidate);
    if (!res || res.bytes.length === 0) continue;
    const file = `images/${imageFileName(absolute, index, res.contentType)}`;
    fs.mkdirSync(path.join(dir, "images"), { recursive: true });
    fs.writeFileSync(path.join(dir, file), res.bytes);
    return { originalUrl: url, file };
  }
  return { originalUrl: url, file: null, error: "download failed" };
}

export interface ArchiveIndexEntry {
  folder: string;
  platform: string;
  title: string;
  publishedAt: string | null;
  sourceStatus: string;
  wordCount: number;
  imageCount: number;
  migrationStatus: string;
  /** Folders of posts on the other platform with the same title -- likely the same post, moved. */
  possibleDuplicates: string[];
}

/** Rebuilds blog-archive/index.json and INDEX.md from every post.json present. */
export function rebuildIndex(root: string): ArchiveIndexEntry[] {
  const entries: (ArchiveIndexEntry & { key: string })[] = [];
  for (const platform of ["wordpress", "wix"]) {
    const dir = path.join(root, platform);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      const meta = readJson<ArchivedPost>(path.join(dir, name, "post.json"));
      if (!meta) continue;
      entries.push({
        key: duplicateKey(meta.title),
        folder: `${platform}/${name}`,
        platform,
        title: meta.title,
        publishedAt: meta.publishedAt,
        sourceStatus: meta.sourceStatus,
        wordCount: meta.wordCount,
        imageCount: meta.images.length,
        migrationStatus: meta.migration.status,
        possibleDuplicates: [],
      });
    }
  }
  for (const e of entries) {
    e.possibleDuplicates = entries
      .filter((o) => o !== e && o.key && o.key === e.key && o.platform !== e.platform)
      .map((o) => o.folder);
  }
  entries.sort((a, b) => (a.publishedAt ?? "9999").localeCompare(b.publishedAt ?? "9999") || a.folder.localeCompare(b.folder));
  const index = entries.map(({ key: _key, ...rest }) => rest);

  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "index.json"), `${JSON.stringify({ postCount: index.length, posts: index }, null, 2)}\n`);

  const counts = (status: string) => index.filter((e) => e.migrationStatus === status).length;
  const rows = index.map((e) => {
    const done = e.migrationStatus === "migrated" || e.migrationStatus === "skipped" ? "x" : " ";
    const dup = e.possibleDuplicates.length ? " (also on " + e.possibleDuplicates.map((d) => d.split("/")[0]).join(", ") + ")" : "";
    const title = e.title.replace(/\|/g, "\\|");
    return `| [${done}] | ${e.publishedAt?.slice(0, 10) ?? "—"} | [${title}](${encodeURI(e.folder)}/post.md)${dup} | ${e.platform} | ${e.sourceStatus} | ${e.wordCount} | ${e.migrationStatus} |`;
  });
  const md = [
    "# Blog archive — migration checklist",
    "",
    "Generated by `scripts/blog-import/import-blogs.ts` from each post's `post.json`. Don't edit this",
    "file by hand: change a post's `migration.status` in its `post.json` (archived → in-review →",
    "migrated, or skipped) and re-run `node scripts/blog-import/import-blogs.ts --reindex`.",
    "",
    `**${index.length} posts** — ${counts("archived")} archived, ${counts("in-review")} in review, ${counts("migrated")} migrated, ${counts("skipped")} skipped.`,
    "",
    "| Done | Published | Title | Platform | Source status | Words | Migration |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(root, "INDEX.md"), md);
  return index;
}
