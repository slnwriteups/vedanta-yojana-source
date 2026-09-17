import type { DivyaDesam } from "./loader.ts";

/**
 * Pure aggregation over already-loaded Divya Desam records -- no
 * filesystem, no network. Collects every distinct "pasuram-pdf"
 * resource URL across all 107 records exactly once, so a caller (the
 * "Download All Pasurams" bulk action) never issues more than one
 * download per unique PDF, regardless of how many Divya Desams --
 * or how many times a single record -- reference the same URL.
 */
export function allPasuramResourceUrls(records: readonly DivyaDesam[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const record of records) {
    for (const resource of record.resources) {
      if (resource.type !== "pasuram-pdf") continue;
      if (seen.has(resource.url)) continue;
      seen.add(resource.url);
      urls.push(resource.url);
    }
  }
  return urls;
}
