"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { searchCorpus } from "@/content-lib/search/run.ts";
import type { SearchDocument, SearchResultType } from "@/content-lib/search/types.ts";
import { CONTENT_TYPE_FILTERS, filterResultsByType } from "@/content-lib/search-filter.ts";
import { useLanguage } from "@/lib/language-context";
import { filterAccessibilityLabel, translateUi, type UiStringKey } from "@/lib/ui-strings";
import { SearchForm } from "./SearchForm";
import { SearchResults } from "./SearchResults";

/**
 * The one client component in the search feature -- introduced by the
 * GitHub Pages migration.
 *
 * Previously app/search/page.tsx read `searchParams` and called search()
 * on the server for each request. A statically exported site has no
 * server, so the same work now happens in the browser: fetch the corpus
 * that scripts/build-search-index.ts emitted at build time, then run the
 * identical ranking pipeline over it via searchCorpus(). The ranking,
 * matching and excerpting code is literally the same module the server
 * path used -- only where the corpus comes from changed.
 *
 * Imports searchCorpus from run.ts rather than the content-lib/search
 * barrel on purpose: the barrel re-exports buildSearchCorpus, which pulls
 * the node:fs-backed content loader into the bundle and would break the
 * client build.
 *
 * Content-type filter chips (Divya Desam/Book/Chapter/Knowledge,
 * multi-select) match mobile's search.tsx exactly: filtering happens
 * strictly after searchCorpus() has already ranked results
 * (content-lib/search-filter.ts's filterResultsByType is a plain
 * Array.filter), so relative ranking among surviving results never
 * changes.
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const RESULT_TYPE_LABEL_KEYS: Record<SearchResultType, UiStringKey> = {
  "divya-desam": "filterDivyaDesam",
  book: "filterBook",
  chapter: "filterChapter",
  knowledge: "filterKnowledge",
};

function searchHref(query: string): string {
  return query ? `${BASE_PATH}/search/?q=${encodeURIComponent(query)}` : `${BASE_PATH}/search/`;
}

function SearchExperience() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const { language } = useLanguage();

  const [query, setQuery] = useState(urlQuery);
  const [corpus, setCorpus] = useState<SearchDocument[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<SearchResultType>>(() => new Set());

  // Keeps in-component state honest when the URL changes underneath it --
  // browser back/forward, or a no-JS form submission that landed here.
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    let cancelled = false;

    fetch(`${BASE_PATH}/search-index.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`search index: HTTP ${response.status}`);
        return response.json();
      })
      .then((data: SearchDocument[]) => {
        if (!cancelled) setCorpus(data);
      })
      .catch(() => {
        // Surfaced as an explicit message rather than an endless
        // "Searching…" that never resolves.
        if (!cancelled) setUnavailable(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const trimmedQuery = query.trim();

  const rankedResults = useMemo(
    () => (corpus && trimmedQuery ? searchCorpus(corpus, trimmedQuery) : []),
    [corpus, trimmedQuery]
  );
  const results = useMemo(() => filterResultsByType(rankedResults, activeTypes), [rankedResults, activeTypes]);

  function handleChange(value: string) {
    setQuery(value);
    // replaceState rather than the app router: on a static export the
    // router would try to fetch a server payload for the target URL that
    // no static host can produce. The URL still stays shareable and the
    // query still survives a reload, and updating it live (not only on
    // submit) matches mobile's own live-filter-as-you-type behavior
    // while adding a web-only affordance mobile has no equivalent of.
    window.history.replaceState(null, "", searchHref(value.trim()));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Results are already current (handleChange runs on every keystroke);
    // this only exists so Enter/the Search button never triggers a real
    // navigation now that JS is confirmed working.
    event.preventDefault();
  }

  function toggleType(type: SearchResultType) {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <>
      <SearchForm query={query} language={language} onChange={handleChange} onSubmit={handleSubmit} />

      <div className="flex flex-wrap gap-2" role="group" aria-label={translateUi("tabSearch", language)}>
        {CONTENT_TYPE_FILTERS.map((filter) => {
          const selected = activeTypes.has(filter.value);
          const filterLabel = translateUi(RESULT_TYPE_LABEL_KEYS[filter.value], language);
          return (
            <button
              key={filter.value}
              type="button"
              role="checkbox"
              aria-checked={selected}
              aria-label={filterAccessibilityLabel(language, filterLabel)}
              onClick={() => toggleType(filter.value)}
              className={`rounded-md border px-3 py-1 text-sm font-semibold transition-colors ${
                selected
                  ? "border-[var(--accent)] bg-[var(--surface-alt)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
              }`}
            >
              {filterLabel}
            </button>
          );
        })}
      </div>

      {unavailable ? (
        <p className="prose-body text-[var(--muted)]">
          Search is temporarily unavailable. Please reload the page to try again.
        </p>
      ) : !corpus && trimmedQuery ? (
        <p className="prose-body text-[var(--muted)]">Searching…</p>
      ) : (
        <SearchResults query={trimmedQuery} results={results} language={language} />
      )}
    </>
  );
}

export function SearchClient() {
  // useSearchParams needs a Suspense boundary: during the static
  // pre-render there are no query parameters, and the real ones only
  // arrive on the client.
  return (
    <Suspense fallback={<SearchForm query="" />}>
      <SearchExperience />
    </Suspense>
  );
}
