/**
 * Publishes archived blog posts into the app's Library as a blog series
 * (a book.json with kind "blog" whose chapters are the posts), copies
 * their images into public/images/, and marks the posts as migrated in
 * blog-archive/.
 *
 *   node scripts/blog-import/publish-blog.ts path/to/spec.json
 *
 * The spec names the blog and, for each post, the archive folder it
 * comes from and the edited text to publish:
 *
 *   {
 *     "slug": "azhwar-vaibhavam",
 *     "title": "Āzhwār Vaibhavam",
 *     "author": "Vishnu Sreenivas",
 *     "description": "…",
 *     "posts": [
 *       { "archive": "wordpress/2019-06-30-azhwar-vaibhavam-an-introduction", "text": "intro.txt" }
 *     ]
 *   }
 *
 * Each text file's first line is the chapter title and the rest is the
 * body, paragraphs separated by blank lines (the same plain-text format
 * every Library chapter uses). A body with "## Title" lines is split into
 * sub-chapters, one per "##" section, grouped as a part titled with the
 * post's title; "@image N" lines place the post's Nth image in that
 * sub-chapter (see splitSections and the README). Paths are relative to the spec file. The
 * text is published exactly as written: posts are expected to have been
 * edited to book standard first, not copied from the blog as-is.
 *
 * Images are taken from the archived post (post.json `images`, in order)
 * and stored under a UUID derived from the image's original URL, so
 * re-publishing the same post never duplicates an image. Alt text is left
 * for a person to write (alt: null, altStatus "needs-review"), as for every
 * other image in the app.
 *
 * Re-running a spec rewrites the blog's book.json and chapters. Afterwards,
 * regenerate the app's content manifest:
 *   node mobile/scripts/generate-content-manifest.ts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BookSchema, ChapterSchema } from "../../content-lib/schemas/index.ts";
import { rebuildIndex } from "./archive.ts";
import { slugify } from "./slug.ts";
import type { ArchivedPost } from "./types.ts";

export interface BlogSpec {
  slug: string;
  title: string;
  author?: string;
  description?: string;
  posts: { archive: string; text: string }[];
}

export interface PublishPaths {
  repoRoot: string;
  /** Defaults to <repoRoot>/content */
  contentRoot?: string;
  /** Defaults to <repoRoot>/blog-archive */
  archiveRoot?: string;
  /** Defaults to <repoRoot>/public/images */
  imagesRoot?: string;
}

/** RFC 4122 version-5 UUID (SHA-1, URL namespace) -- stable for the same input. */
export function uuidV5(name: string): string {
  const namespace = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");
  const hash = crypto.createHash("sha1").update(namespace).update(name, "utf8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function parseEditedText(text: string): { title: string; body: string } {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  const newline = normalized.indexOf("\n");
  if (newline === -1) throw new Error("edited text needs a title line and a body");
  const title = normalized.slice(0, newline).trim();
  const body = normalized.slice(newline + 1).replace(/\n{3,}/g, "\n\n").trim();
  if (!title || !body) throw new Error("edited text needs a title line and a body");
  return { title, body };
}

function originalName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "image");
  } catch {
    return url.split("?")[0].split("/").pop() || "image";
  }
}

/**
 * Splits an edited post into sections. A post whose body has "## Title"
 * lines becomes a part: each "##" line starts a sub-chapter, and the post's
 * own title becomes the part title. A post without them is one chapter.
 */
export function splitSections(title: string, body: string): { partTitle: string | null; sections: { title: string; body: string }[] } {
  const lines = body.split("\n");
  if (!lines.some((line) => line.startsWith("## "))) return { partTitle: null, sections: [{ title, body }] };
  const sections: { title: string; lines: string[] }[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) sections.push({ title: line.slice(3).trim(), lines: [] });
    else if (sections.length) sections[sections.length - 1].lines.push(line);
    else if (line.trim()) throw new Error(`"${title}": text before the first "## " heading would belong to no sub-chapter`);
  }
  return {
    partTitle: title,
    sections: sections.map((sec) => {
      const text = sec.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      if (!sec.title || !text) throw new Error(`"${title}": every "## " sub-chapter needs a title and some text`);
      return { title: sec.title, body: text };
    }),
  };
}

const IMAGE_MARKER = /^@image (\d+)$/;

export function publishBlog(spec: BlogSpec, specDir: string, paths: PublishPaths) {
  const contentRoot = paths.contentRoot ?? path.join(paths.repoRoot, "content");
  const archiveRoot = paths.archiveRoot ?? path.join(paths.repoRoot, "blog-archive");
  const imagesRoot = paths.imagesRoot ?? path.join(paths.repoRoot, "public", "images");
  const bookDir = path.join(contentRoot, "library", spec.slug);
  const chaptersDir = path.join(bookDir, "chapters");

  const chapters: { chapter: ReturnType<typeof ChapterSchema.parse>; archive: string }[] = [];
  const parts: { title: string; order: number; chapters: string[] }[] = [];
  const archivedPosts: { archived: ArchivedPost; archive: string; firstSlug: string }[] = [];

  for (const post of spec.posts) {
    const archivedPath = path.join(archiveRoot, post.archive, "post.json");
    const archived = JSON.parse(fs.readFileSync(archivedPath, "utf8")) as ArchivedPost;
    const { title, body } = parseEditedText(fs.readFileSync(path.resolve(specDir, post.text), "utf8"));
    const { partTitle, sections } = splitSections(title, body);

    // The post's downloaded images, each original only once (a cover image is
    // often repeated in the body), numbered from 1 for "@image N" markers.
    const seen = new Set<string>();
    const postImages = archived.images.filter((image) => image.file && !seen.has(image.originalUrl) && seen.add(image.originalUrl));
    const usesMarkers = sections.some((sec) => sec.body.split("\n").some((line) => IMAGE_MARKER.test(line.trim())));

    const slugsForPost: string[] = [];
    sections.forEach((section, s) => {
      const slug = slugify(section.title);
      const wanted: number[] = [];
      const text = section.body
        .split("\n")
        .filter((line) => {
          const m = line.trim().match(IMAGE_MARKER);
          if (m) wanted.push(Number(m[1]));
          return !m;
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const picked = usesMarkers ? wanted : s === 0 ? postImages.map((_, n) => n + 1) : [];
      const images = picked.map((number, n) => {
        const image = postImages[number - 1];
        if (!image) throw new Error(`"${section.title}": @image ${number} -- the post has only ${postImages.length} image(s)`);
        const uuid = uuidV5(image.originalUrl);
        const ext = path.extname(image.file!).toLowerCase();
        fs.mkdirSync(imagesRoot, { recursive: true });
        fs.copyFileSync(path.join(archiveRoot, post.archive, image.file!), path.join(imagesRoot, `${uuid}${ext}`));
        return {
          assetId: `${slug}-${n + 1}`,
          sourceAssetUuid: uuid,
          sourceOriginalName: originalName(image.originalUrl),
          alt: null,
          altStatus: "needs-review" as const,
        };
      });
      const chapter = ChapterSchema.parse({
        title: section.title,
        slug,
        order: chapters.length + 1,
        status: "published",
        migration: { sourcePageId: `blog-archive:${post.archive}`, extractionConfidence: "high", needsReview: false },
        body: text,
        images,
      });
      chapters.push({ chapter, archive: post.archive });
      slugsForPost.push(slug);
    });
    if (partTitle) parts.push({ title: partTitle, order: parts.length + 1, chapters: slugsForPost });
    archivedPosts.push({ archived, archive: post.archive, firstSlug: slugsForPost[0] });
  }

  const slugs = chapters.map((c) => c.chapter.slug);
  const duplicate = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (duplicate) throw new Error(`two chapters would share the slug "${duplicate}" -- give them different titles`);

  const book = BookSchema.parse({
    slug: spec.slug,
    title: spec.title,
    ...(spec.author ? { author: spec.author } : {}),
    ...(spec.description ? { description: spec.description } : {}),
    kind: "blog",
    status: "published",
    migration: { sourcePageId: `blog-archive:${spec.slug}`, extractionConfidence: "high", needsReview: false },
    parts,
    chapterOrder: slugs,
  });

  fs.rmSync(chaptersDir, { recursive: true, force: true });
  fs.mkdirSync(chaptersDir, { recursive: true });
  fs.writeFileSync(path.join(bookDir, "book.json"), `${JSON.stringify(book, null, 2)}\n`);
  for (const { chapter } of chapters) {
    fs.writeFileSync(path.join(chaptersDir, `${chapter.slug}.json`), `${JSON.stringify(chapter, null, 2)}\n`);
  }
  for (const { archived, archive, firstSlug } of archivedPosts) {
    const file = path.join(chaptersDir, `${firstSlug}.json`);
    const updated: ArchivedPost = {
      ...archived,
      migration: {
        status: "migrated",
        notes: `Published in the Library as ${path.relative(paths.repoRoot, file).split(path.sep).join("/")}, edited to book standard.`,
      },
    };
    fs.writeFileSync(path.join(archiveRoot, archive, "post.json"), `${JSON.stringify(updated, null, 2)}\n`);
  }
  rebuildIndex(archiveRoot);
  return { book, chapters: chapters.map((c) => c.chapter) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error("Usage: node scripts/blog-import/publish-blog.ts path/to/spec.json");
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8")) as BlogSpec;
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const { book, chapters } = publishBlog(spec, path.dirname(path.resolve(specPath)), { repoRoot });
  console.log(`Published "${book.title}" (content/library/${book.slug}) with ${chapters.length} post(s):`);
  for (const c of chapters) console.log(`  ${c.order}. ${c.title}${c.images.length ? ` (${c.images.length} image${c.images.length === 1 ? "" : "s"})` : ""}`);
  console.log("Next: node mobile/scripts/generate-content-manifest.ts");
}
