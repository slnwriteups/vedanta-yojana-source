import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Phase 5N -- source-level checks for metadata/structured-data wiring
 * and accessibility markup across routes. Data-layer logic (sitemap,
 * robots, truncation, JSON-LD escaping) is covered against real content
 * in tests/content/seo.test.ts; this file checks that the pages
 * actually use those pieces correctly, and some structural a11y facts
 * that only need a source read to verify.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

// ---------------------------------------------------------------------------
// Global metadata
// ---------------------------------------------------------------------------

test("root layout defines a title template and a sitewide indexable robots default", () => {
  const source = read("app/layout.tsx");
  assert.ok(source.includes("template:"));
  assert.ok(source.includes("robots:"));
  assert.ok(source.includes("index: true"));
});

test("root layout does not hard-code a fabricated production domain", () => {
  // The rule this enforces is about THIS SITE's own origin: canonical
  // URLs, metadataBase and the sitemap must derive from
  // getSiteOrigin()/NEXT_PUBLIC_SITE_URL, never from a domain written
  // into the layout by hand. A third-party asset host is a different
  // thing entirely -- it is not a claim about where this site is
  // deployed -- so the small, explicit set of them is removed before
  // the check rather than the check being weakened.
  const THIRD_PARTY_ASSET_HOSTS = [
    // Cloudflare Web Analytics beacon -- see app/layout.tsx and
    // docs/ANALYTICS.md.
    "https://static.cloudflareinsights.com/beacon.min.js",
  ];
  const source = THIRD_PARTY_ASSET_HOSTS.reduce(
    (text, url) => text.split(url).join(""),
    read("app/layout.tsx"),
  );
  assert.ok(!/https?:\/\/[a-z0-9.-]+\.(com|org|net|io|app)/i.test(source));
});

test("root layout only sets metadataBase conditionally, via getSiteOrigin()", () => {
  const source = read("app/layout.tsx");
  assert.ok(source.includes("getSiteOrigin"));
  assert.ok(source.includes("metadataBase"));
});

// ---------------------------------------------------------------------------
// Route metadata derives from real content, preserves notFound()
// ---------------------------------------------------------------------------

const DYNAMIC_ROUTES_WITH_METADATA = [
  { file: "app/divya-desams/[slug]/page.tsx", loader: "loadDivyaDesam" },
  { file: "app/library/[book]/page.tsx", loader: "loadBook" },
  { file: "app/library/[book]/[chapter]/page.tsx", loader: "loadChapter" },
  { file: "app/divya-desams/introduction/page.tsx", loader: "loadKnowledgeRecord" },
];

test("every dynamic route's generateMetadata resolves through the real loader and sets a canonical", () => {
  for (const { file, loader } of DYNAMIC_ROUTES_WITH_METADATA) {
    const source = read(file);
    assert.ok(source.includes("generateMetadata"), `${file} missing generateMetadata`);
    assert.ok(source.includes(loader), `${file} does not call ${loader}`);
    assert.ok(source.includes("alternates:"), `${file} missing alternates.canonical`);
    assert.ok(source.includes("notFound()"), `${file} lost its notFound() behavior`);
  }
});

test("dynamic route metadata never exposes sourcePageId/extractionConfidence", () => {
  for (const { file } of DYNAMIC_ROUTES_WITH_METADATA) {
    const source = read(file);
    assert.ok(!source.includes("sourcePageId"), `${file} references sourcePageId`);
    assert.ok(!source.includes("extractionConfidence"), `${file} references extractionConfidence`);
  }
});

test("dynamic route metadata handles the not-found case explicitly before deriving a title/description", () => {
  for (const { file } of DYNAMIC_ROUTES_WITH_METADATA) {
    const source = read(file);
    const generateMetadataBody = source.slice(source.indexOf("generateMetadata"));
    assert.match(generateMetadataBody, /if \(!\w+\) return \{ title:/);
  }
});

// ---------------------------------------------------------------------------
// Search: noindex-on-query, canonical always the bare page
// ---------------------------------------------------------------------------

test("search page metadata canonicalizes every query variant to the bare /search route", () => {
  const source = read("app/search/page.tsx");
  // Still the bare /search route, now resolved through siteUrl() so the
  // deployment's basePath is included (see lib/site.ts).
  assert.ok(source.includes('alternates: { canonical: siteUrl("/search") }'));
});

/**
 * Replaces "sets robots noindex only when a query is present". That rule
 * required varying the response per request, which `output: "export"`
 * cannot do -- exactly one /search document is emitted at build time. The
 * emitted page is the bare, queryless one, so it is indexable; query
 * variants are the same URL with client-side state applied, and are not
 * separately crawlable documents at all.
 */
test("search page metadata is static and marks the single emitted page indexable", () => {
  const source = read("app/search/page.tsx");
  assert.ok(
    source.includes("export const metadata"),
    "search metadata must be static -- generateMetadata cannot read searchParams under output: export"
  );
  assert.match(source, /robots:\s*\{\s*index:\s*true/);
  assert.ok(
    !source.includes("hasQuery"),
    "per-query robots branching is not expressible in a static export"
  );
});

// ---------------------------------------------------------------------------
// Sitemap/robots Next.js convention files delegate to the testable lib
// ---------------------------------------------------------------------------

test("app/sitemap.ts and app/robots.ts are thin wrappers around the lib/ implementations", () => {
  const sitemapSource = read("app/sitemap.ts");
  const robotsSource = read("app/robots.ts");
  assert.ok(sitemapSource.includes("buildSitemapEntries"));
  assert.ok(robotsSource.includes("buildRobots"));
});

// ---------------------------------------------------------------------------
// Structured data: present on justified routes, escaped via JsonLd, no
// fabricated fields (address/phone/geo/author/date/rating/review).
// ---------------------------------------------------------------------------

const STRUCTURED_DATA_ROUTES = [
  "app/page.tsx",
  "app/divya-desams/[slug]/page.tsx",
  "app/library/[book]/page.tsx",
  "app/library/[book]/[chapter]/page.tsx",
  "app/divya-desams/introduction/page.tsx",
];

test("every justified route renders JsonLd via the shared, safely-escaping component", () => {
  for (const file of STRUCTURED_DATA_ROUTES) {
    const source = read(file);
    assert.ok(source.includes("JsonLd"), `${file} missing JsonLd`);
    assert.ok(source.includes("@/components/seo/JsonLd"), `${file} does not import the shared JsonLd component`);
  }
});

test("structured data never fabricates postal address, phone, geo coordinates, author, publication date, rating, or review fields", () => {
  const forbidden = [
    "streetAddress",
    "postalCode",
    "telephone",
    "GeoCoordinates",
    "\"author\"",
    "datePublished",
    "aggregateRating",
    "review\":",
    "openingHours",
  ];
  for (const file of STRUCTURED_DATA_ROUTES) {
    const source = read(file);
    for (const term of forbidden) {
      assert.ok(!source.includes(term), `${file} unexpectedly references ${term}`);
    }
  }
});

test("the Divya Desam Place structured data only includes hasMap when a real shrine Maps link exists -- never fabricated", () => {
  const source = read("app/divya-desams/[slug]/page.tsx");
  assert.match(source, /"@type":\s*"Place"/);
  assert.ok(source.includes("firstMapsLink"));
  assert.ok(source.includes("record.shrines[0]?.mapsLink"));
});

test("no search-related file embeds raw query text into JSON-LD", () => {
  const source = read("app/search/page.tsx");
  assert.ok(!source.includes("JsonLd"), "search results page should not emit structured data for arbitrary queries");
});

// ---------------------------------------------------------------------------
// Accessibility: lists, breadcrumbs, external links, image alt policy
// ---------------------------------------------------------------------------

test("every <ul>/<ol> in the application declares role=\"list\" (Tailwind's preflight strips list-style, which can drop implicit list semantics in Safari/VoiceOver)", () => {
  const appFiles = listFilesRecursive(path.join(REPO_ROOT, "app")).filter((f) => f.endsWith(".tsx"));
  const componentFiles = listFilesRecursive(path.join(REPO_ROOT, "components")).filter((f) => f.endsWith(".tsx"));
  for (const file of [...appFiles, ...componentFiles]) {
    const source = fs.readFileSync(file, "utf8");
    // Strip block comments first -- otherwise a doc comment merely
    // MENTIONING "<ol>"/"<ul>" (as several files in this phase do, to
    // document the fix) is misread as an actual, unguarded list tag.
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const listTags = withoutComments.match(/<(ul|ol)\b[^>]*>/g) ?? [];
    for (const tag of listTags) {
      assert.ok(tag.includes('role="list"'), `${file}: found a <ul>/<ol> without role="list": ${tag}`);
    }
  }
});

test("Breadcrumbs renders a real <ol> with aria-current on the current page", () => {
  const source = read("components/shared/Breadcrumbs.tsx");
  assert.ok(source.includes("<ol"));
  assert.ok(source.includes('aria-current="page"'));
});

test("external Shrine/Resource links indicate they open in a new tab to assistive technology", () => {
  const shrineSource = read("components/divya-desams/ShrineLinks.tsx");
  const resourceSource = read("components/divya-desams/ResourceLinks.tsx");
  for (const source of [shrineSource, resourceSource]) {
    assert.ok(source.includes("sr-only"));
    assert.ok(source.includes("opens in a new tab"));
    assert.ok(source.includes('target="_blank"'));
    assert.ok(source.includes('rel="noopener noreferrer"'));
  }
});

test("image alt policy still never fabricates a description (Phase 5K/5L behavior preserved)", () => {
  const source = read("components/shared/RecordImages.tsx");
  assert.ok(source.includes("image.alt ?? \"\""));
  assert.ok(!/alt=\{[^}]*"[A-Za-z]{4,}/.test(source), "found what looks like a hard-coded, non-empty alt string");
});

// ---------------------------------------------------------------------------
// Not-found / error accessibility
// ---------------------------------------------------------------------------

test("the not-found page has explicit noindex metadata and a keyboard-accessible recovery link", () => {
  const source = read("app/not-found.tsx");
  assert.ok(source.includes("robots:"));
  assert.ok(source.includes("index: false"));
  assert.ok(source.includes('<Link href="/"'));
});

test("the error boundary exposes no raw error details or migration metadata to the user", () => {
  const source = read("app/error.tsx");
  assert.ok(!source.includes("error.message"));
  assert.ok(!source.includes("error.stack"));
  assert.ok(!source.includes("sourcePageId"));
  assert.ok(source.includes('<button type="button"'));
});

// ---------------------------------------------------------------------------
// General regression: still no content-extraction/migration references,
// still no new dependency.
// ---------------------------------------------------------------------------

test("no new SEO-related file references content-extraction/ or scripts/migration/", () => {
  const files = [
    "lib/site.ts",
    "lib/metadata.ts",
    "lib/json-ld.ts",
    "lib/sitemap.ts",
    "lib/robots.ts",
    "components/seo/JsonLd.tsx",
    "app/sitemap.ts",
    "app/robots.ts",
  ];
  for (const relPath of files) {
    const source = read(relPath);
    assert.ok(!source.includes("content-extraction"), `${relPath} references content-extraction`);
    assert.ok(!source.includes("scripts/migration"), `${relPath} references scripts/migration`);
  }
});

test("no new dependency was introduced for Phase 5N", () => {
  const pkg = JSON.parse(read("package.json"));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const expectedDeps = ["next", "react", "react-dom", "zod"];
  const expectedDevDeps = [
    "@tailwindcss/postcss",
    "@types/node",
    "@types/react",
    "@types/react-dom",
    "tailwindcss",
    "typescript",
  ];
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), expectedDeps.sort());
  assert.deepEqual(Object.keys(pkg.devDependencies).sort(), expectedDevDeps.sort());
  assert.ok(allDeps);
});

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}
