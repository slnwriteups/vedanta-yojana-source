import { z } from "zod";
import { ImageEntrySchema, MigrationMetadataSchema } from "./shared.ts";
import { SlugSchema, StatusSchema } from "./shared-safe.ts";
import { ChapterTranslationsSchema } from "./chapter-parts.ts";
import { isIsoDate } from "../release.ts";

export * from "./chapter-parts.ts";

/**
 * Book Chapter schema — Phase 5C.
 *
 * NOTE ON `order`: this schema validates only that `order` is an integer
 * on an individual chapter record. It CANNOT and does not enforce that
 * `order` values are unique across all chapters of a given book — that is
 * a cross-record concern belonging to the post-migration validation stage
 * (Phase 5I), once real chapter files exist to check against each other.
 *
 * Previous/next chapter navigation is derived from `order` at render
 * time by the (not-yet-built) application layer — never hand-authored
 * per chapter, and not something this schema is responsible for.
 *
 * ChapterTranslationSchema/ChapterTranslationsSchema now live in
 * ./chapter-parts.ts (re-exported above) -- see divya-desam-parts.ts's
 * doc comment for why.
 */
export const ChapterSchema = z.object({
  title: z.string().min(1),
  slug: SlugSchema,
  order: z.number().int(),
  status: StatusSchema,
  migration: MigrationMetadataSchema,
  /** Long-form body text. Required and non-empty for an actual chapter. */
  body: z.string().min(1),
  images: z.array(ImageEntrySchema).default([]),
  translations: ChapterTranslationsSchema.optional(),
  /**
   * The India calendar date (YYYY-MM-DD) this chapter is published on.
   * Before it, the chapter does not exist for readers (content-lib/release.ts).
   */
  releaseDate: z.string().refine(isIsoDate, "releaseDate must be a real date written YYYY-MM-DD").optional(),
});
export type Chapter = z.infer<typeof ChapterSchema>;
