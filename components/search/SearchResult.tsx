import Link from "next/link";
import type { SearchResult as SearchResultData } from "@/content-lib/search";
import { DraftBadge } from "@/components/shared/DraftBadge";
import { translateUi, type UiStringKey } from "@/lib/ui-strings";
import type { LanguageCode } from "@/lib/preferences";

/** Content-type label shown as visible text -- never color-only. Localized via ui-strings.ts, the same keys mobile's search.tsx uses. */
const RESULT_TYPE_LABEL_KEYS: Record<SearchResultData["type"], UiStringKey> = {
  "divya-desam": "filterDivyaDesam",
  book: "filterBook",
  chapter: "filterChapter",
  knowledge: "filterKnowledge",
};

export function SearchResult({ result, language }: { result: SearchResultData; language: LanguageCode | null }) {
  return (
    <li className="py-4">
      <p className="eyebrow">
        {translateUi(RESULT_TYPE_LABEL_KEYS[result.type], language)}
        {result.parentTitle ? ` · ${result.parentTitle}` : ""}
      </p>
      <Link href={result.href} className="font-medium hover:underline">
        {result.title}
      </Link>
      {result.excerpt ? (
        <p className="mt-1 text-sm text-[var(--muted)]">{result.excerpt}</p>
      ) : null}
      <div className="mt-1">
        <DraftBadge status={result.status} needsReview={result.needsReview} />
      </div>
    </li>
  );
}
