import { z } from "zod";
import { translationsSchemaFor } from "./shared-safe.ts";

/**
 * Chapter's public sub-schema, split out of chapter.ts for the same
 * reason divya-desam-parts.ts was split out of divya-desam.ts -- see
 * that file's doc comment for the full "why".
 */

/** See content-lib/schemas/divya-desam.ts's own translations block for the full "why". */
export const ChapterTranslationSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
});
export type ChapterTranslation = z.infer<typeof ChapterTranslationSchema>;

export const ChapterTranslationsSchema = translationsSchemaFor(ChapterTranslationSchema);

/**
 * The title-only subset of ChapterTranslationSchema, for
 * mobile-content.ts's MobileChapterSummarySchema -- a book's table of
 * contents (shown before any download) needs a chapter's translated
 * title in every supported language, but never its translated body:
 * that only exists once the book has actually been downloaded (see
 * MobileChapterSummarySchema's own doc comment).
 */
export const ChapterSummaryTranslationSchema = z.object({
  title: z.string().min(1).optional(),
});
export type ChapterSummaryTranslation = z.infer<typeof ChapterSummaryTranslationSchema>;

export const ChapterSummaryTranslationsSchema = translationsSchemaFor(ChapterSummaryTranslationSchema);
