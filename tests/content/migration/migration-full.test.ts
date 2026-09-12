import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BookSchema,
  ChapterSchema,
  DivyaDesamSchema,
  KnowledgeSchema,
} from "../../../content-lib/schemas/index.ts";

/**
 * Phase 5H reconciliation tests -- verify the ACTUAL migrated output under
 * /content against the frozen content-extraction/ snapshot, not merely the
 * pure transformation functions (already covered by earlier migration
 * test files). These tests read real files on both sides.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTENT_DD_DIR = path.join(REPO_ROOT, "content/divya-desams");
const CONTENT_LIBRARY_DIR = path.join(REPO_ROOT, "content/library");
const CONTENT_KNOWLEDGE_DIR = path.join(REPO_ROOT, "content/knowledge");
const CONTENT_UNRESOLVED_DIR = path.join(REPO_ROOT, "content/_unresolved");
const SOURCE_DD_DIR = path.join(REPO_ROOT, "content-extraction/divya-desams");
const SOURCE_ARTICLES_DIR = path.join(REPO_ROOT, "content-extraction/articles");
const IMAGE_MAP_FILE = path.join(REPO_ROOT, "content-extraction/image-map.json");

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function listJsonFiles(dir: string): string[] {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
}

const ddOutputFiles = listJsonFiles(CONTENT_DD_DIR);
const ddOutputRecords = ddOutputFiles.map((f) => readJson(path.join(CONTENT_DD_DIR, f)));

// This file is a frozen regression snapshot of the ONE Phase 5H/5I/6E
// migration event (content-extraction/ -> the original recovered book).
// content/library/ has since gained additional, independently-authored
// books (not sourced from content-extraction/ at all) -- so the original
// book directory is located by its known slug, never by array index,
// and this file's checks apply only to that one book, not to
// content/library/ as a whole.
const ORIGINAL_BOOK_SLUG = "untitled-recovered-book-pending-editorial-title";
const bookDirs = fs.readdirSync(CONTENT_LIBRARY_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());
const bookDir = bookDirs.find((d) => d.name === ORIGINAL_BOOK_SLUG);
const bookRecord = bookDir ? readJson(path.join(CONTENT_LIBRARY_DIR, bookDir.name, "book.json")) : null;
const chaptersDir = bookDir ? path.join(CONTENT_LIBRARY_DIR, bookDir.name, "chapters") : "";
const chapterFiles = bookDir ? listJsonFiles(chaptersDir) : [];
const chapterRecords = chapterFiles.map((f) => readJson(path.join(chaptersDir, f)));

const knowledgeFiles = listJsonFiles(CONTENT_KNOWLEDGE_DIR);
const knowledgeRecords = knowledgeFiles.map((f) => readJson(path.join(CONTENT_KNOWLEDGE_DIR, f)));

const unresolvedFiles = listJsonFiles(CONTENT_UNRESOLVED_DIR);
const unresolvedRecords = unresolvedFiles.map((f) => readJson(path.join(CONTENT_UNRESOLVED_DIR, f)));

// ---------------------------------------------------------------------------
// Complete expected record counts.
// ---------------------------------------------------------------------------

test("exactly 107 Divya Desam records exist in content/divya-desams/ (108 source records minus Page150, held back)", () => {
  assert.equal(ddOutputFiles.length, 107);
});

test("the original recovered book still exists, with exactly 51 chapters", () => {
  assert.ok(bookDir, `${ORIGINAL_BOOK_SLUG} directory missing from content/library/`);
  assert.equal(chapterFiles.length, 51);
});

test("exactly 1 Knowledge record exists", () => {
  assert.equal(knowledgeFiles.length, 1);
});

test("exactly 1 held-back unresolved record exists (Page150)", () => {
  assert.equal(unresolvedFiles.length, 1);
});

test("no unexpected content records: total /content file count matches exactly 107+51+1(book.json)+1+1+1(README)+15(_provenance/divya-desams, post image-fixes)+1(_provenance/library, Phase 6E)+1(_provenance/library, chapter needsReview corrections)+76(sri-rama-charithram: 1 book.json + 75 chapters)+32(srimad-bhagavata-kathasagaram: 1 book.json + 31 chapters)+71(jaya: 1 book.json + 70 chapters) = 358", () => {
  // Phase 6E added content/_provenance/ -- one small JSON file per Divya
  // Desam record that received a category-B text supplement and/or a
  // book-sourced image/shrine from "108 Divyadesam 2nd Edition.pdf" (101
  // of 107 records), plus one file recording that "A Brief Insight to
  // Visishtadvaita Philosophy.pdf" is the confirmed source for 17 of the
  // existing Library book's 55 chapters (see that phase's report for
  // both). Phase 6E-C added exactly ONE more (101 -> 102: Tanjai
  // Mamanikoyil had none yet; Tiruvaali Tirunagari's existing file only
  // gained appended entries). Three post-Phase-6E-C reviews then found:
  // (a) 149 of the 174 Phase 6E book images were near-duplicates of an
  // image the record already had (source-material/reports/
  // phase-6E-image-fixes-report.md); (b) 12 more were misattributed to
  // the WRONG adjacent temple by a page-boundary bug in the original
  // Phase 6E image merge (source-material/reports/
  // phase-6E-cross-record-duplicates-report.md); removing them also
  // removed their provenance entries, and enough of the 102 files became
  // completely empty to be deleted outright (a record whose ONLY Phase 6E
  // fact was a duplicate/misattributed image now correctly has no
  // provenance file at all): 102 -> 19 -> 14; and (c) a full-corpus
  // corruption audit found one more misattributed image (a river-ghat
  // photo wrongly under Tirumayam, reassigned to Tiruayodhi (Ayodhya),
  // which had no provenance file yet): 14 -> 15. A later page-boundary
  // root-cause fix (scripts/source-material/divyadesam-entries.ts) moved
  // 4 more misattributed images -- net zero change in file count here
  // (tirumayam's provenance file emptied out and was deleted, tiruvenkatam
  // gained its first provenance file). Then a full Library audit found 3
  // chapters whose source page is genuinely incomplete (containsPlaceholderText),
  // never flagged for review by the migration transform (which only derives
  // needsReview from Divya Desam classification, never from placeholder
  // detection) -- corrected directly, with one new provenance file
  // recording all 3 corrections: 15 -> 15 (divya-desams) + 1 new
  // (_provenance/library/chapter-needs-review.json). Not loaded by
  // content-lib/loader/ (mirrors the content/_unresolved/
  // precedent: a sidecar directory under content/ the loader never looks
  // inside), so it is deliberately still counted here rather than
  // excluded -- this test's whole purpose is to catch ANY unexpected
  // file under content/, intentional additions included. Sri Rama
  // Charithram (+8), Srimad Bhagavata Kathasagaram (+32), and JAYA (+70)
  // brought the total to 293. Then 4 misplaced Srimad Bhagavatham
  // fragment chapters were removed from the original recovered book
  // ("Srimad Bhagavatham", "Parīkṣit", "Mapping of Space and Time",
  // "Jaya and Vijaya" -- content belonging to a different narrative,
  // not this book's Visishtadvaita philosophy scope; one of the four,
  // page.Page168/"srimad-bhagavatham", was also 58/59ths literal "Lorem
  // ipsum" placeholder filler, never real content -- its
  // chapter-needs-review.json entry was removed too, leaving that file's
  // own size unchanged in this count): 293 -> 289. The book's status and
  // every remaining chapter's status also moved draft -> published at
  // the same time (see the "B:" status tests below), removing the
  // now-inaccurate "Draft -- under review" badge. Sri Rama Charithram's
  // 7 Kanda-level chapters were then each split into their traditional
  // internal sub-sections (75 total, one Chapter record per section
  // instead of one per Kanda -- see content/library/sri-rama-charithram/
  // book.json's chapterOrder), replacing the 7 chapter files with 75:
  // 289 -> 357 (net +68, the book.json itself unchanged). JAYA's source
  // PDF included a distinct front-matter Invocation page (preceding
  // Chapter 1, not part of it), split out as its own chapter record per
  // content/library/jaya/book.json's chapterOrder: 357 -> 358 (net +1,
  // jaya: 69 -> 70 chapters).
  const total = countFilesRecursive(path.join(REPO_ROOT, "content"));
  assert.equal(total, 358);
});

function countFilesRecursive(dir: string): number {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFilesRecursive(path.join(dir, entry.name));
    else count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Page5 remains intact.
// ---------------------------------------------------------------------------

test("Page5 remains intact: content/divya-desams/sri-rangam.json is present and traceable to page.Page5", () => {
  const sriRangam = ddOutputRecords.find((r) => r.slug === "sri-rangam");
  assert.ok(sriRangam, "sri-rangam.json missing from the migrated set");
  assert.equal(sriRangam.migration.sourcePageId, "page.Page5");
  assert.equal(sriRangam.status, "published");
});

// ---------------------------------------------------------------------------
// Page93 treatment.
// ---------------------------------------------------------------------------

test("Page93 (Tirukoodal) migrated as a normal DivyaDesam: published, needsReview, low confidence, no fabricated Maps link at SAP-migration time", () => {
  const record = ddOutputRecords.find((r) => r.migration.sourcePageId === "page.Page93");
  assert.ok(record, "Page93 missing from migrated Divya Desams");
  assert.equal(record.status, "published");
  assert.equal(record.migration.needsReview, true);
  assert.equal(record.migration.extractionConfidence, "low");
  // The SAP migration itself produced no shrines (no Maps link existed in
  // that source) -- Phase 6E later added exactly 1 real, disclosed shrine
  // decoded from "108 Divyadesam 2nd Edition.pdf"'s own QR code (see
  // content/_provenance/divya-desams/tirukoodal.json), still not
  // fabricated, just sourced from a different, later book.
  assert.equal(record.shrines.length, 1);
  assert.equal(record.shrines[0].mapsLink, PHASE_6E_SHRINE_LINKS.tirukoodal);
  assert.ok(record.templeInformation.moolavar, "expected Page93's real temple-shaped content to be preserved");
  assert.ok(record.sthalaPuranam, "expected Page93's Sthala Puranam to be preserved");
});

// ---------------------------------------------------------------------------
// Page150 held-back treatment.
// ---------------------------------------------------------------------------

test("Page150 (Hayagriva Stotram) is held back, not classified as any normal content type, links preserved", () => {
  assert.equal(unresolvedRecords.length, 1);
  const held = unresolvedRecords[0];
  assert.equal(held.sourcePageId, "page.Page150");
  assert.equal(held.title, "Hayagriva Stotram");
  assert.equal(held.extractionConfidence, "low");
  assert.equal(held.needsReview, true);
  assert.equal("slug" in held, false);
  assert.equal("contentType" in held, false);
  assert.equal("templeInformation" in held, false);
  assert.equal("status" in held, false);
  assert.equal(held.rawExternalLinks.length, 4, "expected all 4 Hayagriva Stotram PDF links to be preserved");

  // Cannot masquerade as / validate against any normal destination schema.
  assert.equal(DivyaDesamSchema.safeParse(held).success, false);
  assert.equal(ChapterSchema.safeParse(held).success, false);
  assert.equal(KnowledgeSchema.safeParse(held).success, false);

  // Must NOT appear in any normal content collection.
  assert.equal(ddOutputRecords.some((r) => r.migration.sourcePageId === "page.Page150"), false);
  assert.equal(chapterRecords.some((r) => r.migration.sourcePageId === "page.Page150"), false);
  assert.equal(knowledgeRecords.some((r) => r.migration.sourcePageId === "page.Page150"), false);
});

// ---------------------------------------------------------------------------
// Multi-shrine ambiguous-label fallback (Page24/38/40) -- discovered
// during Phase 6E's real run.
//
// Page24, Page38, and Page40 (Tanjai Mamanikoyil, Tiruvaali Tirunagari,
// Tiruttetriambalam Tirumanikoodam) all remained genuinely ambiguous at
// the RECORD level through Phase 6E (their own book entries also failed
// to parse unambiguously as one flat templeInformation object -- see
// source-material/reports/). Phase 6E-C then extended ShrineSchema with
// a per-shrine templeInformation slot and supplemented all three
// records' shrines[] individually (each shrine's own Moolavar/Thayaar/
// etc. is unambiguous once split per shrine) plus their record-level
// travelNote/sthalaPuranam/azhwarPasuram (which the source presents
// once, for the whole record, not per shrine) -- see
// content/_provenance/divya-desams/{tanjai-mamanikoyil,
// tiruvaali-tirunagari,tiruttetriambalam-tirumanikoodam}.json.
// Record-level moolavar/thayaar/vimanam/theertham remain genuinely
// absent for all three, since the source never gives a single value for
// those at the record level.
//
// Page40 specifically: an initial Phase 6E pass supplemented a flat
// record-level templeInformation from the book, on the mistaken
// assumption the book gave one consistent set of fields for the whole
// record. A later review found the book's own entry for this record
// actually has TWO separate "Details of Kshethram:" blocks (one per
// shrine, 36/37) -- the source-material import tool's entry-boundary
// detection (anchored on every such marker) split them into two book
// "entries," one with a real title and one with a bogus title captured
// from stray trailing text, which never matched any of the 107 records
// and was silently dropped as an unmatched entry (flagged for human
// review in the original report, never silently discarded). That left
// shrine 2's own fields AND the record's entire sthalaPuranam (shared
// between both shrines, so it lived after the second marker) completely
// missing. Corrected: shrine 1's data moved out of the record level into
// shrines[0], shrine 2's data recovered into shrines[1], and the missing
// sthalaPuranam recovered -- Page40 now follows the exact same
// structure as Page24/Page38.
// ---------------------------------------------------------------------------

test("the 3 multi-shrine records with ambiguous per-shrine labels (Page24, Page38, Page40) migrated with needsReview true and full shrines/images/resources preserved; none has a record-level moolavar/thayaar/vimanam/theertham -- their per-shrine facts live in shrines[] instead", () => {
  for (const pageId of ["page.Page24", "page.Page38", "page.Page40"]) {
    const record = ddOutputRecords.find((r) => r.migration.sourcePageId === pageId);
    assert.ok(record, `${pageId} missing from migrated Divya Desams`);
    for (const shortField of ["moolavar", "thayaar", "vimanam", "theertham"]) {
      assert.ok(
        !record.templeInformation[shortField],
        `${pageId} should not have a record-level ${shortField} -- the source never gives one value for the whole record; it's per-shrine in shrines[] instead`
      );
    }
    assert.equal(record.migration.needsReview, true);
    assert.ok(record.shrines.length > 0, `${pageId} should still have its shrines preserved`);
    assert.ok(record.images.length > 0, `${pageId} should still have its images preserved`);
    assert.ok(record.resources.length > 0, `${pageId} should still have its resources preserved`);
  }
});

test("Phase 6E-C: Page24 (Tanjai Mamanikoyil), Page38 (Tiruvaali Tirunagari), and Page40 (Tiruttetriambalam Tirumanikoodam) each have a record-level travelNote and per-shrine templeInformation on every shrine, without a moolavar/thayaar/vimanam/theertham at the record level", () => {
  for (const pageId of ["page.Page24", "page.Page38", "page.Page40"]) {
    const record = ddOutputRecords.find((r) => r.migration.sourcePageId === pageId);
    assert.ok(record, `${pageId} missing from migrated Divya Desams`);
    assert.ok(record.templeInformation.travelNote, `${pageId} should have a record-level travelNote`);
    assert.ok(record.sthalaPuranam, `${pageId} should have a record-level sthalaPuranam`);
    assert.ok(record.azhwarPasuram, `${pageId} should have a record-level azhwarPasuram`);
    for (const shrine of record.shrines) {
      assert.ok(shrine.templeInformation, `${pageId}: every shrine should have its own templeInformation`);
      assert.ok(
        shrine.templeInformation.moolavar,
        `${pageId}: every shrine's own templeInformation should include a moolavar`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// B. Status: every normal migrated content record has status "draft",
// except the original recovered Book/its chapters, which were
// deliberately finalized to "published" once its 4 misplaced chapters
// were removed (see the file-count test above).
// ---------------------------------------------------------------------------

test("B: every Divya Desam record has status published", () => {
  for (const r of ddOutputRecords) assert.equal(r.status, "published", r.slug);
});

test("B: every chapter has status published", () => {
  for (const c of chapterRecords) assert.equal(c.status, "published", c.slug);
});

test("B: the Knowledge record has status draft", () => {
  for (const k of knowledgeRecords) assert.equal(k.status, "draft", k.slug);
});

test("B: the Book has status published", () => {
  assert.equal(bookRecord.status, "published");
});

// ---------------------------------------------------------------------------
// E. Traceability: every migrated record's sourcePageId maps back to a
// real source record.
// ---------------------------------------------------------------------------

test("E: every Divya Desam record's sourcePageId maps to a real content-extraction/divya-desams file", () => {
  for (const r of ddOutputRecords) {
    const sourcePath = path.join(SOURCE_DD_DIR, `${r.migration.sourcePageId}.json`);
    assert.ok(fs.existsSync(sourcePath), `no source file for ${r.migration.sourcePageId}`);
  }
});

test("E: every chapter's sourcePageId maps to a real content-extraction/articles file", () => {
  for (const c of chapterRecords) {
    const sourcePath = path.join(SOURCE_ARTICLES_DIR, `${c.migration.sourcePageId}.json`);
    assert.ok(fs.existsSync(sourcePath), `no source file for ${c.migration.sourcePageId}`);
  }
});

test("E: every source Divya Desam record maps to exactly one destination (107 normal + Page150 held back = 108)", () => {
  const sourceFiles = fs.readdirSync(SOURCE_DD_DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
  assert.equal(sourceFiles.length, 108);
  const migratedSourceIds = new Set(ddOutputRecords.map((r) => r.migration.sourcePageId));
  migratedSourceIds.add(unresolvedRecords[0].sourcePageId);
  assert.equal(migratedSourceIds.size, 108);
});

test("E: every source article record maps to exactly one destination, except 4 deliberately-dropped pages (51 chapters + 1 Knowledge + 4 dropped = 56)", () => {
  // page.Page168-171 ("Srimad Bhagavatham", "Parīkṣit", "Mapping of Space
  // and Time", "Jaya and Vijaya") were migrated as chapters 168-171 of
  // this book, but were later found not to belong to its Visishtadvaita
  // philosophy scope at all -- they were fragments of a different
  // narrative (Srimad Bhagavatam), and page.Page168 was additionally
  // 58/59ths literal "Lorem ipsum" placeholder filler, never real
  // content. All 4 chapter files were deleted directly (not re-routed
  // to content/_unresolved/, since they were fully formed migrated
  // records, not ambiguous source data the way Page150 was).
  const DROPPED_SOURCE_IDS = new Set(["page.Page168", "page.Page169", "page.Page170", "page.Page171"]);
  const sourceFiles = fs.readdirSync(SOURCE_ARTICLES_DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
  assert.equal(sourceFiles.length, 56);
  const migratedSourceIds = new Set(chapterRecords.map((c) => c.migration.sourcePageId));
  for (const k of knowledgeRecords) migratedSourceIds.add(k.migration.sourcePageId);
  assert.equal(migratedSourceIds.size, 52);
  for (const id of DROPPED_SOURCE_IDS) assert.ok(!migratedSourceIds.has(id), `${id} should have been dropped`);
  assert.equal(migratedSourceIds.size + DROPPED_SOURCE_IDS.size, 56);
});

// ---------------------------------------------------------------------------
// F. Images: every destination image reference resolves to a real source asset.
// ---------------------------------------------------------------------------

test("F: every SAP-migrated image reference resolves to a real image-map.json asset", () => {
  // Phase 6E appended images sourced from "108 Divyadesam 2nd Edition.pdf"
  // (assetId containing "-book-") to 101 records -- new source assets
  // that were never part of the original SAP export and therefore
  // correctly have no image-map.json entry. Excluded from this check,
  // which is specifically about the SAP migration's own image resolution.
  const imageMap = readJson(IMAGE_MAP_FILE);
  const knownUuids = new Set(imageMap.images.map((i: any) => i.assetUuid));
  const allRecords = [...ddOutputRecords, ...chapterRecords, ...knowledgeRecords];
  let checked = 0;
  for (const record of allRecords) {
    for (const image of record.images ?? []) {
      if (image.assetId.includes("-book-")) continue;
      assert.ok(knownUuids.has(image.sourceAssetUuid), `unresolvable image UUID ${image.sourceAssetUuid} in ${record.slug}`);
      assert.equal(image.altStatus, "needs-review");
      assert.equal(image.alt, null);
      checked++;
    }
  }
  assert.ok(checked > 0);
});

test("shared-image preservation: the 4 previously-identified multi-page images still resolve to the same sourceAssetUuid across their respective records", () => {
  // From Phase 5A: 573d5ea0 (Page48<->Page121), 5e651812 & c0c018d2 (Page90<->Page128), 92013b6d (Page4<->Page113)
  const sharedPairs = [
    { uuid: "573d5ea0-69a2-40bb-b2d1-da6c83762939", pageIds: ["page.Page48", "page.Page121"] },
    { uuid: "5e651812-9ae4-4dc9-b662-867b39bf040e", pageIds: ["page.Page90", "page.Page128"] },
    { uuid: "c0c018d2-6c1c-481b-a883-b1b003b54daf", pageIds: ["page.Page90", "page.Page128"] },
    { uuid: "92013b6d-dbc5-4481-a56a-31355a9d5b64", pageIds: ["page.Page4", "page.Page113"] },
  ];
  const allRecords = [...ddOutputRecords, ...chapterRecords, ...knowledgeRecords];
  for (const { uuid, pageIds } of sharedPairs) {
    for (const pageId of pageIds) {
      const record = allRecords.find((r) => r.migration.sourcePageId === pageId);
      assert.ok(record, `record for ${pageId} not found`);
      const hasImage = (record.images ?? []).some((img: any) => img.sourceAssetUuid === uuid);
      assert.ok(hasImage, `expected ${pageId} to reference shared image ${uuid}`);
    }
  }
});

// ---------------------------------------------------------------------------
// G. External links: every migrated URL matches the source URL verbatim.
// ---------------------------------------------------------------------------

// Phase 6E decoded this book's own per-page Google Maps QR code and added
// exactly one shrine each to the 3 records that had none from the SAP
// migration (see content/_provenance/divya-desams/<slug>.json for each).
// These mapsLink values are real, but sourced from "108 Divyadesam 2nd
// Edition.pdf", not from the original content-extraction/ snapshot this
// test otherwise verifies every URL against verbatim.
const PHASE_6E_SHRINE_LINKS: Record<string, string> = {
  tirukoodal:
    "https://www.google.com/maps/place/Shri+Koodal+Azhagar+Temple/@9.914401,78.114107,16z/data=!4m5!3m4!1s0x0:0xeaf7f217a7990866!8m2!3d9.914401!4d78.1141066?hl=en",
  "tirudevanaar-togai":
    "https://www.google.com/maps/place/Divya+Desam+35+Deiva+Nayaka+Perumal+Temple/@11.196831,79.775537,16z/data=!4m5!3m4!1s0x0:0xc6825c3dea416f9c!8m2!3d11.1968161!4d79.7755367?hl=en",
  tirumaaliruncholai:
    "https://www.google.com/maps/place/Arulmigu+Kallalagar+Temple,+Allagar+Temple/@10.074847,78.213097,16z/data=!4m5!3m4!1s0x0:0x8dd0f3238544b80e!8m2!3d10.0748469!4d78.2130969?hl=en",
};

test("G: every SAP-migrated shrine mapsLink and resource url in every Divya Desam matches its source record's externalLinks verbatim", () => {
  let checked = 0;
  for (const record of ddOutputRecords) {
    const sourcePath = path.join(SOURCE_DD_DIR, `${record.migration.sourcePageId}.json`);
    const source = readJson(sourcePath);
    const sourceUrls = new Set(source.externalLinks.map((l: any) => l.url));
    for (const shrine of record.shrines) {
      if (PHASE_6E_SHRINE_LINKS[record.slug] === shrine.mapsLink) continue;
      assert.ok(sourceUrls.has(shrine.mapsLink), `${record.slug}: unexpected shrine URL ${shrine.mapsLink}`);
      checked++;
    }
    for (const resource of record.resources) {
      assert.ok(sourceUrls.has(resource.url), `${record.slug}: unexpected resource URL ${resource.url}`);
      checked++;
    }
  }
  assert.ok(checked > 400, `expected several hundred URLs checked, got ${checked}`);
});

// ---------------------------------------------------------------------------
// H. Chapters: ordering correct, no duplicates within the book.
// ---------------------------------------------------------------------------

test("H: chapter order values are all unique within the one book", () => {
  const orders = chapterRecords.map((c) => c.order);
  assert.equal(new Set(orders).size, orders.length);
});

test("H: book.chapterOrder lists exactly the 51 chapter slugs, in ascending order value", () => {
  assert.equal(bookRecord.chapterOrder.length, 51);
  const sortedBySlugOrder = [...chapterRecords].sort((a, b) => a.order - b.order).map((c) => c.slug);
  assert.deepEqual(bookRecord.chapterOrder, sortedBySlugOrder);
});

// ---------------------------------------------------------------------------
// I. Slugs: no duplicate destination slugs (within each collection).
// ---------------------------------------------------------------------------

test("I: no duplicate slugs among the 107 Divya Desam records", () => {
  const slugs = ddOutputRecords.map((r) => r.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("I: no duplicate slugs among the 51 chapters", () => {
  const slugs = chapterRecords.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

// ---------------------------------------------------------------------------
// J. Schema: every generated normal content record passes its destination
// Zod schema (re-validated independently here, not trusting the runner).
// ---------------------------------------------------------------------------

test("J: every migrated Divya Desam independently passes DivyaDesamSchema", () => {
  for (const r of ddOutputRecords) {
    const result = DivyaDesamSchema.safeParse(r);
    assert.equal(result.success, true, `${r.slug}: ${result.success ? "" : JSON.stringify(result.error?.issues)}`);
  }
});

test("J: every migrated chapter independently passes ChapterSchema", () => {
  for (const c of chapterRecords) {
    const result = ChapterSchema.safeParse(c);
    assert.equal(result.success, true, `${c.slug}: ${result.success ? "" : JSON.stringify(result.error?.issues)}`);
  }
});

test("J: the Knowledge record independently passes KnowledgeSchema", () => {
  for (const k of knowledgeRecords) {
    const result = KnowledgeSchema.safeParse(k);
    assert.equal(result.success, true);
  }
});

test("J: the Book independently passes BookSchema", () => {
  const result = BookSchema.safeParse(bookRecord);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// Known empty gaps not migrated.
// ---------------------------------------------------------------------------

test("known source gaps (Page112, Page115, Page116) were NOT migrated to any content record", () => {
  const allRecords = [...ddOutputRecords, ...chapterRecords, ...knowledgeRecords, ...unresolvedRecords];
  for (const gapPageId of ["page.Page112", "page.Page115", "page.Page116"]) {
    const found = allRecords.some(
      (r) => r.migration?.sourcePageId === gapPageId || r.sourcePageId === gapPageId
    );
    assert.equal(found, false, `${gapPageId} should not have been migrated`);
  }
});

test("Page117 (which does not exist in the source at all) was not fabricated", () => {
  const allRecords = [...ddOutputRecords, ...chapterRecords, ...knowledgeRecords, ...unresolvedRecords];
  const found = allRecords.some(
    (r) => r.migration?.sourcePageId === "page.Page117" || r.sourcePageId === "page.Page117"
  );
  assert.equal(found, false);
});
