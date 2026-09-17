import { z } from "zod";
import { translationsSchemaFor } from "./shared-safe.ts";

/**
 * Book's public sub-schemas, split out of book.ts for the same reason
 * divya-desam-parts.ts was split out of divya-desam.ts -- see that
 * file's doc comment for the full "why".
 */

/**
 * See content-lib/schemas/divya-desam.ts's own translations block for
 * the full "why". `author` is deliberately excluded -- a person's name,
 * not prose to translate.
 */
export const BookTranslationSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
});
export type BookTranslation = z.infer<typeof BookTranslationSchema>;

export const BookTranslationsSchema = translationsSchemaFor(BookTranslationSchema);

/**
 * An optional top-level grouping of chapters. The recovered book has no
 * part/section structure at all (a flat chapter list), so `parts` is
 * expected to be empty for the foreseeable first migration — but the
 * shape exists because Phase 4B's book model explicitly allows some
 * future book to use parts.
 */
export const BookPartSchema = z.object({
  title: z.string().min(1),
  order: z.number().int(),
});
export type BookPart = z.infer<typeof BookPartSchema>;
