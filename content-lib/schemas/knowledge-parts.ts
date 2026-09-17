import { z } from "zod";
import { translationsSchemaFor } from "./shared-safe.ts";

/**
 * Knowledge's public sub-schemas, split out of knowledge.ts for the same
 * reason divya-desam-parts.ts was split out of divya-desam.ts -- see
 * that file's doc comment for the full "why".
 */

/** See content-lib/schemas/divya-desam.ts's own translations block for the full "why". */
export const KnowledgeTranslationSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
});
export type KnowledgeTranslation = z.infer<typeof KnowledgeTranslationSchema>;

export const KnowledgeTranslationsSchema = translationsSchemaFor(KnowledgeTranslationSchema);

/**
 * Generic content model for non-temple, non-book-chapter material
 * (philosophy, biography, itihasa, purana, stotram, educational, article,
 * etc. — per Phase 4A/4B, "article" is not assumed to be the universal
 * type). `contentType` is deliberately an open string, not a closed enum,
 * so a new category never requires a schema change — only a documented
 * convention.
 *
 * Known/expected values as of Phase 5A (not enforced, for reference only):
 * "educational" | "philosophy" | "biography" | "itihasa" | "purana" |
 * "stotram" | "article"
 */
export const ContentTypeSchema = z.string().min(1);
export type KnowledgeContentType = z.infer<typeof ContentTypeSchema>;
