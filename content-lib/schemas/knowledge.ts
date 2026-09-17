import { z } from "zod";
import { ImageEntrySchema, MigrationMetadataSchema } from "./shared.ts";
import { RelatedContentRefSchema, SlugSchema, StatusSchema } from "./shared-safe.ts";
import { ContentTypeSchema, KnowledgeTranslationsSchema } from "./knowledge-parts.ts";

export * from "./knowledge-parts.ts";

/**
 * Knowledge schema — Phase 5C.
 *
 * No Knowledge record (including the eventual Page4 "Introduction") is
 * created in this phase.
 *
 * ContentTypeSchema/KnowledgeTranslationSchema/KnowledgeTranslationsSchema
 * now live in ./knowledge-parts.ts (re-exported above) -- see
 * divya-desam-parts.ts's doc comment for why.
 */
export const KnowledgeSchema = z.object({
  title: z.string().min(1),
  slug: SlugSchema,
  contentType: ContentTypeSchema,
  status: StatusSchema,
  migration: MigrationMetadataSchema,
  body: z.string().min(1),
  images: z.array(ImageEntrySchema).default([]),
  relatedContent: z.array(RelatedContentRefSchema).default([]),
  translations: KnowledgeTranslationsSchema.optional(),
});
export type Knowledge = z.infer<typeof KnowledgeSchema>;
