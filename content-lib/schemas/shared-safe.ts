import { z } from "zod";

export * from "./language.ts";

/**
 * The genuinely public half of shared.ts's building blocks -- split out
 * for the exact same reason divya-desam-region.ts/language.ts were
 * already split out of divya-desam.ts/shared.ts: Metro (React Native's
 * bundler) bundles a whole ES module as one unit, not export-by-export.
 * content-lib/mobile-content.ts needs to import SlugSchema, StatusSchema,
 * etc. without also pulling in shared.ts's MigrationMetadataSchema/
 * ImageEntrySchema definitions (and therefore their internal field names
 * -- sourcePageId, extractionConfidence, sourceOriginalName -- as string
 * literals) into the compiled mobile Hermes bundle. Importing from
 * shared.ts directly, even for an unrelated export, would have dragged
 * those definitions along too, since shared.ts's own top-level code
 * executes in full whenever anything imports from it. This module has no
 * import reaching back into shared.ts, so nothing that imports from here
 * can transitively reach the unsafe definitions either.
 *
 * shared.ts re-exports everything here, so every existing import of
 * these names from "./shared.ts" or the content-lib/schemas barrel
 * keeps working unchanged.
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
// Images -- the public-safe portion only. sourceOriginalName is NOT here;
// it lives solely on shared.ts's ImageEntrySchema.
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
// ---------------------------------------------------------------------------

/**
 * A per-language translations object shape shared by every content type:
 * `{ ta?: T, kn?: T, hi?: T, te?: T }`, each entry independently optional so a
 * record can carry a translation for one language without needing all
 * four. Explicit object (not `z.record`) so an absent language is
 * simply an absent key, never a key that must be present-but-undefined.
 */
export function translationsSchemaFor<T extends z.ZodType>(languageShape: T) {
  return z.object({
    ta: languageShape.optional(),
    kn: languageShape.optional(),
    hi: languageShape.optional(),
    te: languageShape.optional(),
  });
}
