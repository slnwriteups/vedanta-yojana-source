import { z } from "zod";
import {
  ImageAltStatusSchema,
  ImagePlacementSchema,
  RelatedContentRefSchema,
  SlugSchema,
  StatusSchema,
} from "./schemas/shared-safe.ts";
import { DivyaDesamRegionSchema } from "./schemas/divya-desam-region.ts";
import { DivyaDesamTranslationsSchema, ResourceEntrySchema, ShrineSchema, TempleInformationSchema } from "./schemas/divya-desam-parts.ts";
import { ChapterSummaryTranslationsSchema, ChapterTranslationsSchema } from "./schemas/chapter-parts.ts";
import { ContentTypeSchema, KnowledgeTranslationsSchema } from "./schemas/knowledge-parts.ts";
import { BookPartSchema, BookTranslationsSchema } from "./schemas/book-parts.ts";

/**
 * The mobile public boundary: schemas and types ONLY.
 *
 * Unlike the web app (lib/public-content.ts), the mobile app has no
 * server: every loaded record is compiled directly into the Hermes
 * bytecode via mobile/content-lib/manifest.generated.ts, which used to
 * statically `import` each /content/*.json file verbatim. That embedded
 * the exact same migration/provenance metadata web already had to strip
 * -- `migration.sourcePageId`, `migration.extractionConfidence`,
 * `images[].sourceOriginalName` -- into the publicly distributed APK,
 * with no runtime boundary (unlike web's RSC payload) capable of
 * stopping it after the fact. The fix happens at manifest-generation
 * time (mobile/scripts/generate-content-manifest.ts), before a single
 * literal from these fields ever reaches a generated file Metro bundles.
 *
 * Two non-obvious constraints shaped this file:
 *
 * 1. Every Mobile*Schema here is its OWN independent `z.object(...)`,
 * never e.g. `DivyaDesamSchema.omit({ migration: true, ... })` derived
 * from the full private schema. `.omit()` is a RUNTIME method call on a
 * RUNTIME Zod object -- it produces a new schema by reading the full
 * one's existing shape, which means the full schema (and therefore its
 * "sourcePageId"/"extractionConfidence"/"sourceOriginalName" field-name
 * strings) would still have to exist, and get bundled, for `.omit()` to
 * run against it. An earlier version of this file did exactly that and
 * was caught by this project's own Hermes-bundle security scan.
 *
 * 2. This file imports only from content-lib/schemas/shared-safe.ts,
 * divya-desam-region.ts, divya-desam-parts.ts, chapter-parts.ts,
 * knowledge-parts.ts, and book-parts.ts -- never from shared.ts,
 * divya-desam.ts, chapter.ts, knowledge.ts, or book.ts directly, even
 * though those files re-export the exact same names. Metro bundles a
 * whole ES module as one unit: importing even one safe export from e.g.
 * divya-desam.ts would still execute that file's own top-level `import
 * { ImageEntrySchema, MigrationMetadataSchema } from "./shared.ts"` and
 * bundle those definitions too. The *-parts.ts / shared-safe.ts leaf
 * modules exist specifically so nothing reachable from them ever touches
 * the unsafe schemas -- see shared-safe.ts's own doc comment.
 *
 * The record-shape transform functions (toMobileDivyaDesam() and
 * friends) live in a SEPARATE file, ./mobile-content-transform.ts, not
 * here, for the same reason: toMobileImage()'s job is to strip
 * `sourceOriginalName` off an image, which means its own compiled code
 * has to reference that property name once, to know what to remove. That
 * single reference is fine in a module only mobile/scripts/
 * generate-content-manifest.ts (a Node-only script Metro never bundles)
 * imports -- but this file IS imported by mobile/content-lib/loader.ts,
 * which Metro bundles into the app, and Metro would bundle the whole
 * module including the never-called transform functions if they lived
 * here too.
 *
 * `images[].sourceAssetUuid` is the one field web drops that mobile must
 * keep: mobile resolves each image by looking up this exact UUID in
 * mobile/content-lib/image-manifest.generated.ts at render time (see
 * mobile/components/ContentImage.tsx and its siblings) -- there is no
 * web-style server-side "resolve to a URL, discard the UUID" step to
 * hide it behind. It is not internal provenance in the same sense as
 * sourceOriginalName: it is the public, load-bearing key the mobile UI
 * uses to find its own bundled images.
 *
 * `migration.sourcePageId` has the same problem in reverse: Divya Desams
 * are sorted into their traditional pilgrimage order by parsing this
 * field, and that sort runs live inside the app, not on a server -- so
 * the ordering position has to survive even though the raw "page.PageN"
 * migration-tracking string must not. `sourceOrder` (named to match the
 * pre-existing, already-public field of the same name on
 * content-lib/search/types.ts's SearchDocument) carries exactly that:
 * the derived integer position, computed by generate-content-manifest.ts
 * itself -- the "page.PageN" string and the regex that parses it never
 * appear in anything Metro bundles.
 *
 * `status` and `migration.needsReview` are kept, matching web's own
 * documented rationale in lib/public-content.ts: DraftBadge is a real
 * public-facing indicator built on exactly those two fields.
 */

export const MobileImageEntrySchema = z.object({
  assetId: z.string().min(1),
  sourceAssetUuid: z.string().min(1),
  alt: z.string().nullable(),
  altStatus: ImageAltStatusSchema.default("needs-review"),
  placement: ImagePlacementSchema.optional(),
  placementAnchor: z.string().min(1).optional(),
});
export type MobileImageEntry = z.infer<typeof MobileImageEntrySchema>;

export const MobileMigrationSchema = z.object({ needsReview: z.boolean() });
export type MobileMigration = z.infer<typeof MobileMigrationSchema>;

export const MobileDivyaDesamSchema = z.object({
  slug: SlugSchema,
  displayName: z.string().min(1),
  status: StatusSchema,
  region: DivyaDesamRegionSchema.optional(),
  migration: MobileMigrationSchema,
  templeInformation: TempleInformationSchema.default({}),
  sthalaPuranam: z.string().min(1).optional(),
  azhwarPasuram: z.string().min(1).optional(),
  shrines: z.array(ShrineSchema).default([]),
  images: z.array(MobileImageEntrySchema).default([]),
  resources: z.array(ResourceEntrySchema).default([]),
  relatedContent: z.array(RelatedContentRefSchema).default([]),
  translations: DivyaDesamTranslationsSchema.optional(),
  sourceOrder: z.number().int(),
});
export type MobileDivyaDesam = z.infer<typeof MobileDivyaDesamSchema>;

export const MobileChapterSchema = z.object({
  title: z.string().min(1),
  slug: SlugSchema,
  order: z.number().int(),
  status: StatusSchema,
  migration: MobileMigrationSchema,
  body: z.string().min(1),
  images: z.array(MobileImageEntrySchema).default([]),
  translations: ChapterTranslationsSchema.optional(),
});
export type MobileChapter = z.infer<typeof MobileChapterSchema>;

export const MobileKnowledgeSchema = z.object({
  title: z.string().min(1),
  slug: SlugSchema,
  contentType: ContentTypeSchema,
  status: StatusSchema,
  migration: MobileMigrationSchema,
  body: z.string().min(1),
  images: z.array(MobileImageEntrySchema).default([]),
  relatedContent: z.array(RelatedContentRefSchema).default([]),
  translations: KnowledgeTranslationsSchema.optional(),
});
export type MobileKnowledge = z.infer<typeof MobileKnowledgeSchema>;

export const MobileBookSchema = z.object({
  slug: SlugSchema,
  title: z.string().min(1),
  author: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
  coverImage: MobileImageEntrySchema.nullable().optional(),
  status: StatusSchema,
  migration: MobileMigrationSchema,
  parts: z.array(BookPartSchema).default([]),
  chapterOrder: z.array(SlugSchema).default([]),
  translations: BookTranslationsSchema.optional(),
});
export type MobileBook = z.infer<typeof MobileBookSchema>;

/**
 * The bundled-catalog shape of a chapter -- deliberately NOT MobileChapterSchema.
 * A book's full chapter bodies/images/translations are large (this is the
 * exact payload the book-bundle-removal work moved out of the initial
 * APK) and are only ever needed once a reader has actually downloaded
 * that book. What the Library UI DOES need before any download --
 * the chapter list screen's titles/ordinals, the index screen's chapter
 * count -- is exactly this: title, slug, order, status, migration. This
 * is what mobile/content-lib/manifest.generated.ts's rawBookGroups now
 * carries per chapter; the full MobileChapter (with body/images) is only
 * ever produced by mobile/services/bookOfflineService.ts, from a
 * downloaded book's local JSON, never from the bundle.
 */
export const MobileChapterSummarySchema = z.object({
  title: z.string().min(1),
  slug: SlugSchema,
  order: z.number().int(),
  status: StatusSchema,
  migration: MobileMigrationSchema,
  translations: ChapterSummaryTranslationsSchema.optional(),
});
export type MobileChapterSummary = z.infer<typeof MobileChapterSummarySchema>;

/**
 * The downloadable payload's own top-level shape: a book's full mobile-
 * safe metadata plus every chapter's full mobile-safe content (body,
 * images, translations) -- everything MobileChapterSummary omits. This
 * is what a book download service parses after fetching
 * `books/<slug>.json` from the public deploy (scripts/build-book-payloads.ts
 * generates that file, web-side, using the exact same toMobileBook/
 * toMobileChapter projection this schema module's sibling
 * mobile-content-transform.ts already applies to the bundled catalog --
 * same sanitization, same excluded fields, just not embedded in Hermes).
 * `contentSchemaVersion` guards against a future incompatible payload
 * shape ever being silently accepted by an older, still-installed app.
 */
export const BOOK_PAYLOAD_SCHEMA_VERSION = 1;

export const BookPayloadSchema = z.object({
  contentSchemaVersion: z.literal(BOOK_PAYLOAD_SCHEMA_VERSION),
  book: MobileBookSchema,
  chapters: z.array(MobileChapterSchema),
  /** sourceAssetUuid (lowercased) -> the exact filename (with real extension) to fetch alongside this book's JSON. Every uuid any chapter or the cover references appears here exactly once. */
  imageFiles: z.record(z.string(), z.string().min(1)),
});
export type BookPayload = z.infer<typeof BookPayloadSchema>;
