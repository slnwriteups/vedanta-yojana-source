import type { SearchResult, SearchResultType } from "./search/types.ts";

/**
 * Shared by mobile (mobile/app/(tabs)/search.tsx) and web
 * (components/search/SearchClient.tsx) -- content-type filtering,
 * applied strictly AFTER searchCorpus() has already ranked the results.
 * This never re-ranks or re-scores anything -- it's a pure
 * `Array.filter` over the already-deterministic ranked order, so
 * filtering by type can never change the relative order of two results
 * that both survive the filter.
 */
export const CONTENT_TYPE_FILTERS: { label: string; value: SearchResultType }[] = [
  { label: "Divya Desam", value: "divya-desam" },
  { label: "Book", value: "book" },
  { label: "Chapter", value: "chapter" },
  { label: "Knowledge", value: "knowledge" },
];

/** An empty `activeTypes` means "no filter" -- every result passes. */
export function filterResultsByType(results: SearchResult[], activeTypes: ReadonlySet<SearchResultType>): SearchResult[] {
  if (activeTypes.size === 0) return results;
  return results.filter((result) => activeTypes.has(result.type));
}
