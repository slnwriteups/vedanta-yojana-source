/**
 * Bulk-imports old blog posts from WordPress and Wix into blog-archive/.
 * See scripts/blog-import/README.md for how to get the inputs.
 *
 *   node scripts/blog-import/import-blogs.ts --wordpress ~/Downloads/export.xml
 *   node scripts/blog-import/import-blogs.ts --wix-site https://example.com
 *   node scripts/blog-import/import-blogs.ts --wix-html-dir ~/Downloads/wix-posts
 *   node scripts/blog-import/import-blogs.ts --reindex
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadAppCorpus } from "./app-content.ts";
import { archivePosts, rebuildIndex, type FetchBinary } from "./archive.ts";
import { parseWxr } from "./wordpress.ts";
import { listWixPostUrls, parseWixPostPage, type FetchText } from "./wix.ts";
import type { ImportedPost } from "./types.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const USER_AGENT = "VedantaYojanaBlogImporter/1.0 (+https://vedantayojana.org)";

const { values } = parseArgs({
  options: {
    wordpress: { type: "string", multiple: true },
    "include-pages": { type: "boolean", default: false },
    "wix-site": { type: "string" },
    "wix-html-dir": { type: "string" },
    "no-images": { type: "boolean", default: false },
    "include-duplicates": { type: "boolean", default: false },
    "no-app-check": { type: "boolean", default: false },
    delay: { type: "string", default: "500" },
    out: { type: "string", default: path.join(REPO_ROOT, "blog-archive") },
    reindex: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help || (!values.wordpress && !values["wix-site"] && !values["wix-html-dir"] && !values.reindex)) {
  console.log(`Usage:
  --wordpress <file|dir>   WordPress export (Tools -> Export -> All content). Repeatable; a
                           directory imports every .xml in it (WordPress.com splits big exports).
  --include-pages          Also import WordPress static Pages, not only Posts.
  --wix-site <url>         Wix site address; posts are discovered from its sitemap + RSS feed.
  --wix-html-dir <dir>     Offline alternative: folder of Wix post pages saved from a browser.
  --no-images              Keep image URLs remote instead of downloading into the repo.
  --include-duplicates     Also archive posts whose text is already in the app (normally left
                           out and listed in duplicates.json / INDEX.md).
  --no-app-check           Skip comparing posts against the app's content/ folder.
  --delay <ms>             Pause between Wix page requests (default 500).
  --out <dir>              Archive folder (default blog-archive/).
  --reindex                Only rebuild blog-archive/index.json and INDEX.md.`);
  process.exit(values.help ? 0 : 1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fetchText: FetchText = async (url) => {
  try {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "follow" });
    return res.ok ? await res.text() : null;
  } catch (err) {
    console.warn(`  ! ${url}: ${(err as Error).message}`);
    return null;
  }
};

const fetchBinary: FetchBinary = async (url) => {
  try {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "follow" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type");
    if (contentType && !contentType.startsWith("image/") && !contentType.startsWith("application/octet-stream")) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType };
  } catch {
    return null;
  }
};

function xmlFiles(input: string): string[] {
  const resolved = path.resolve(input);
  if (fs.statSync(resolved).isDirectory()) {
    return fs.readdirSync(resolved).filter((f) => f.toLowerCase().endsWith(".xml")).sort().map((f) => path.join(resolved, f));
  }
  return [resolved];
}

async function main() {
  const out = path.resolve(values.out!);
  const posts: ImportedPost[] = [];

  for (const input of values.wordpress ?? []) {
    for (const file of xmlFiles(input)) {
      const found = parseWxr(fs.readFileSync(file, "utf8"), { includePages: values["include-pages"] });
      console.log(`WordPress: ${found.length} posts in ${path.basename(file)}`);
      posts.push(...found);
    }
  }

  if (values["wix-html-dir"]) {
    const dir = path.resolve(values["wix-html-dir"]);
    const files = fs.readdirSync(dir).filter((f) => /\.html?$/i.test(f)).sort();
    for (const f of files) {
      const html = fs.readFileSync(path.join(dir, f), "utf8");
      // Browsers record the page's address in <link rel="canonical"> / og:url.
      const url =
        html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
        html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
        `file:///${encodeURIComponent(f)}`;
      posts.push(parseWixPostPage(html, url));
    }
    console.log(`Wix (saved pages): ${files.length} posts`);
  }

  if (values["wix-site"]) {
    const urls = await listWixPostUrls(values["wix-site"], fetchText);
    console.log(`Wix: ${urls.length} post URLs found`);
    if (!urls.length) console.warn("  ! No posts found. Check the address, or use --wix-html-dir (see README).");
    for (const [i, url] of urls.entries()) {
      const html = await fetchText(url);
      if (!html) continue;
      const post = parseWixPostPage(html, url);
      console.log(`  [${i + 1}/${urls.length}] ${post.title}`);
      posts.push(post);
      await sleep(Number(values.delay));
    }
  }

  if (posts.length) {
    const appCorpus = values["no-app-check"] ? undefined : loadAppCorpus(path.join(REPO_ROOT, "content"));
    if (appCorpus) console.log(`Checking against ${appCorpus.records.length} records already in the app ...`);
    console.log(`Archiving ${posts.length} posts into ${path.relative(process.cwd(), out) || out} ...`);
    const result = await archivePosts(posts, {
      root: out,
      fetchBinary: values["no-images"] ? undefined : fetchBinary,
      appCorpus,
      includeDuplicates: values["include-duplicates"],
      log: console.warn,
    });
    console.log(`Archived ${result.archived.length}; ${result.duplicates.length} already in the app and not imported.`);
  }
  const index = rebuildIndex(out);
  const dups = index.filter((e) => e.possibleDuplicates.length).length;
  console.log(`Done: ${index.length} posts in the archive${dups ? ` (${dups} appear on both platforms)` : ""}. See INDEX.md.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
