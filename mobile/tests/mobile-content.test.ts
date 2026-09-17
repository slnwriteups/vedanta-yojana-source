import test from "node:test";
import assert from "node:assert/strict";
import { toMobileDivyaDesam, toMobileChapter } from "../../content-lib/mobile-content-transform.ts";
import { MobileDivyaDesamSchema, MobileChapterSchema, MobileChapterSummarySchema } from "../../content-lib/mobile-content.ts";
import type { DivyaDesam, Chapter } from "../../content-lib/schemas/index.ts";

/**
 * Regression test for the mobile Hermes-bundle metadata leak: a
 * representative record carrying every internal migration/provenance
 * field (migration.sourcePageId, migration.extractionConfidence,
 * images[].sourceOriginalName) must come out of toMobileDivyaDesam()/
 * toMobileChapter() with none of them present, while legitimate public
 * fields (status, migration.needsReview, images[].sourceAssetUuid, and
 * the derived sourceOrder) survive. This is the exact private-record
 * shape mobile/scripts/generate-content-manifest.ts reads from /content
 * at generation time -- if this test passes, no internal field can reach
 * mobile/content-lib/manifest.generated.ts, and therefore cannot reach
 * the compiled Hermes bundle either.
 */

const FAKE_DIVYA_DESAM: DivyaDesam = {
  slug: "test-temple",
  displayName: "Test Temple",
  status: "published",
  migration: {
    sourcePageId: "page.Page42",
    extractionConfidence: "high",
    needsReview: true,
  },
  templeInformation: { moolavar: "Test Moolavar" },
  shrines: [],
  images: [
    {
      assetId: "asset-1",
      sourceAssetUuid: "11111111-1111-1111-1111-111111111111",
      sourceOriginalName: "IMG_2043.jpg",
      alt: null,
      altStatus: "needs-review",
    },
  ],
  resources: [],
  relatedContent: [],
};

const FAKE_CHAPTER: Chapter = {
  title: "Test Chapter",
  slug: "test-chapter",
  order: 1,
  status: "published",
  migration: {
    sourcePageId: "upload:test-book#test-chapter",
    extractionConfidence: "medium",
    needsReview: false,
  },
  body: "Some chapter body text.",
  images: [
    {
      assetId: "asset-2",
      sourceAssetUuid: "22222222-2222-2222-2222-222222222222",
      sourceOriginalName: "Original Scan.png",
      alt: null,
      altStatus: "needs-review",
    },
  ],
};

test("toMobileDivyaDesam() strips all internal provenance fields, keeps legitimate public fields", () => {
  const mobile = toMobileDivyaDesam(FAKE_DIVYA_DESAM, 42);
  const serialized = JSON.stringify(mobile);

  for (const forbidden of ["sourcePageId", "extractionConfidence", "sourceOriginalName", "page.Page42", "IMG_2043.jpg"]) {
    assert.ok(!serialized.includes(forbidden), `expected "${forbidden}" to be absent, found in: ${serialized}`);
  }

  assert.equal(mobile.migration.needsReview, true);
  assert.equal(mobile.status, "published");
  assert.equal(mobile.sourceOrder, 42);
  assert.equal(mobile.images[0].sourceAssetUuid, "11111111-1111-1111-1111-111111111111");
  assert.equal(mobile.displayName, "Test Temple");

  assert.equal(MobileDivyaDesamSchema.safeParse(mobile).success, true);
});

test("toMobileChapter() strips all internal provenance fields, keeps legitimate public fields", () => {
  const mobile = toMobileChapter(FAKE_CHAPTER);
  const serialized = JSON.stringify(mobile);

  for (const forbidden of ["sourcePageId", "extractionConfidence", "sourceOriginalName", "upload:test-book", "Original Scan.png"]) {
    assert.ok(!serialized.includes(forbidden), `expected "${forbidden}" to be absent, found in: ${serialized}`);
  }

  assert.equal(mobile.migration.needsReview, false);
  assert.equal(mobile.body, "Some chapter body text.");
  assert.equal(mobile.images[0].sourceAssetUuid, "22222222-2222-2222-2222-222222222222");
  assert.equal(mobile.order, 1);

  assert.equal(MobileChapterSchema.safeParse(mobile).success, true);
});

test("MobileChapterSummarySchema: a chapter summary never carries body, images, or provenance fields, even if handed a raw private chapter", () => {
  // Regression test for the book-bundle-removal work: the whole point of
  // MobileChapterSummarySchema (bundled into every Hermes build via
  // mobile/scripts/generate-content-manifest.ts's toChapterSummary()) is
  // that a chapter's large/sensitive fields never reach it in the first
  // place. Proven here the same way the tests above prove it for
  // toMobileChapter(): .safeParse() a value that DOES carry every
  // forbidden field, and confirm the schema rejects extra keys it
  // doesn't declare rather than silently passing them through.
  const rawWithExtraFields = {
    title: FAKE_CHAPTER.title,
    slug: FAKE_CHAPTER.slug,
    order: FAKE_CHAPTER.order,
    status: FAKE_CHAPTER.status,
    migration: { needsReview: false },
    body: FAKE_CHAPTER.body,
    images: FAKE_CHAPTER.images,
    sourcePageId: "upload:test-book#test-chapter",
  };
  const parsed = MobileChapterSummarySchema.parse(rawWithExtraFields);
  const serialized = JSON.stringify(parsed);
  for (const forbidden of ["body", "images", "sourcePageId", "Some chapter body text", "Original Scan.png"]) {
    assert.ok(!serialized.includes(forbidden), `expected "${forbidden}" to be absent from a chapter summary, found in: ${serialized}`);
  }
});
