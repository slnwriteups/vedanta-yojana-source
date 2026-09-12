import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { search } from "../../content-lib/search/index.ts";

/**
 * Phase 5M -- application-layer tests for the search feature: routing,
 * UI source structure, and safety. Corpus/matching/ranking/excerpt logic
 * itself is covered in tests/content/search.test.ts (parallel to how
 * loader tests live in tests/content/ and page-level checks live here).
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

// ---------------------------------------------------------------------------
// ROUTING (27-31)
// ---------------------------------------------------------------------------

test("27: a Divya Desam result links to /divya-desams/[slug]", () => {
  // "Shri Raṅgam" (not "Sri Rangam") since the corpus now uses the
  // project's custom IAST-influenced transliteration convention -- see
  // the "search has no diacritic normalization" finding this exposed:
  // a plain-ASCII query no longer matches this title. Tracked as a
  // known gap, not fixed here (out of scope for a content-formatting
  // pass).
  const results = search("Shri Raṅgam");
  const result = results.find((r) => r.type === "divya-desam");
  assert.ok(result);
  assert.equal(result?.href, "/divya-desams/sri-rangam");
});

test("28: a Book result links to /library/[book]", () => {
  const results = search("Visishtadvaita Philosophy");
  const result = results.find((r) => r.type === "book");
  assert.ok(result);
  assert.equal(result?.href, "/library/untitled-recovered-book-pending-editorial-title");
});

test("29: a Chapter result links to /library/[book]/[chapter]", () => {
  const results = search("Rama Charama Shlokam");
  const result = results.find((r) => r.type === "chapter");
  assert.ok(result);
  assert.equal(
    result?.href,
    "/library/untitled-recovered-book-pending-editorial-title/rama-charama-shlokam"
  );
});

test("30: a Knowledge result links to /divya-desams/[slug]", () => {
  const results = search("Introduction");
  const result = results.find((r) => r.type === "knowledge");
  assert.ok(result);
  assert.equal(result?.href, "/divya-desams/introduction");
});

test("31: no result href references a filesystem path or content-extraction", () => {
  // Every real href IS root-relative (starts with "/", e.g.
  // "/divya-desams/sri-rangam") -- that is correct and expected for a
  // next/link href, not a filesystem path. What must never appear is an
  // actual repo-relative content path, a reference to the frozen
  // extraction snapshot, or a directory-traversal segment.
  const results = search("temple");
  assert.ok(results.length > 0, "expected at least one result to check");
  for (const result of results) {
    assert.match(result.href, /^\/(divya-desams|library|knowledge)\//);
    assert.ok(!result.href.includes("content/"), result.href);
    assert.ok(!result.href.includes("content-extraction"), result.href);
    assert.ok(!result.href.includes(".."), result.href);
  }
});

// ---------------------------------------------------------------------------
// UI (32-40)
// ---------------------------------------------------------------------------

test("32: the search page has a distinct initial-state branch for no/blank query", () => {
  const resultsSource = read("components/search/SearchResults.tsx");
  assert.ok(resultsSource.includes("Enter a search term"));
});

test("33/34: the search query is read from the URL, preserved in the form input, and now filters live on every keystroke (matching mobile's onChangeText behavior)", () => {
  // The read moved from the server page (searchParams) to the browser
  // (useSearchParams) when the static export removed the server. The
  // contract -- /search?q=... drives both the results and the visible
  // input -- is unchanged.
  const clientSource = read("components/search/SearchClient.tsx");
  assert.ok(clientSource.includes("useSearchParams"));
  assert.ok(clientSource.includes('searchParams.get("q")'));
  assert.ok(clientSource.includes("handleChange"), "expected a live onChange handler, not submit-only filtering");
  const formSource = read("components/search/SearchForm.tsx");
  assert.ok(formSource.includes("value={query}"), "expected a controlled input so typing filters live");
});

test("35/36: SearchResult renders the result title and a visible (non-color-only), localized type label", () => {
  const source = read("components/search/SearchResult.tsx");
  assert.ok(source.includes("result.title"));
  assert.ok(source.includes("RESULT_TYPE_LABEL_KEYS"));
  assert.ok(source.includes("translateUi"), "expected the type label to be localized, matching mobile's search.tsx");
});

test("37: SearchResult renders the parent book title for chapter results", () => {
  const source = read("components/search/SearchResult.tsx");
  assert.ok(source.includes("result.parentTitle"));
});

test("38: SearchResults has a distinct, localized no-results-state branch matching mobile's noResultsLabel() wording", () => {
  const source = read("components/search/SearchResults.tsx");
  assert.ok(source.includes("noResultsLabel"));
  const uiStrings = read("lib/ui-strings.ts");
  assert.match(uiStrings, /export function noResultsLabel[\s\S]{0,200}`No results for "\$\{query\}"\.`/);
});

test("content-type filter chips (Divya Desam/Book/Chapter/Knowledge) exist on web, matching mobile's search.tsx", () => {
  const source = read("components/search/SearchClient.tsx");
  assert.ok(source.includes("CONTENT_TYPE_FILTERS"));
  assert.ok(source.includes("filterResultsByType"));
  assert.ok(source.includes("toggleType"));
});

test("39: no migration metadata appears anywhere in the search UI source", () => {
  const files = [
    "app/search/page.tsx",
    "components/search/SearchForm.tsx",
    "components/search/SearchResult.tsx",
    "components/search/SearchResults.tsx",
  ];
  for (const relPath of files) {
    const source = read(relPath);
    assert.ok(!source.includes("sourcePageId"), `${relPath} references sourcePageId`);
    assert.ok(!source.includes("extractionConfidence"), `${relPath} references extractionConfidence`);
  }
});

// ---------------------------------------------------------------------------
// Server-rendered, no client component, no JS required for basic submission.
// ---------------------------------------------------------------------------

/**
 * Replaces "the search feature has no client components". A static export
 * has no server to compute results on, so search necessarily moved into
 * the browser. What is still worth pinning down is that the client
 * boundary stayed as small as possible: exactly one client component,
 * with the page and the presentational components untouched.
 */
test("exactly one client component in the search feature, and it is SearchClient", () => {
  const serverFiles = [
    "app/search/page.tsx",
    "components/search/SearchForm.tsx",
    "components/search/SearchResult.tsx",
    "components/search/SearchResults.tsx",
  ];
  for (const relPath of serverFiles) {
    const source = read(relPath);
    assert.ok(!source.includes('"use client"'), `${relPath} should not declare a client boundary`);
  }
  assert.ok(read("components/search/SearchClient.tsx").includes('"use client"'));
});

test("SearchClient does not pull the node:fs-backed corpus builder into the browser bundle", () => {
  const source = read("components/search/SearchClient.tsx");
  // Checks the import graph, not prose -- the doc comment names
  // buildSearchCorpus precisely to explain why it must not be imported.
  assert.ok(
    !/^import[^;]*buildSearchCorpus/m.test(source),
    "importing buildSearchCorpus would drag the content loader (node:fs) into the client bundle"
  );
  assert.ok(
    !/^import[^;]*from\s+["']@\/content-lib\/search["']/m.test(source),
    "the content-lib/search barrel re-exports buildSearchCorpus -- import run.ts directly"
  );
  assert.ok(source.includes('from "@/content-lib/search/run.ts"'));
});

test("SearchForm is still a GET form targeting the search route", () => {
  const source = read("components/search/SearchForm.tsx");
  assert.ok(source.includes('method="GET"'));
  // The action is now built from NEXT_PUBLIC_BASE_PATH rather than
  // hardcoded, so it stays correct when the site is served from a
  // sub-path. Submission still works without JavaScript; only the
  // results themselves now require it.
  assert.ok(source.includes("/search/"));
  assert.ok(source.includes("NEXT_PUBLIC_BASE_PATH"));
});

test("no search-related file uses dangerouslySetInnerHTML or constructs a RegExp from user input", () => {
  const files = [
    "app/search/page.tsx",
    "components/search/SearchForm.tsx",
    "components/search/SearchResult.tsx",
    "components/search/SearchResults.tsx",
    "content-lib/search/match.ts",
    "content-lib/search/excerpt.ts",
  ];
  for (const relPath of files) {
    const source = read(relPath);
    assert.ok(!source.includes("dangerouslySetInnerHTML"), relPath);
    assert.ok(!source.includes("new RegExp("), relPath);
    assert.ok(!source.includes("eval("), relPath);
  }
});

// ---------------------------------------------------------------------------
// No search dependency was installed.
// ---------------------------------------------------------------------------

test("no new search dependency appears in package.json", () => {
  const pkg = JSON.parse(read("package.json"));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const forbidden of ["pagefind", "fuse.js", "lunr", "minisearch", "algoliasearch", "@elastic/elasticsearch", "meilisearch", "typesense"]) {
    assert.ok(!(forbidden in allDeps), `unexpected dependency: ${forbidden}`);
  }
});
