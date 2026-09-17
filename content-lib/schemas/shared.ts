import { z } from "zod";
import { ImageAltStatusSchema, ImagePlacementSchema } from "./shared-safe.ts";

export * from "./shared-safe.ts";

/**
 * The internal-only half of the old shared.ts: migration/provenance
 * metadata and the image entry shape that carries `sourceOriginalName`.
 * Split out from the genuinely public building blocks (now
 * shared-safe.ts) so that content-lib/mobile-content.ts -- and anything
 * else that must never bundle these field names into a public runtime --
 * can import the safe half without also importing this one. See
 * shared-safe.ts's own doc comment for the full "why".
 */

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
// Images
// ---------------------------------------------------------------------------

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
