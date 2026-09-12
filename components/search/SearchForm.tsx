import type { ChangeEvent, FormEvent } from "react";
import { translateUi } from "@/lib/ui-strings";
import type { LanguageCode } from "@/lib/preferences";

/**
 * Still a real GET form: with JavaScript disabled the browser's native
 * submission navigates to /search/?q=..., which is a real pre-rendered
 * page. What changed in the GitHub Pages migration is what happens after
 * that navigation -- results are computed in the browser rather than by
 * the server (see SearchClient.tsx), so a no-JS visitor reaches the
 * search page with their query preserved in this input but sees no
 * result list. That is a genuine, unavoidable reduction: a static host
 * has no server to compute results on.
 *
 * `onChange` makes the input filter live on every keystroke, matching
 * mobile's search.tsx (`onChangeText={setQuery}`) -- SearchClient.tsx
 * updates the URL (via replaceState) on the same event, so the query
 * stays both live-filtering AND shareable/bookmarkable, a web-only
 * affordance mobile has no equivalent of. `onSubmit` is kept for the
 * Enter-key/Search-button no-JS path; JS enabled, it's a no-op (the
 * results are already current) but avoids a real navigation.
 */

const SEARCH_ACTION = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/search/`;

export function SearchForm({
  query,
  language,
  onChange,
  onSubmit,
}: {
  query: string;
  language?: LanguageCode | null;
  onChange?: (value: string) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      action={SEARCH_ACTION}
      method="GET"
      role="search"
      onSubmit={onSubmit}
      className="flex flex-wrap gap-3"
    >
      <label htmlFor="search-query" className="sr-only">
        {translateUi("tabSearch", language ?? null)}
      </label>
      <input
        id="search-query"
        name="q"
        type="search"
        value={query}
        onChange={onChange ? (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value) : undefined}
        readOnly={!onChange}
        placeholder={translateUi("searchPlaceholder", language ?? null)}
        aria-label={translateUi("tabSearch", language ?? null)}
        title={translateUi("searchHint", language ?? null)}
        className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        autoCorrect="off"
        autoCapitalize="none"
      />
      <button
        type="submit"
        className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:border-[var(--accent)]"
      >
        {translateUi("tabSearch", language ?? null)}
      </button>
    </form>
  );
}
