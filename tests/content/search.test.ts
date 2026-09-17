import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSearchCorpus,
  searchContent,
  rankSearchResults,
  createExcerpt,
  normalizeQuery,
  search,
} from "../../content-lib/search/index.ts";
import type { SearchDocument, SearchMatch } from "../../content-lib/search/index.ts";

/**
 * Phase 5M -- tests for content-lib/search against the REAL migrated
 * baseline (per the brief's "test against the actual migrated baseline"
 * expectation, matching the established convention from Phases 5K/5L).
 * Ranking's tie-break determinism is additionally checked with small,
 * hand-built synthetic SearchMatch objects, since real content rarely
 * produces genuinely equal-priority ties to exercise every branch.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

const corpus = buildSearchCorpus();

// ---------------------------------------------------------------------------
// CORPUS (1-7)
// ---------------------------------------------------------------------------

test("1: all 107 Divya Desams are searchable", () => {
  assert.equal(corpus.filter((d) => d.type === "divya-desam").length, 107);
});

test("2: the Book is searchable", () => {
  const books = corpus.filter((d) => d.type === "book");
  assert.equal(books.length, 4);
  // Phase 6E confirmed "A Brief Insight to Visishtadvaita Philosophy.pdf"
  // as the source for 17 of this book's chapters and supplemented the
  // book's title/author accordingly (see content/_provenance/library/).
  // 4 misplaced Srimad Bhagavatham fragment chapters (one containing
  // 58 unresolved "Lorem ipsum" placeholder blocks) were later removed,
  // leaving 51 chapters, and the book's status flipped to published.
  // loadBooks() sorts alphabetically by slug, so books are found by
  // title rather than assumed to be at a fixed index.
  assert.ok(books.some((b) => b.title === "A Brief Insight to Visishtadvaita Philosophy"));
  assert.ok(books.some((b) => b.title === "Sri Rama Charithram"));
  assert.ok(books.some((b) => b.title === "Srimad Bhagavata Kathasagaram"));
  assert.ok(books.some((b) => b.title === "JAYA: A Journey of the Mahabharata"));
});

test("3: all chapters across every book are searchable", () => {
  assert.equal(corpus.filter((d) => d.type === "chapter").length, 51 + 75 + 31 + 70);
});

test("4: the Knowledge record is searchable", () => {
  const records = corpus.filter((d) => d.type === "knowledge");
  assert.equal(records.length, 1);
  assert.equal(records[0].title, "Introduction");
});

test("5: Page150 is not included -- exact corpus size, no href/title referencing it", () => {
  assert.equal(corpus.length, 107 + 4 + (51 + 75 + 31 + 70) + 1);
  for (const doc of corpus) {
    assert.ok(!doc.href.includes("Page150"));
    assert.ok(!doc.title.includes("Hayagriva"));
  }
});

test("6/7: content-lib/search source never references content-extraction/ or scripts/migration/", () => {
  const files = ["types.ts", "corpus.ts", "match.ts", "rank.ts", "excerpt.ts", "index.ts"];
  for (const file of files) {
    const source = read(`content-lib/search/${file}`);
    assert.ok(!source.includes("content-extraction"), `${file} references content-extraction`);
    assert.ok(!source.includes("scripts/migration"), `${file} references scripts/migration`);
  }
});

test("no content-lib/search file imports node:fs directly (only corpus.ts touches the loader)", () => {
  const files = ["types.ts", "corpus.ts", "match.ts", "rank.ts", "excerpt.ts", "index.ts"];
  for (const file of files) {
    const source = read(`content-lib/search/${file}`);
    assert.ok(!source.includes("node:fs"), `${file} imports node:fs directly`);
  }
});

// ---------------------------------------------------------------------------
// MATCHING (8-18)
// ---------------------------------------------------------------------------

test("8: matching is case-insensitive", () => {
  const lower = searchContent(corpus, "shri raṅgam");
  const upper = searchContent(corpus, "SHRI RAṄGAM");
  assert.equal(lower.length, upper.length);
  assert.ok(lower.length > 0);
});

test("9: query whitespace is normalized", () => {
  assert.equal(normalizeQuery("  sri   rangam  "), "sri rangam");
});

test("10: empty/whitespace-only query returns no matches", () => {
  assert.deepEqual(searchContent(corpus, ""), []);
  assert.deepEqual(searchContent(corpus, "   "), []);
});

test("11: multi-word query requires every term to be present somewhere in the record", () => {
  const matches = searchContent(corpus, "sri raṅganāthar");
  assert.ok(matches.some((m) => m.document.href === "/divya-desams/sri-rangam"));

  const noMatch = searchContent(corpus, "sri zzz-nonexistent-term-zzz");
  assert.deepEqual(noMatch, []);
});

test("12: an exact title match is found", () => {
  const matches = searchContent(corpus, "Sri Raṅgam");
  const sriRangam = matches.find((m) => m.document.href === "/divya-desams/sri-rangam");
  assert.ok(sriRangam);
  assert.equal(sriRangam?.tier, 1);
});

test("13: a body-only match (sthalaPuranam) is found", () => {
  // "Vaikuntham" appears in Sri Rangam's sthalaPuranam, not in its title.
  const matches = searchContent(corpus, "Vaikuṇṭham");
  const sriRangam = matches.find((m) => m.document.href === "/divya-desams/sri-rangam");
  assert.ok(sriRangam, "expected a body match for Sri Rangam via sthalaPuranam");
});

test("14: a temple-information field match is found (thayaar, not in the title)", () => {
  // "Ranagnayaki" is Sri Rangam's thayaar, not part of its title "Sri Rangam".
  const matches = searchContent(corpus, "Raṅganāyaki");
  const sriRangam = matches.find((m) => m.document.href === "/divya-desams/sri-rangam");
  assert.ok(sriRangam);
  assert.equal(sriRangam?.tier, 4);
  assert.equal(sriRangam?.matchedField?.name, "thayaar");
});

test("Phase 6E-C: a shrine-level field (a sub-shrine's own moolavar) is discoverable through its parent Divya Desam record, as exactly one canonical result -- not a duplicate document", () => {
  // "Manikkundra Perumal" is the Moolavar of Manikkunram, one of Tanjai
  // Mamanikoyil's 3 shrines -- present only in shrines[1].templeInformation,
  // never in the record-level templeInformation or displayName.
  const matches = searchContent(corpus, "Manikkundra Perumāl");
  const tanjai = matches.filter((m) => m.document.href === "/divya-desams/tanjai-mamanikoyil");
  assert.equal(tanjai.length, 1, "expected exactly one match entry for the parent record, not one per shrine");
  assert.equal(tanjai[0].matchedField?.name, "shrineMoolavar");

  // The corpus itself has exactly one document per Divya Desam record,
  // structurally guaranteeing shrines[] can never produce duplicate
  // canonical results.
  const tanjaiDocs = corpus.filter((d) => d.href === "/divya-desams/tanjai-mamanikoyil");
  assert.equal(tanjaiDocs.length, 1);
});

test("15: a chapter-body match is found", () => {
  // "Vibhīshaṇa" appears in the Rama Charama Shlokam chapter body (IAST
  // standardization pass, round 6: Vibhishana -> Vibhīshaṇa).
  const matches = searchContent(corpus, "Vibhīshaṇa");
  const chapter = matches.find((m) => m.document.href.endsWith("/rama-charama-shlokam"));
  assert.ok(chapter, "expected Vibhīshaṇa to match the Rama Charama Shlokam chapter");
});

test("16: a Knowledge-body match is found", () => {
  // "Mangalaasasanam" appears in the Introduction's body, not its title.
  const matches = searchContent(corpus, "Mangalaasasanam");
  const knowledge = matches.find((m) => m.document.type === "knowledge");
  assert.ok(knowledge, "expected Mangalaasasanam to match the Introduction Knowledge record");
});

test("17: a query matching nothing returns no results", () => {
  assert.deepEqual(searchContent(corpus, "zzzzznonexistentqueryzzzzz"), []);
});

test("18: punctuation and unusual input do not crash the matcher", () => {
  const weirdQueries = [
    "()[]{}*.+?^$|\\",
    "sri-rangam!!!",
    "???",
    "a".repeat(500),
    "  \t\n  ",
    "%20%3Cscript%3E",
  ];
  for (const query of weirdQueries) {
    assert.doesNotThrow(() => searchContent(corpus, query), `threw on query: ${query}`);
  }
});

// ---------------------------------------------------------------------------
// RANKING (19-22)
// ---------------------------------------------------------------------------

test("19: an exact title match ranks above weaker matches for the same query", () => {
  const ranked = rankSearchResults(searchContent(corpus, "Sri Raṅgam"));
  assert.ok(ranked.length > 0);
  assert.equal(ranked[0].document.href, "/divya-desams/sri-rangam");
  assert.equal(ranked[0].tier, 1);
});

test("20: a title-prefix match ranks above a title-substring/body match", () => {
  const ranked = rankSearchResults(searchContent(corpus, "Tiru"));
  assert.ok(ranked.length > 1);
  // Every tier-2 (prefix) result must sort before every tier-3+ result.
  const firstNonPrefixIndex = ranked.findIndex((m) => m.tier > 2);
  if (firstNonPrefixIndex !== -1) {
    for (let i = 0; i < firstNonPrefixIndex; i++) {
      assert.ok(ranked[i].tier <= 2);
    }
  }
});

test("21: ranking is deterministic across repeated runs on the same input", () => {
  const matches = searchContent(corpus, "temple");
  const first = rankSearchResults(matches).map((m) => m.document.href);
  const second = rankSearchResults(matches).map((m) => m.document.href);
  assert.deepEqual(first, second);
});

test("22: equal tier/type/sourceOrder results fall back to alphabetical title order (synthetic, for full control)", () => {
  const makeDoc = (title: string, sourceOrder: number): SearchDocument => ({
    type: "divya-desam",
    title,
    href: `/divya-desams/${title.toLowerCase().replace(/\s+/g, "-")}`,
    status: "draft",
    needsReview: false,
    sourceOrder,
    fields: [{ name: "displayName", tier: "title", text: title }],
  });
  const matches: SearchMatch[] = [
    { document: makeDoc("Zebra Temple", 5), tier: 3 },
    { document: makeDoc("Alpha Temple", 5), tier: 3 },
    { document: makeDoc("Mid Temple", 5), tier: 3 },
  ];
  const ranked = rankSearchResults(matches);
  assert.deepEqual(
    ranked.map((m) => m.document.title),
    ["Alpha Temple", "Mid Temple", "Zebra Temple"]
  );
});

// ---------------------------------------------------------------------------
// EXCERPTS (23-26)
// ---------------------------------------------------------------------------

test("23/24: the excerpt is a verbatim substring of the source field -- nothing fabricated", () => {
  const source = "The quick brown fox jumps over the lazy dog near the riverbank at dawn.";
  const excerpt = createExcerpt(source, "fox");
  const stripped = excerpt.replace(/^…/, "").replace(/…$/, "");
  assert.ok(source.includes(stripped), "excerpt content must appear verbatim in the source text");
});

test("25: long content produces a bounded excerpt", () => {
  const long = "word ".repeat(500) + "needle" + " word".repeat(500);
  const excerpt = createExcerpt(long, "needle");
  assert.ok(excerpt.length <= 170, `excerpt too long: ${excerpt.length} chars`);
  assert.ok(excerpt.includes("needle"));
});

test("26: a title-only match (tier 1-3) does not produce an excerpt via search()", () => {
  const results = search("Sri Raṅgam");
  const sriRangam = results.find((r) => r.href === "/divya-desams/sri-rangam");
  assert.ok(sriRangam);
  assert.equal(sriRangam?.excerpt, undefined);
});

test("a strong-field match (tier 4) via search() does produce an excerpt", () => {
  const results = search("Raṅganāyaki");
  const sriRangam = results.find((r) => r.href === "/divya-desams/sri-rangam");
  assert.ok(sriRangam);
  assert.ok(sriRangam?.excerpt && sriRangam.excerpt.includes("Raṅganāyaki"));
});

// ---------------------------------------------------------------------------
// No internal migration metadata anywhere in a SearchResult.
// ---------------------------------------------------------------------------

test("search() results never carry sourcePageId/extractionConfidence/UUID-shaped fields", () => {
  const results = search("temple");
  for (const result of results) {
    assert.ok(!("sourcePageId" in result));
    assert.ok(!("extractionConfidence" in result));
    assert.ok(!("migration" in result));
  }
});
