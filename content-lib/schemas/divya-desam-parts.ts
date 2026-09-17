import { z } from "zod";
import { translationsSchemaFor } from "./shared-safe.ts";

/**
 * The genuinely public sub-schemas of Divya Desam, split out of
 * divya-desam.ts for the same reason shared-safe.ts was split out of
 * shared.ts: none of these need MigrationMetadataSchema or
 * ImageEntrySchema, so content-lib/mobile-content.ts can import them
 * directly without also bundling those into the mobile Hermes bundle --
 * which importing them from divya-desam.ts itself would do, since that
 * file's own top-level `import ... from "./shared.ts"` executes
 * regardless of which of its exports mobile-content.ts actually uses.
 *
 * divya-desam.ts re-exports everything here, so every existing import of
 * these names keeps working unchanged.
 */

// ---------------------------------------------------------------------------
// Temple information (free-form, parsed out of the source's
// "Details of Kshethram:" block during migration — every field here is
// legitimately optional because the source itself has records missing
// one or more of them).
// ---------------------------------------------------------------------------

export const TempleInformationSchema = z.object({
  moolavar: z.string().min(1).optional(),
  thayaar: z.string().min(1).optional(),
  vimanam: z.string().min(1).optional(),
  theertham: z.string().min(1).optional(),
  travelNote: z.string().min(1).optional(),
});
export type TempleInformation = z.infer<typeof TempleInformationSchema>;

// ---------------------------------------------------------------------------
// Shrines — supports the non-negotiable multi-shrine requirement: a single
// Divya Desam record may list zero, one, or many shrines. A missing Maps
// link for the whole temple is represented as an EMPTY shrines[] array,
// never as a shrine entry with a null/missing mapsLink.
//
// Phase 6E-C: four fields added, all optional, to let a shrine carry its
// OWN temple information/prose independently of the record-level
// `templeInformation`/`sthalaPuranam`/`azhwarPasuram` above. This exists
// because two records (Tanjai Mamanikoyil, Tiruvaali Tirunagari) each
// combine multiple physically distinct shrines with their own,
// unambiguous Moolavar/Thayaar/etc. in the source — data the original
// flat per-record `templeInformation` object cannot hold without
// triggering `AmbiguousLabelError` (more than one value would collide
// into the same field). Every field here is optional and every existing
// shrine entry across the corpus (which only ever set `label`/`mapsLink`)
// remains valid unchanged.
//
// `name` is deliberately separate from `label`: `label` is the original
// source's map-button caption (preserved verbatim, e.g. "Map 1"), `name`
// is the shrine's own identity when it is more specific than that
// caption. The two coincide for some records (e.g. "Tiruvaali") and are
// then left undefined on `name` rather than duplicated.
// ---------------------------------------------------------------------------

export const ShrineSchema = z.object({
  label: z.string().min(1).nullable(),
  mapsLink: z.string().url(),
  name: z.string().min(1).optional(),
  templeInformation: TempleInformationSchema.optional(),
  sthalaPuranam: z.string().min(1).optional(),
  azhwarPasuram: z.string().min(1).optional(),
});
export type Shrine = z.infer<typeof ShrineSchema>;

// ---------------------------------------------------------------------------
// Resources — language-tagged external links (sloka/pasuram PDFs today).
// Exactly the 5 languages confirmed present in the source. `type` is kept
// as a single-value enum reflecting the one resource type recovered so
// far; extending it later (a schema-file edit) is expected as new
// resource kinds appear — this is not meant to be exhaustive forever.
// `sourceLabel` preserves the original button label for provenance and
// must never replace the normalized `language` field.
// ---------------------------------------------------------------------------

export const ResourceLanguageSchema = z.enum([
  "English",
  "Tamil",
  "Kannada",
  "Sanskrit",
  "Devanagari",
]);
export type ResourceLanguage = z.infer<typeof ResourceLanguageSchema>;

export const ResourceTypeSchema = z.enum(["pasuram-pdf"]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const ResourceEntrySchema = z.object({
  language: ResourceLanguageSchema,
  type: ResourceTypeSchema,
  url: z.string().url(),
  sourceLabel: z.string().min(1).optional(),
});
export type ResourceEntry = z.infer<typeof ResourceEntrySchema>;

// ---------------------------------------------------------------------------
// Translations — reader-facing language toggle (English is the base
// language: the plain fields above, always present, never moved). Every
// field here mirrors an English one and is independently optional: a
// translation may cover the short temple-information fields without yet
// covering the long Sthala Puranam narrative, or vice versa -- never
// required to be all-or-nothing. Shrine translations are keyed by the
// shrine's own position in `shrines[]` (as a string index) rather than
// requiring a parallel same-length array, since only a minority of
// records (the multi-shrine ones) have shrine-level prose to translate
// at all.
// ---------------------------------------------------------------------------

export const ShrineTranslationSchema = z.object({
  name: z.string().min(1).optional(),
  templeInformation: TempleInformationSchema.optional(),
  sthalaPuranam: z.string().min(1).optional(),
  azhwarPasuram: z.string().min(1).optional(),
});
export type ShrineTranslation = z.infer<typeof ShrineTranslationSchema>;

export const DivyaDesamTranslationSchema = z.object({
  displayName: z.string().min(1).optional(),
  templeInformation: TempleInformationSchema.optional(),
  sthalaPuranam: z.string().min(1).optional(),
  azhwarPasuram: z.string().min(1).optional(),
  /** Keyed by the shrine's index in `shrines[]`, e.g. {"0": {...}, "1": {...}}. */
  shrines: z.record(z.string(), ShrineTranslationSchema).optional(),
});
export type DivyaDesamTranslation = z.infer<typeof DivyaDesamTranslationSchema>;

export const DivyaDesamTranslationsSchema = translationsSchemaFor(DivyaDesamTranslationSchema);
