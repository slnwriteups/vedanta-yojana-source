import { z } from "zod";
import { ImageEntrySchema, MigrationMetadataSchema } from "./shared.ts";
import { ResourceEntrySchema } from "./divya-desam-parts.ts";
import { SlugSchema, StatusSchema } from "./shared-safe.ts";
import { BookPartSchema, BookTranslationsSchema, LibraryKindSchema } from "./book-parts.ts";

export * from "./book-parts.ts";

/**
 * Book + Chapter schemas — Phase 5C.
 *
 * The recovered book candidate (Phase 4A/5A) has no confirmed title,
 * author, or chapter-numbering scheme yet — that is an open editorial
 * decision. This schema must therefore allow a Book to exist entirely as
 * `status: "draft"` with `author`/`description`/`coverImage` all absent.
 * No real book.json is created in this phase.
 *
 * BookTranslationSchema/BookTranslationsSchema/BookPartSchema now live in
 * ./book-parts.ts (re-exported above) -- see divya-desam-parts.ts's doc
 * comment for why.
 */
export const BookSchema = z.object({
  slug: SlugSchema,
  title: z.string().min(1),
  author: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
  /** Reuses the shared image model rather than a bespoke "just a URL" field. */
  coverImage: ImageEntrySchema.nullable().optional(),
  /** Which Library shelf this belongs on -- see LibraryKindSchema. */
  kind: LibraryKindSchema.default("book"),
  status: StatusSchema,
  migration: MigrationMetadataSchema,
  parts: z.array(BookPartSchema).default([]),
  /** Ordered list of chapter slugs. Chapter records themselves live separately. */
  chapterOrder: z.array(SlugSchema).default([]),
  /**
   * Language-tagged PDFs of the text the book is about (the stotram, for
   * Sri Vishnu Sahasranaama Anubhavam), shown on the book's page the same
   * way a Divya Desam shows its pasuram PDFs. Empty for most books.
   */
  resources: z.array(ResourceEntrySchema).default([]),
  translations: BookTranslationsSchema.optional(),
});
export type Book = z.infer<typeof BookSchema>;
