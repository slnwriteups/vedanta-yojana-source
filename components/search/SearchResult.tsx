import Link from "next/link";
import type { SearchResult as SearchResultData } from "@/content-lib/search";
import { translateUi, type UiStringKey } from "@/lib/ui-strings";
import type { LanguageCode } from "@/lib/preferences";

/** Content-type label shown as visible text -- never color-only. Localized via ui-strings.ts, the same keys mobile's search.tsx uses. */
const RESULT_TYPE_LABEL_KEYS: Record<SearchResultData["type"], UiStringKey> = {
  "divya-desam": "filterDivyaDesam",
  book: "filterBook",
  chapter: "filterChapter",
  knowledge: "filterKnowledge",
};

/**
 * Title → type/parent meta line → excerpt, matching mobile's own
 * renderItem order (mobile/app/(tabs)/search.tsx) exactly -- and no
 * DraftBadge, since mobile's search results never show one either
 * (SearchDocument carries status/needsReview, but mobile's search
 * screen doesn't render them).
 */
export function SearchResult({ result, language }: { result: SearchResultData; language: LanguageCode | null }) {
  return (
    <li className="py-4">
      <Link href={result.href} className="font-medium text-[var(--accent)] hover:underline">
        {result.title}
      </Link>
      <p className="eyebrow mt-1">
        {translateUi(RESULT_TYPE_LABEL_KEYS[result.type], language)}
        {result.parentTitle ? ` · ${result.parentTitle}` : ""}
      </p>
      {result.excerpt ? (
        <p className="mt-1 text-sm text-[var(--muted)]">{result.excerpt}</p>
      ) : null}
    </li>
  );
}
