import test from "node:test";
import assert from "node:assert/strict";
import { normalizeResourceLanguage, transformMapsLink, transformPdfResource } from "../../../scripts/migration/links.ts";
import { UnsupportedResourceLabelError } from "../../../scripts/migration/errors.ts";
import { ResourceEntrySchema, ShrineSchema } from "../../../content-lib/schemas/index.ts";
import { makeMapsLink, makePdfLink } from "../../../scripts/fixtures/synthetic-source.ts";

// ---------------------------------------------------------------------------
// W. Google Maps links -> shrines[].
// ---------------------------------------------------------------------------

test("W: a google_maps_location link becomes a valid shrine with label + mapsLink", () => {
  const shrine = transformMapsLink(makeMapsLink({ url: "https://example.test/maps/a", sourceComponentLabel: "Maps" }));
  assert.equal(shrine.mapsLink, "https://example.test/maps/a");
  assert.equal(ShrineSchema.safeParse(shrine).success, true);
});

// ---------------------------------------------------------------------------
// Phase 6E-C: ShrineSchema's new optional per-shrine fields
// (name/templeInformation/sthalaPuranam/azhwarPasuram) are backwards
// compatible -- every one of the ~108 existing plain label/mapsLink
// shrine entries across the corpus must still validate unchanged.
// ---------------------------------------------------------------------------

test("Phase 6E-C: a plain label+mapsLink shrine (the pre-existing shape used by every single-shrine record) still validates with no new fields present", () => {
  const shrine = { label: "Maps", mapsLink: "https://example.test/maps/a" };
  const result = ShrineSchema.safeParse(shrine);
  assert.equal(result.success, true);
});

test("Phase 6E-C: a shrine carrying name/templeInformation/sthalaPuranam/azhwarPasuram validates", () => {
  const shrine = {
    label: "Map 1",
    mapsLink: "https://example.test/maps/a",
    name: "Example Shrine",
    templeInformation: { moolavar: "Example Perumal" },
    sthalaPuranam: "Example legend text.",
    azhwarPasuram: "Example pasuram text.",
  };
  const result = ShrineSchema.safeParse(shrine);
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// X. Generic "Maps" label -> label: null.
// ---------------------------------------------------------------------------

test('X: sourceComponentLabel "Maps" normalizes to label: null', () => {
  const shrine = transformMapsLink(makeMapsLink({ sourceComponentLabel: "Maps" }));
  assert.equal(shrine.label, null);
});

test("X: an empty/null sourceComponentLabel also normalizes to label: null", () => {
  assert.equal(transformMapsLink(makeMapsLink({ sourceComponentLabel: "" })).label, null);
  assert.equal(transformMapsLink(makeMapsLink({ sourceComponentLabel: null })).label, null);
});

// ---------------------------------------------------------------------------
// Y. Specific shrine labels extract the distinguishing name.
// ---------------------------------------------------------------------------

test('Y: "Maps- Example Shrine" extracts label "Example Shrine"', () => {
  const shrine = transformMapsLink(makeMapsLink({ sourceComponentLabel: "Maps- Example Shrine" }));
  assert.equal(shrine.label, "Example Shrine");
});

test('Y: "Maps (Example)" extracts label "Example"', () => {
  const shrine = transformMapsLink(makeMapsLink({ sourceComponentLabel: "Maps (Example)" }));
  assert.equal(shrine.label, "Example");
});

// ---------------------------------------------------------------------------
// Z. Multi-shrine labels ("Map 1", "Map 2") remain distinguishable.
// ---------------------------------------------------------------------------

test('Z: "Map 1" and "Map 2" remain distinct, non-null, non-collapsed labels', () => {
  const shrineOne = transformMapsLink(makeMapsLink({ sourceComponentLabel: "Map 1", url: "https://example.test/maps/1" }));
  const shrineTwo = transformMapsLink(makeMapsLink({ sourceComponentLabel: "Map 2", url: "https://example.test/maps/2" }));
  assert.equal(shrineOne.label, "Map 1");
  assert.equal(shrineTwo.label, "Map 2");
  assert.notEqual(shrineOne.label, shrineTwo.label);
});

// ---------------------------------------------------------------------------
// AA. PDF resource links -> resources[].
// ---------------------------------------------------------------------------

test('AA: a sloka_pdf_prapatti link becomes a valid resource with language, type "pasuram-pdf", and url', () => {
  const resource = transformPdfResource(makePdfLink({ sourceComponentLabel: "English Pasuram", url: "https://example.test/x.pdf" }));
  assert.equal(resource.language, "English");
  assert.equal(resource.type, "pasuram-pdf");
  assert.equal(resource.url, "https://example.test/x.pdf");
  assert.equal(ResourceEntrySchema.safeParse(resource).success, true);
});

// ---------------------------------------------------------------------------
// AB. Explicit language lookup table.
// ---------------------------------------------------------------------------

test("AB: every documented language label normalizes correctly via the explicit lookup table", () => {
  const table: Array<[string, string]> = [
    ["English Pasuram", "English"],
    ["English Pasurams", "English"],
    ["Tamizh Pasuram", "Tamil"],
    ["Tamizh Pasurams", "Tamil"],
    ["Kannada Pasuram", "Kannada"],
    ["Kannada Pasurams", "Kannada"],
    ["Sanskrit Pasuram", "Sanskrit"],
    ["Sanskrit Pasurams", "Sanskrit"],
    ["Devanagarii Pasuram", "Devanagari"],
    ["Telugu Pasuram", "Telugu"],
    ["Telugu Pasurams", "Telugu"],
  ];
  for (const [label, expected] of table) {
    assert.equal(normalizeResourceLanguage(label), expected, `expected "${label}" -> "${expected}"`);
  }
});

test("AB: an unrecognized label fails clearly rather than being guessed via substring matching", () => {
  // "French Pasuram" contains no substring overlap trick -- and even a
  // label that superficially resembles a known one (e.g. a typo) must
  // still fail rather than fuzzy-match.
  for (const badLabel of ["French Pasuram", "english pasuram", "English", "Pasuram", ""]) {
    assert.throws(
      () => normalizeResourceLanguage(badLabel),
      (err: unknown) => {
        assert.ok(err instanceof UnsupportedResourceLabelError);
        assert.equal(err.label, badLabel);
        return true;
      },
      `expected "${badLabel}" to be rejected`
    );
  }
});

// ---------------------------------------------------------------------------
// AC. URLs are preserved verbatim -- no rewriting, no normalization.
// ---------------------------------------------------------------------------

test("AC: URLs pass through both transformers completely unmodified", () => {
  const distinctiveMapsUrl = "https://example.test/maps/EXACT-SYNTHETIC-STRING-1?query=abc&x=1";
  const distinctivePdfUrl = "https://example.test/slokas/EXACT-SYNTHETIC-STRING-2.pdf";

  assert.equal(transformMapsLink(makeMapsLink({ url: distinctiveMapsUrl })).mapsLink, distinctiveMapsUrl);
  assert.equal(transformPdfResource(makePdfLink({ url: distinctivePdfUrl })).url, distinctivePdfUrl);
});
