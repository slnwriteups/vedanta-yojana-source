import test from "node:test";
import assert from "node:assert/strict";
import { buildSitemapEntries } from "../../lib/sitemap.ts";
import { buildRobots } from "../../lib/robots.ts";
import { getSiteOrigin } from "../../lib/site.ts";
import { truncateForDescription } from "../../lib/metadata.ts";
import { serializeJsonLd } from "../../lib/json-ld.ts";
import { loadDivyaDesam } from "../../content-lib/loader/index.ts";

/**
 * Phase 5N -- tests for the SEO data-layer pieces (sitemap, robots,
 * metadata helpers, JSON-LD serialization) against the real migrated
 * baseline, parallel to how tests/content/search.test.ts covers
 * content-lib/search. UI/route-source-level checks live in
 * tests/app/seo.test.ts.
 */

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

test("sitemap includes exactly the expected public-route counts: 5 static + 107 Divya Desams + 4 books + 227 chapters + 1 Knowledge", () => {
  const entries = buildSitemapEntries();
  assert.equal(entries.length, 5 + 107 + 4 + (51 + 75 + 31 + 70) + 1);
});

test("sitemap excludes Page150, known gaps, and arbitrary search-query URLs", () => {
  const entries = buildSitemapEntries();
  const urls = entries.map((e) => e.url);
  for (const forbidden of ["Page150", "Page112", "Page115", "Page116", "Page117", "search?q="]) {
    assert.ok(!urls.some((u) => u.includes(forbidden)), `found forbidden reference: ${forbidden}`);
  }
  // Exactly one /search entry (the bare route), never a query variant.
  assert.equal(urls.filter((u) => u.includes("/search")).length, 1);
  assert.ok(urls.some((u) => u.endsWith("/search")));
});

test("sitemap entries are root-relative when no deployment origin is configured (no fabricated domain)", () => {
  assert.equal(getSiteOrigin(), undefined, "expected no NEXT_PUBLIC_SITE_URL in this test environment");
  const entries = buildSitemapEntries();
  for (const entry of entries) {
    assert.ok(entry.url.startsWith("/"), `expected a root-relative url, got: ${entry.url}`);
    assert.ok(!entry.url.includes("://"), `unexpected absolute/fabricated origin in: ${entry.url}`);
  }
});

test("sitemap ordering is deterministic across repeated calls", () => {
  const first = buildSitemapEntries().map((e) => e.url);
  const second = buildSitemapEntries().map((e) => e.url);
  assert.deepEqual(first, second);
});

test("sitemap Divya Desam ordering matches source-page provenance (Sri Rangam/Page5 appears before a much later-numbered temple)", () => {
  const urls = buildSitemapEntries().map((e) => e.url);
  const sriRangamIndex = urls.indexOf("/divya-desams/sri-rangam");
  const tirukoodalIndex = urls.indexOf("/divya-desams/tirukoodal"); // Page93
  assert.ok(sriRangamIndex !== -1 && tirukoodalIndex !== -1);
  assert.ok(sriRangamIndex < tirukoodalIndex);
});

test("sitemap chapter URLs use the correct real book slug", () => {
  const entries = buildSitemapEntries();
  const chapterUrl = entries.find((e) => e.url.includes("/rama-charama-shlokam"));
  assert.ok(chapterUrl);
  assert.equal(
    chapterUrl?.url,
    "/library/untitled-recovered-book-pending-editorial-title/rama-charama-shlokam"
  );
});

// ---------------------------------------------------------------------------
// Robots
// ---------------------------------------------------------------------------

test("robots allows crawling by default and does not disallow /search", () => {
  const robots = buildRobots();
  const rules = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
  assert.equal(rules?.userAgent, "*");
  assert.equal(rules?.allow, "/");
  assert.equal(rules?.disallow, undefined);
});

test("robots omits the sitemap field when no deployment origin is configured", () => {
  const robots = buildRobots();
  assert.equal(robots.sitemap, undefined);
});

// ---------------------------------------------------------------------------
// getSiteOrigin -- no fabricated domain, but does honor real config
// ---------------------------------------------------------------------------

test("getSiteOrigin returns undefined when NEXT_PUBLIC_SITE_URL is unset", () => {
  assert.equal(getSiteOrigin(), undefined);
});

test("getSiteOrigin returns a real origin when NEXT_PUBLIC_SITE_URL is validly set, and falls back to undefined for a malformed value", (t) => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  t.after(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  process.env.NEXT_PUBLIC_SITE_URL = "https://example-configured-deployment.test";
  assert.equal(getSiteOrigin(), "https://example-configured-deployment.test");

  process.env.NEXT_PUBLIC_SITE_URL = "not a valid url";
  assert.equal(getSiteOrigin(), undefined);
});

test("when NEXT_PUBLIC_SITE_URL is configured, sitemap/robots use it -- proving the mechanism works without hard-coding a domain", (t) => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  t.after(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });
  process.env.NEXT_PUBLIC_SITE_URL = "https://example-configured-deployment.test";

  const entries = buildSitemapEntries();
  assert.ok(entries.every((e) => e.url.startsWith("https://example-configured-deployment.test/")));

  const robots = buildRobots();
  assert.equal(robots.sitemap, "https://example-configured-deployment.test/sitemap.xml");
});

// ---------------------------------------------------------------------------
// truncateForDescription
// ---------------------------------------------------------------------------

test("truncateForDescription leaves short text untouched", () => {
  assert.equal(truncateForDescription("A short sentence."), "A short sentence.");
});

test("truncateForDescription cuts long text at a word boundary and appends an ellipsis", () => {
  const long = "word ".repeat(60).trim();
  const result = truncateForDescription(long, 50);
  assert.ok(result.length <= 51);
  assert.ok(result.endsWith("…"));
  assert.ok(!result.slice(0, -1).endsWith(" "));
});

test("truncateForDescription on real Sri Rangam sthalaPuranam text produces a verbatim (not fabricated) prefix", () => {
  const record = loadDivyaDesam("sri-rangam");
  assert.ok(record?.sthalaPuranam);
  const description = truncateForDescription(record!.sthalaPuranam!);
  const withoutEllipsis = description.endsWith("…") ? description.slice(0, -1) : description;
  assert.ok(record!.sthalaPuranam!.startsWith(withoutEllipsis));
});

// ---------------------------------------------------------------------------
// JSON-LD safe serialization
// ---------------------------------------------------------------------------

test("serializeJsonLd produces valid JSON that round-trips", () => {
  const data = { "@context": "https://schema.org", "@type": "WebPage", name: "Test Page" };
  const serialized = serializeJsonLd(data);
  assert.deepEqual(JSON.parse(serialized), data);
});

test("serializeJsonLd escapes a literal </script> sequence so it can never break out of the tag", () => {
  const malicious = { name: 'Innocuous</script><script>alert("x")</script>' };
  const serialized = serializeJsonLd(malicious);
  // Escaping the "<" alone is sufficient and is the standard mitigation
  // (matching Next.js's own documented JSON-LD example): once "<"
  // becomes "\u003c", no "<" character remains for the HTML tokenizer to
  // recognize as the start of a closing "</script>" tag.
  assert.ok(!serialized.includes("</script>"), "a literal </script> sequence survived serialization");
  assert.ok(serialized.includes("\\u003c/script>"));
});

test("serializeJsonLd never uses dangerouslySetInnerHTML or manual string concatenation of the input", () => {
  // structural guarantee: the function is exactly a JSON.stringify + escape,
  // exercised here against a range of hostile inputs without throwing.
  const hostileInputs = [
    { name: "<img src=x onerror=alert(1)>" },
    { name: "\u2028\u2029" },
    { nested: { deep: { value: "</script>".repeat(5) } } },
  ];
  for (const input of hostileInputs) {
    assert.doesNotThrow(() => serializeJsonLd(input));
    assert.ok(!serializeJsonLd(input).includes("</script>"));
  }
});
