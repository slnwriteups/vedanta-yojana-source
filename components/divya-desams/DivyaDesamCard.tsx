"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { DivyaDesam } from "@/content-lib/schemas";
import { localizeDivyaDesam } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { DraftBadge } from "@/components/shared/DraftBadge";

/**
 * One row of the Divya Desam index. Deliberately plain (a divider list,
 * not a bordered/shadowed "card") per the Phase 5J/5K restrained visual
 * language. The secondary line uses only an already-present field
 * (templeInformation.moolavar, the presiding deity) and is omitted
 * entirely when that field is absent -- never a fabricated summary.
 *
 * `number` is the traditional 1-108 Divya Desam number for this record
 * (see divyaDesamNumberLabels() in the index page) -- a plain-text
 * prefix, not a fabricated field on the record itself.
 *
 * Client component so displayName/moolavar follow the reader's language
 * preference (content-lib/i18n.ts's localizeDivyaDesam) on the index
 * page, same as the detail page.
 */
export function DivyaDesamCard({ record, number }: { record: DivyaDesam; number: string }) {
  const { language } = useLanguage();
  const localized = useMemo(() => localizeDivyaDesam(record, language), [record, language]);

  return (
    <li className="py-4">
      <Link href={`/divya-desams/${record.slug}`} className="block hover:underline">
        <span className="mr-2 tabular-nums text-[var(--muted)]">{number}.</span>
        <span className="font-medium">{localized.displayName}</span>
      </Link>
      {localized.templeInformation.moolavar ? (
        <p className="mt-1 text-sm text-[var(--muted)]">
          {localized.templeInformation.moolavar}
        </p>
      ) : null}
      <div className="mt-1">
        <DraftBadge status={record.status} needsReview={record.migration.needsReview} />
      </div>
    </li>
  );
}
