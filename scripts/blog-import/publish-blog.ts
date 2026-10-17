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
 * every Library chapter uses). Paths are relative to the spec file. The
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

export function publishBlog(spec: BlogSpec, specDir: string, paths: PublishPaths) {
  const contentRoot = paths.contentRoot ?? path.join(paths.repoRoot, "content");
  const archiveRoot = paths.archiveRoot ?? path.join(paths.repoRoot, "blog-archive");
  const imagesRoot = paths.imagesRoot ?? path.join(paths.repoRoot, "public", "images");
  const bookDir = path.join(contentRoot, "library", spec.slug);
  const chaptersDir = path.join(bookDir, "chapters");

  const chapters = spec.posts.map((post, i) => {
    const archivedPath = path.join(archiveRoot, post.archive, "post.json");
    const archived = JSON.parse(fs.readFileSync(archivedPath, "utf8")) as ArchivedPost;
    const { title, body } = parseEditedText(fs.readFileSync(path.resolve(specDir, post.text), "utf8"));
    const slug = slugify(title);

    const images = archived.images
      .filter((image) => image.file)
      .map((image, n) => {
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
      title,
      slug,
      order: i + 1,
      status: "published",
      migration: { sourcePageId: `blog-archive:${post.archive}`, extractionConfidence: "high", needsReview: false },
      body,
      images,
    });
    return { chapter, archived, archive: post.archive };
  });

  const slugs = chapters.map((c) => c.chapter.slug);
  const duplicate = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (duplicate) throw new Error(`two posts would share the chapter slug "${duplicate}" -- give them different titles`);

  const book = BookSchema.parse({
    slug: spec.slug,
    title: spec.title,
    ...(spec.author ? { author: spec.author } : {}),
    ...(spec.description ? { description: spec.description } : {}),
    kind: "blog",
    status: "published",
    migration: { sourcePageId: `blog-archive:${spec.slug}`, extractionConfidence: "high", needsReview: false },
    parts: [],
    chapterOrder: slugs,
  });

  fs.rmSync(chaptersDir, { recursive: true, force: true });
  fs.mkdirSync(chaptersDir, { recursive: true });
  fs.writeFileSync(path.join(bookDir, "book.json"), `${JSON.stringify(book, null, 2)}\n`);
  for (const { chapter, archived, archive } of chapters) {
    const file = path.join(chaptersDir, `${chapter.slug}.json`);
    fs.writeFileSync(file, `${JSON.stringify(chapter, null, 2)}\n`);
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
