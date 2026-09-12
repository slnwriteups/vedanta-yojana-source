import type { SearchResult as SearchResultData } from "@/content-lib/search";
import { SearchResult } from "./SearchResult";
import { noResultsLabel } from "@/lib/ui-strings";
import type { LanguageCode } from "@/lib/preferences";

/**
 * Three distinct, deliberate states -- never "no query = show everything":
 *   - no query supplied (or blank/whitespace-only) -> initial state
 *   - query supplied, zero matches -> explicit no-results state (wording
 *     matches mobile's noResultsLabel() exactly, localized)
 *   - query supplied, one or more matches -> the results list, with a
 *     result-count heading -- web-only chrome mobile's tab has no room
 *     for (there's no page-level heading on a mobile screen at all), so
 *     its exact wording has no mobile string to match against.
 */
export function SearchResults({
  query,
  results,
  language,
}: {
  query: string;
  results: SearchResultData[];
  language: LanguageCode | null;
}) {
  if (!query) {
    return (
      <p className="prose-body text-[var(--muted)]">
        Enter a search term above to find Divya Desams, Library chapters, and
        Knowledge records.
      </p>
    );
  }

  if (results.length === 0) {
    return <p className="prose-body text-[var(--muted)]">{noResultsLabel(language, query)}</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="section-heading">
        {results.length} {results.length === 1 ? "result" : "results"} for
        &ldquo;{query}&rdquo;
      </h2>
      <ul role="list" className="divide-y divide-[var(--border)]">
        {results.map((result) => (
          <SearchResult key={`${result.type}-${result.href}`} result={result} language={language} />
        ))}
      </ul>
    </div>
  );
}
