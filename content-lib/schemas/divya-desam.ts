import { z } from "zod";
import {
  ImageEntrySchema,
  MigrationMetadataSchema,
} from "./shared.ts";
import { RelatedContentRefSchema, SlugSchema, StatusSchema } from "./shared-safe.ts";
import { DivyaDesamRegionSchema } from "./divya-desam-region.ts";
import { ResourceEntrySchema, ShrineSchema, TempleInformationSchema, DivyaDesamTranslationsSchema } from "./divya-desam-parts.ts";

export * from "./divya-desam-region.ts";
export * from "./divya-desam-parts.ts";

/**
 * Divya Desam content schema — Phase 5C.
 *
 * Represents the future application's Divya Desam model, NOT the old SAP
 * component/flow structure. No SAP component ids, flow ids, ag-asset://
 * URIs, page.PageN public identifiers, or navigation-edge data appear
 * here — only `migration.sourcePageId` (internal traceability metadata,
 * never a public URL).
 *
 * IMPORTANT: this schema does not know how many Divya Desam records exist,
 * does not enforce uniqueness of slugs/sourcePageIds across records, and
 * does not validate Page93/Page150 specifically. Those are cross-record
 * concerns for the post-migration validation stage (Phase 5I).
 *
 * Its public sub-schemas (TempleInformationSchema, ShrineSchema,
 * ResourceEntrySchema, the translations schemas) now live in
 * ./divya-desam-parts.ts (re-exported above) -- see that file's doc
 * comment for why: this file's own top-level import of
 * MigrationMetadataSchema/ImageEntrySchema must not be reachable from
 * anything that only wants those genuinely public pieces.
 */

export const DivyaDesamSchema = z.object({
  slug: SlugSchema,
  displayName: z.string().min(1),
  status: StatusSchema,
  region: DivyaDesamRegionSchema.optional(),
  migration: MigrationMetadataSchema,
  templeInformation: TempleInformationSchema.default({}),
  sthalaPuranam: z.string().min(1).optional(),
  azhwarPasuram: z.string().min(1).optional(),
  shrines: z.array(ShrineSchema).default([]),
  images: z.array(ImageEntrySchema).default([]),
  resources: z.array(ResourceEntrySchema).default([]),
  relatedContent: z.array(RelatedContentRefSchema).default([]),
  translations: DivyaDesamTranslationsSchema.optional(),
});
export type DivyaDesam = z.infer<typeof DivyaDesamSchema>;
