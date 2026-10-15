import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { htmlToMarkdown, extractElement } from "../../../scripts/blog-import/html.ts";
import { parseWxr, wpautop } from "../../../scripts/blog-import/wordpress.ts";
import { listWixPostUrls, parseWixPostPage } from "../../../scripts/blog-import/wix.ts";
import { archivePosts, fullSizeCandidates, rebuildIndex } from "../../../scripts/blog-import/archive.ts";
import { slugify } from "../../../scripts/blog-import/slug.ts";
import { addRecord, findAppMatches, loadAppCorpus, type AppCorpus } from "../../../scripts/blog-import/app-content.ts";
import type { ImportedPost } from "../../../scripts/blog-import/types.ts";

// Synthetic fixtures only -- no real blog content.
const WXR = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/">
<channel>
  <item>
    <title><![CDATA[Example Post &amp; Thoughts]]></title>
    <link>https://example.wordpress.com/2019/05/01/example-post/</link>
    <dc:creator><![CDATA[author]]></dc:creator>
    <content:encoded><![CDATA[First paragraph with <strong>bold</strong>.

Second line one
second line two

<img src="https://example.files.wordpress.com/2019/05/photo-300x200.jpg" alt="Photo" />]]></content:encoded>
    <excerpt:encoded><![CDATA[]]></excerpt:encoded>
    <wp:post_id>11</wp:post_id>
    <wp:post_date_gmt><![CDATA[2019-05-01 10:00:00]]></wp:post_date_gmt>
    <wp:post_name><![CDATA[example-post]]></wp:post_name>
    <wp:status><![CDATA[publish]]></wp:status>
    <wp:post_type><![CDATA[post]]></wp:post_type>
    <category domain="category" nicename="itihasa"><![CDATA[Itihasa]]></category>
    <category domain="category" nicename="uncategorized"><![CDATA[Uncategorized]]></category>
    <category domain="post_tag" nicename="example"><![CDATA[example]]></category>
    <wp:postmeta><wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key><wp:meta_value><![CDATA[20]]></wp:meta_value></wp:postmeta>
  </item>
  <item>
    <title>Cover</title>
    <wp:post_id>20</wp:post_id>
    <wp:post_type><![CDATA[attachment]]></wp:post_type>
    <wp:status><![CDATA[inherit]]></wp:status>
    <wp:attachment_url><![CDATA[https://example.files.wordpress.com/2019/05/cover.jpg]]></wp:attachment_url>
  </item>
  <item>
    <title><![CDATA[Unfinished draft]]></title>
    <content:encoded><![CDATA[<!-- wp:paragraph --><p>Draft text</p><!-- /wp:paragraph -->]]></content:encoded>
    <wp:post_id>12</wp:post_id>
    <wp:post_date_gmt><![CDATA[0000-00-00 00:00:00]]></wp:post_date_gmt>
    <wp:post_name><![CDATA[]]></wp:post_name>
    <wp:status><![CDATA[draft]]></wp:status>
    <wp:post_type><![CDATA[post]]></wp:post_type>
  </item>
  <item>
    <title><![CDATA[Trashed]]></title>
    <wp:post_id>13</wp:post_id>
    <wp:status><![CDATA[trash]]></wp:status>
    <wp:post_type><![CDATA[post]]></wp:post_type>
  </item>
  <item>
    <title><![CDATA[About]]></title>
    <wp:post_id>14</wp:post_id>
    <wp:status><![CDATA[publish]]></wp:status>
    <wp:post_type><![CDATA[page]]></wp:post_type>
  </item>
</channel>
</rss>`;

const WIX_PAGE = `<!doctype html><html><head>
<title>Example Post &amp; Thoughts | Example Blog</title>
<meta property="og:title" content="Example Post &amp; Thoughts">
<meta property="og:image" content="https://static.wixstatic.com/media/abc_123~mv2.jpg/v1/fill/w_740,h_493/abc_123~mv2.jpg">
<meta property="og:description" content="A short summary">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":"Example Post & Thoughts","datePublished":"2021-03-04T05:06:07.000Z","author":{"@type":"Person","name":"Author"},"keywords":"one, two"}</script>
<script>window.junk = "<article>not this</article>";</script>
</head><body><header>Site nav</header>
<div data-hook="post-description"><div><p>Body <em>text</em> here.</p><div><h2>Heading</h2><ul><li>One</li><li>Two</li></ul></div></div></div>
<footer>Footer</footer></body></html>`;

test("slugify folds IAST diacritics and produces SlugSchema-shaped output", () => {
  assert.equal(slugify("Śrīmad Bhāgavatam — Part 1"), "srimad-bhagavatam-part-1");
  assert.equal(slugify("Rāma's Exile!"), "ramas-exile");
});

test("htmlToMarkdown keeps headings, emphasis, links, lists, quotes and images", () => {
  const md = htmlToMarkdown(
    `<h2>Title</h2><p>Hello <strong>bold</strong> and <a href="https://example.com">link</a>.</p>` +
      `<ol><li>a</li><li>b</li></ol><blockquote><p>quoted</p></blockquote><p><img src="https://example.com/x.jpg" alt="x"></p>` +
      `<script>evil()</script><p>caf&eacute; &amp; &#8220;q&#8221;</p>`
  );
  assert.equal(
    md,
    "## Title\n\nHello **bold** and [link](https://example.com).\n\n1. a\n2. b\n\n> quoted\n\n![x](https://example.com/x.jpg)\n\ncafé & “q”"
  );
});

test("extractElement balances nested tags of the same name", () => {
  const el = extractElement(`<div id="a"><div>in</div><div>in2</div></div><div>out</div>`, /<div id="a">/);
  assert.equal(el, `<div id="a"><div>in</div><div>in2</div></div>`);
});

test("wpautop paragraphs raw WordPress content the way WordPress renders it", () => {
  assert.equal(wpautop("one\n\ntwo\nthree"), "<p>one</p>\n\n<p>two<br />\nthree</p>");
});

test("parseWxr keeps posts and drafts, skips trash, attachments and (by default) pages", () => {
  const posts = parseWxr(WXR);
  assert.deepEqual(posts.map((p) => p.title), ["Example Post & Thoughts", "Unfinished draft"]);
  const [first, draft] = posts;
  assert.equal(first.slug, "example-post");
  assert.equal(first.publishedAt, "2019-05-01T10:00:00Z");
  assert.deepEqual(first.categories, ["Itihasa"]);
  assert.deepEqual(first.tags, ["example"]);
  assert.equal(first.coverImageUrl, "https://example.files.wordpress.com/2019/05/cover.jpg");
  assert.equal(draft.slug, "unfinished-draft");
  assert.equal(draft.publishedAt, null);
  assert.equal(draft.sourceStatus, "draft");
  assert.equal(parseWxr(WXR, { includePages: true }).length, 3);
});

test("parseWixPostPage reads JSON-LD metadata and only the post body", () => {
  const post = parseWixPostPage(WIX_PAGE, "https://example.com/post/example-post");
  assert.equal(post.title, "Example Post & Thoughts");
  assert.equal(post.slug, "example-post");
  assert.equal(post.publishedAt, "2021-03-04T05:06:07.000Z");
  assert.equal(post.author, "Author");
  assert.deepEqual(post.tags, ["one", "two"]);
  assert.equal(htmlToMarkdown(post.html), "Body *text* here.\n\n## Heading\n\n- One\n- Two");
});

test("listWixPostUrls follows the sitemap index to the blog-posts sitemap and merges the RSS feed", async () => {
  const pages: Record<string, string> = {
    "https://example.com/sitemap.xml": `<sitemapindex><sitemap><loc>https://example.com/pages-sitemap.xml</loc></sitemap><sitemap><loc>https://example.com/blog-posts-sitemap.xml</loc></sitemap></sitemapindex>`,
    "https://example.com/blog-posts-sitemap.xml": `<urlset><url><loc>https://example.com/post/a</loc></url><url><loc>https://example.com/post/b</loc></url></urlset>`,
    "https://example.com/blog-feed.xml": `<rss><channel><link>https://example.com/blog</link><item><link>https://example.com/post/b</link></item><item><link>https://example.com/post/c</link></item></channel></rss>`,
  };
  const urls = await listWixPostUrls("https://example.com/", async (u) => pages[u] ?? null);
  assert.deepEqual(urls, ["https://example.com/post/a", "https://example.com/post/b", "https://example.com/post/c"]);
});

test("fullSizeCandidates prefers original-size images", () => {
  assert.deepEqual(fullSizeCandidates("https://static.wixstatic.com/media/abc~mv2.jpg/v1/fill/w_740/abc.jpg"), [
    "https://static.wixstatic.com/media/abc~mv2.jpg",
    "https://static.wixstatic.com/media/abc~mv2.jpg/v1/fill/w_740/abc.jpg",
  ]);
  assert.deepEqual(fullSizeCandidates("https://example.com/wp-content/uploads/a-300x200.jpg"), [
    "https://example.com/wp-content/uploads/a.jpg",
    "https://example.com/wp-content/uploads/a-300x200.jpg",
  ]);
});

test("archivePosts writes per-post folders, localises images, flags cross-platform duplicates and preserves migration progress on re-import", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-archive-"));
  try {
    const wp = parseWxr(WXR);
    const wix = [parseWixPostPage(WIX_PAGE, "https://example.com/post/example-post")];
    const fetched: string[] = [];
    const fetchBinary = async (url: string) => {
      fetched.push(url);
      return { bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" };
    };
    await archivePosts([...wp, ...wix], { root, fetchBinary });

    const dir = path.join(root, "wordpress", "2019-05-01-example-post");
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "post.json"), "utf8"));
    assert.equal(meta.coverImage.file, "images/01-cover.jpg");
    assert.equal(meta.images[1].file, "images/02-photo-300x200.jpg");
    assert.ok(fetched.includes("https://example.files.wordpress.com/2019/05/photo.jpg"), "tries full size first");
    const md = fs.readFileSync(path.join(dir, "post.md"), "utf8");
    assert.match(md, /^---\ntitle: "Example Post & Thoughts"/);
    assert.match(md, /!\[Photo\]\(images\/02-photo-300x200\.jpg\)/);
    assert.ok(fs.existsSync(path.join(root, "wordpress", "undated-unfinished-draft", "original.html")));

    meta.migration = { status: "migrated", notes: "now a Knowledge record" };
    fs.writeFileSync(path.join(dir, "post.json"), JSON.stringify(meta));
    await archivePosts(wp, { root });
    const again = JSON.parse(fs.readFileSync(path.join(dir, "post.json"), "utf8"));
    assert.deepEqual(again.migration, { status: "migrated", notes: "now a Knowledge record" });
    assert.equal(fs.readdirSync(path.join(root, "wordpress")).length, 2, "re-import reuses folders");

    const index = rebuildIndex(root);
    assert.equal(index.length, 3);
    const wpEntry = index.find((e) => e.folder === "wordpress/2019-05-01-example-post")!;
    assert.deepEqual(wpEntry.possibleDuplicates, ["wix/2021-03-04-example-post"]);
    assert.match(fs.readFileSync(path.join(root, "INDEX.md"), "utf8"), /\*\*3 posts\*\* — 2 archived, 0 in review, 1 migrated/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Posts whose writing already exists in the app.
// ---------------------------------------------------------------------------

const CHAPTER_TEXT =
  "Long ago a humble family of four lived on gleanings from the fields. One day, after a long fast, they had a single measure of flour. " +
  "As they sat down to eat, a hungry guest arrived at their door, and each of them gave away their share without hesitation. " +
  "When the guest had eaten, he revealed himself as Dharma, and the family ascended to the heavens. " +
  "A small creature rolled in the spilt flour, and half of its body turned to gold. Ever since, it has searched for a sacrifice equal to that one.";

function syntheticCorpus(): AppCorpus {
  const corpus: AppCorpus = { records: [], shingles: new Map(), titles: new Map() };
  addRecord(corpus, { file: "library/example-book/chapters/a-measure-of-flour.json", kind: "chapter", title: "A Measure of Flour" }, {
    title: "A Measure of Flour",
    body: CHAPTER_TEXT,
    translations: { te: { body: "unrelated translated text that must not be indexed at all here" } },
  });
  addRecord(corpus, { file: "knowledge/introduction.json", kind: "knowledge", title: "Introduction" }, { title: "Introduction", body: "An introduction to the example temples." });
  return corpus;
}

function post(overrides: Partial<ImportedPost>): ImportedPost {
  return {
    platform: "wordpress", sourceId: "1", sourceUrl: "https://example.wordpress.com/p/1", title: "Post", slug: "post",
    sourceStatus: "publish", publishedAt: "2019-01-01T00:00:00Z", modifiedAt: null, author: null, categories: [], tags: [],
    excerpt: null, coverImageUrl: null, html: "<p>Body</p>", ...overrides,
  };
}

test("findAppMatches flags a revised, retitled post whose text is already an app chapter as a duplicate", () => {
  // The blog version: different title, no IAST/curly quotes, one sentence reworded.
  const blog = CHAPTER_TEXT.replace("When the guest had eaten", "Once the visitor finished his meal");
  const result = findAppMatches(syntheticCorpus(), "The Golden Mongoose", blog);
  assert.equal(result.verdict, "duplicate");
  assert.ok(result.containment >= 0.5);
  assert.equal(result.matches[0].file, "library/example-book/chapters/a-measure-of-flour.json");
});

test("findAppMatches does not treat unrelated writing as a duplicate, and only flags a bare title match as possible", () => {
  const corpus = syntheticCorpus();
  const essay = "Reflections on the festival season and the music, food and community that carry a tradition forward from one generation to the next across many villages and towns.";
  assert.equal(findAppMatches(corpus, "Festival Thoughts", essay).verdict, "none");
  const titled = findAppMatches(corpus, "Introduction", essay);
  assert.equal(titled.verdict, "possible");
  assert.equal(titled.titleMatch, true);
});

test("translations are not indexed", () => {
  assert.equal(findAppMatches(syntheticCorpus(), "x", "unrelated translated text that must not be indexed at all here").containment, 0);
});

test("loadAppCorpus indexes the real content/ folder and skips _provenance/_unresolved", () => {
  const corpus = loadAppCorpus(path.resolve(import.meta.dirname, "../../../content"));
  assert.ok(corpus.records.some((r) => r.kind === "chapter"));
  assert.ok(corpus.records.some((r) => r.kind === "divya-desams"));
  assert.ok(corpus.records.every((r) => !r.file.startsWith("_")));
});

test("archivePosts leaves app duplicates out of the archive, records them in duplicates.json and INDEX.md, and flags weaker matches", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-archive-"));
  try {
    const corpus = syntheticCorpus();
    const dupe = post({ sourceId: "1", title: "The Golden Mongoose", slug: "the-golden-mongoose", html: `<p>${CHAPTER_TEXT}</p>` });
    const fresh = post({ sourceId: "2", title: "Introduction", slug: "introduction", html: "<p>Something new I wrote about a pilgrimage.</p>" });
    const result = await archivePosts([dupe, fresh], { root, appCorpus: corpus });

    assert.equal(result.archived.length, 1);
    assert.equal(result.duplicates.length, 1);
    assert.deepEqual(fs.readdirSync(path.join(root, "wordpress")), ["2019-01-01-introduction"]);
    const saved = JSON.parse(fs.readFileSync(path.join(root, "duplicates.json"), "utf8"));
    assert.equal(saved.count, 1);
    assert.equal(saved.duplicates[0].title, "The Golden Mongoose");
    assert.equal(saved.duplicates[0].matches[0].file, "library/example-book/chapters/a-measure-of-flour.json");

    const freshMeta = JSON.parse(fs.readFileSync(path.join(root, "wordpress", "2019-01-01-introduction", "post.json"), "utf8"));
    assert.equal(freshMeta.appCheck.verdict, "possible");

    const index = rebuildIndex(root);
    assert.deepEqual(index[0].possiblyInApp, ["knowledge/introduction.json"]);
    const md = fs.readFileSync(path.join(root, "INDEX.md"), "utf8");
    assert.match(md, /## Already in the app — not imported \(1\)/);
    assert.match(md, /The Golden Mongoose/);
    assert.match(md, /⚠ may already be in the app: `knowledge\/introduction.json`/);

    // A later run for another platform keeps the earlier duplicates; --include-duplicates archives it anyway.
    await archivePosts([post({ platform: "wix", sourceId: "https://example.com/post/x", title: "X", slug: "x", html: "<p>Brand new.</p>" })], { root, appCorpus: corpus });
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, "duplicates.json"), "utf8")).count, 1);
    const forced = await archivePosts([dupe], { root, appCorpus: corpus, includeDuplicates: true });
    assert.equal(forced.archived[0].appCheck?.verdict, "duplicate");
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, "duplicates.json"), "utf8")).count, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
