import { z } from "zod";

/**
 * Region — the traditional seven geographical/regional classifications
 * used in the Sri Vaishnava tradition (never present-day Indian state
 * boundaries), in their canonical presentation order. Derived positionally
 * from the corpus's own existing sourcePageId order (see the region
 * audit that produced this: Chōḻa Nāḍu 1-40, Naḍu Nāḍu 41-42, Toṇḍai
 * Nāḍu 43-64, Malai Nāḍu 65-77, Pāṇḍya Nāḍu 78-95, Vada Nāḍu 96-106,
 * Viṇṇulaga Tiruppatigaḷ 107-108) -- optional because it is being
 * backfilled onto existing records, not required by the source data
 * migration itself.
 *
 * Split out of divya-desam.ts (which re-exports it) into its own module
 * so that DIVYA_DESAM_REGION_ORDER/DivyaDesamRegion -- the only pieces of
 * that file a Client Component needs (the region-filter tab row on
 * app/divya-desams/page.tsx) -- can be imported without also pulling in
 * DivyaDesamSchema's construction, which references the internal
 * migration/provenance schemas (MigrationMetadataSchema, ImageEntrySchema)
 * and would otherwise ship their field names into the client JS bundle.
 * Region values themselves are ordinary public content (rendered directly
 * as filter-tab labels), so a small, standalone z.enum() here carries no
 * such exposure.
 */

export const DivyaDesamRegionSchema = z.enum([
  "Chōḻa Nāḍu",
  "Naḍu Nāḍu",
  "Toṇḍai Nāḍu",
  "Malai Nāḍu",
  "Pāṇḍya Nāḍu",
  "Vada Nāḍu",
  "Viṇṇulaga Tiruppatigaḷ",
]);
export type DivyaDesamRegion = z.infer<typeof DivyaDesamRegionSchema>;

/** Canonical display order for the seven regions -- matches the enum's own declaration order. */
export const DIVYA_DESAM_REGION_ORDER: readonly DivyaDesamRegion[] = DivyaDesamRegionSchema.options;
