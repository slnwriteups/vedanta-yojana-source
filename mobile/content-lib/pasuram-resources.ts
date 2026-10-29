import type { ResourceEntry } from "../../content-lib/schemas/divya-desam-parts.ts";

/** The resource types bundled into the app's Pasuram archive: Divya Desam pasurams and Library books' stotrams. */
const BUNDLED_RESOURCE_TYPES: ReadonlySet<string> = new Set(["pasuram-pdf", "stotram-pdf"]);

/**
 * Pure aggregation over already-loaded records that carry `resources` --
 * Divya Desams (pasuram PDFs) and Library books (stotram PDFs) -- no
 * filesystem, no network. Collects every distinct bundled PDF URL
 * exactly once, so scripts/generate-pasuram-archive.ts never bundles
 * more than one copy of the same PDF, regardless of how many records --
 * or how many times a single record -- reference the same URL.
 */
export function allPasuramResourceUrls(records: readonly { resources: readonly Pick<ResourceEntry, "type" | "url">[] }[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const record of records) {
    for (const resource of record.resources) {
      if (!BUNDLED_RESOURCE_TYPES.has(resource.type)) continue;
      if (seen.has(resource.url)) continue;
      seen.add(resource.url);
      urls.push(resource.url);
    }
  }
  return urls;
}
