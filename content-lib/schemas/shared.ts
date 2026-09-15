import { z } from "zod";

export * from "./language.ts";

/**
 * Shared building blocks used across every content type (Divya Desam,
 * Book, Chapter, Knowledge). Kept deliberately small — only what multiple
 * content types actually need in common. Do not add fields here "for
 * later"; extend individual content schemas instead if something turns
 * out to be type-specific.
 */

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Publication status. STRUCTURAL SAFETY RULE (Phase 5A, corrected):
 * every content schema's `status` field must use `StatusSchema` as defined
 * here so that omitting `status` always produces `"draft"`, never
 * `"published"`. No content schema may override this default.
 */
export const ContentStatusSchema = z.enum(["draft", "published"]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const StatusSchema = ContentStatusSchema.default("draft");

// ---------------------------------------------------------------------------
// Migration metadata
// ---------------------------------------------------------------------------

/**
 * Technical extraction confidence from the Phase 3 pipeline. This is a
 * signal about how confident the AUTOMATED CLASSIFICATION was — it is
 * metadata about the extraction process, not editorial judgment, and it
 * must never be used to derive or influence `status`.
 *
 * Three values, not two: Phase 3's Divya Desam classification
 * (`content-extraction/divya-desams/`) only ever produces "high" or
 * "low". Its separate non-temple classification
 * (`content-extraction/articles/`) independently produces "medium" for
 * every one of its 56 records. Both are real, observed values in the
 * frozen extraction snapshot — discovered during Phase 5H when migrating
 * the 55 book chapters + 1 Knowledge record for the first time. "medium"
 * was added here rather than coerced to "high"/"low" at migration time,
 * which would have fabricated metadata that doesn't reflect the source.
 */
export const ExtractionConfidenceSchema = z.enum(["high", "medium", "low"]);
export type ExtractionConfidence = z.infer<typeof ExtractionConfidenceSchema>;

/**
 * Reusable migration/provenance metadata. Every migrated record carries
 * this so it remains traceable back to its exact source page in
 * `content-extraction/`, per the Phase 5A migration-safety requirements.
 *
 * Deliberately minimal: this is NOT a reproduction of the full source
 * classification object (evidence, method, componentCounts, etc.) — only
 * the three fields needed for traceability and review-gating are kept.
 */
export const MigrationMetadataSchema = z.object({
  sourcePageId: z.string().min(1),
  extractionConfidence: ExtractionConfidenceSchema,
  needsReview: z.boolean(),
});
export type MigrationMetadata = z.infer<typeof MigrationMetadataSchema>;

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

/**
 * Lowercase kebab-case only: one or more alphanumeric segments separated
 * by single hyphens. No leading/trailing hyphens, no doubled hyphens, no
 * uppercase, no underscores/spaces.
 *
 * Passes: "sri-rangam", "tirukkozhi-urayur", "tirudwarkai-dwarka",
 *         "tiruparkadal-ksheerabdi"
 * Fails:  "Sri Rangam", "sri_rangam", "sri--rangam", "-sri-rangam",
 *         "sri-rangam-"
 *
 * This validates SHAPE only. Slug *generation* from recovered titles is
 * Phase 5E/5F migration logic, not part of this schema.
 */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const SlugSchema = z
  .string()
  .min(1)
  .regex(SLUG_PATTERN, "Slug must be lowercase kebab-case (e.g. \"sri-rangam\")");

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * Accessibility/provenance status for an image's alt text, distinguishing
 * "nobody has reviewed this yet" from an actual editorial decision that
 * the image needs no alt text. Defaults to "needs-review" because no
 * migrated image has real alt text to inherit from the source — alt text
 * must never be fabricated.
 */
export const ImageAltStatusSchema = z.enum([
  "needs-review",
  "confirmed-meaningful",
  "confirmed-decorative",
]);
export type ImageAltStatus = z.infer<typeof ImageAltStatusSchema>;

/**
 * Where an image renders relative to a record's long-form text, when
 * that matters. "default" renders in the record's normal top-of-page
 * image gallery -- the original app's own layout for the large majority
 * of images (verified per-record from content-extraction/'s frozen
 * contentBlocks order: pictures almost always precede the Sthala Puranam
 * text block there). "after-sthala-puranam" is set only when the source
 * itself placed an image AFTER that text (e.g. photos illustrating a
 * multi-shrine narrative like Singavelkundram/Ahobilam's nine Narasimha
 * forms, or a temple's Utsavam story) -- derived mechanically from that
 * same frozen ordering, never guessed. Named for Divya Desam's Sthala
 * Puranam specifically (the only long-form field this currently applies
 * to); would need a more general value if Chapters/Knowledge ever need
 * the same treatment.
 */
export const ImagePlacementSchema = z.enum(["default", "after-sthala-puranam"]);
export type ImagePlacement = z.infer<typeof ImagePlacementSchema>;

/**
 * A single image reference, attachable to any content type. The same
 * asset (same assetId/sourceAssetUuid) may legitimately appear on more
 * than one content record — Phase 5A confirmed 4 such shared-asset cases
 * in the source data. This schema does not and must not enforce
 * one-record-per-asset; that would contradict the actual source data.
 */
export const ImageEntrySchema = z.object({
  /** New, stable identifier assigned during migration (not ag-asset://). */
  assetId: z.string().min(1),
  /** The original extracted UUID, preserved for traceability only. */
  sourceAssetUuid: z.string().min(1),
  /** The original pre-export filename (e.g. "Jaya.jpg"), preserved for provenance. */
  sourceOriginalName: z.string().min(1),
  /** Alt text. Never fabricated — null until a human supplies real text. */
  alt: z.string().nullable(),
  altStatus: ImageAltStatusSchema.default("needs-review"),
  /**
   * Optional, not defaulted: unlike altStatus (every image genuinely has
   * SOME alt-review state), most images have no need for this field at
   * all -- only the minority the source placed after Sthala Puranam set
   * it. `.default()` would make this REQUIRED in the inferred TS output
   * type, breaking every existing call site (scripts/migration/images.ts
   * among them) that constructs an ImageEntry without ever knowing about
   * placement.
   */
  placement: ImagePlacementSchema.optional(),
  /**
   * Only meaningful when placement is "after-sthala-puranam": a specific
   * LINE, copied verbatim from the record's own `sthalaPuranam` string,
   * that this image should render immediately after -- e.g. a named
   * sub-shrine heading ("1. BHARGAVA NARASIMHA SWAMY", "Beyt Dwarka:")
   * within a record that covers several. Absent means the source gave no
   * confidently-identifiable sub-heading for this image; it renders in
   * the undifferentiated group after the whole Sthala Puranam text
   * instead (never a regression -- only an upgrade where confident).
   * Always a real substring of `sthalaPuranam` itself, never invented.
   */
  placementAnchor: z.string().min(1).optional(),
});
export type ImageEntry = z.infer<typeof ImageEntrySchema>;

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

/**
 * The set of content types a relationship may point at. This mirrors the
 * content types actually implemented in this phase — it is not a general
 * "SAP navigation edge" model and is not related to the old app's
 * internalNavigationOutEdges structure.
 */
export const RelatedContentTypeSchema = z.enum([
  "divya-desam",
  "book",
  "chapter",
  "knowledge",
]);
export type RelatedContentType = z.infer<typeof RelatedContentTypeSchema>;

/**
 * Minimal relationship reference: identifies WHAT is related (type + slug)
 * only. This schema validates shape only. Whether the referenced slug
 * actually exists is a cross-record concern for the post-migration
 * validation stage (Phase 5I), not this schema.
 */
export const RelatedContentRefSchema = z.object({
  type: RelatedContentTypeSchema,
  slug: SlugSchema,
});
export type RelatedContentRef = z.infer<typeof RelatedContentRefSchema>;

// ---------------------------------------------------------------------------
// Languages / translations
//
// LanguageCodeSchema/LanguageCode/LanguageOption/SUPPORTED_LANGUAGES now
// live in ./language.ts (re-exported above) -- see that file's doc
// comment for why.
// ---------------------------------------------------------------------------

/**
 * A per-language translations object shape shared by every content type:
 * `{ ta?: T, kn?: T, hi?: T }`, each entry independently optional so a
 * record can carry a translation for one language without needing all
 * three. Explicit object (not `z.record`) so an absent language is
 * simply an absent key, never a key that must be present-but-undefined.
 */
export function translationsSchemaFor<T extends z.ZodType>(languageShape: T) {
  return z.object({
    ta: languageShape.optional(),
    kn: languageShape.optional(),
    hi: languageShape.optional(),
  });
}
