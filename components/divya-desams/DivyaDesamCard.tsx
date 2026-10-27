"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { PublicDivyaDesam } from "@/lib/public-content";
import { localizeDivyaDesam } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme";
import { sectionTint } from "@/lib/section-tints";
import { DraftBadge } from "@/components/shared/DraftBadge";

/**
 * One temple in the Divya Desam index grid -- its photograph large (4:3,
 * the same ratio as mobile's ContentCard `variant="temple"` thumbnail)
 * with the number, name and presiding deity beneath it. The
 * secondary line uses only an already-present field
 * (templeInformation.moolavar, the presiding deity) and is omitted
 * entirely when that field is absent -- never a fabricated summary.
 * `imageHref` is the record's own first resolvable image (resolved
 * server-side, see app/divya-desams/page.tsx) or null when it has none
 * -- never a fabricated placeholder, matching mobile's own
 * firstImageAsset() fallback-to-null.
 *
 * `number` is the traditional 1-108 Divya Desam number for this record
 * (see divyaDesamNumberLabels() in the index page) -- a plain-text
 * prefix, not a fabricated field on the record itself.
 *
 * Client component so displayName/moolavar follow the reader's language
 * preference (content-lib/i18n.ts's localizeDivyaDesam) on the index
 * page, same as the detail page.
 */
export function DivyaDesamCard({
  record,
  number,
  imageHref,
}: {
  record: PublicDivyaDesam;
  number: string;
  imageHref: string | null;
}) {
  const { language } = useLanguage();
  const theme = useTheme();
  const localized = useMemo(() => localizeDivyaDesam(record, language), [record, language]);
  const tint = sectionTint("divya-desams", theme);

  return (
    <li>
      <Link href={`/divya-desams/${record.slug}`} className="group block">
        <div className="aspect-[4/3] overflow-hidden rounded-md" style={{ backgroundColor: tint }}>
          {imageHref ? (
            <img
              src={imageHref}
              alt=""
              width={400}
              height={300}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          ) : (
            <span aria-hidden className="flex h-full w-full items-center justify-center text-4xl font-semibold text-[var(--on-accent)] tabular-nums">
              {number}
            </span>
          )}
        </div>
        <div className="mt-3 min-w-0">
          <DraftBadge status={record.status} needsReview={record.migration.needsReview} />
          <span className="block font-semibold break-words group-hover:underline">
            <span className="mr-1.5 tabular-nums text-[var(--muted)]">{number}.</span>
            {localized.displayName}
          </span>
          {localized.templeInformation.moolavar ? (
            <span className="mt-0.5 block text-sm text-[var(--muted)]">{localized.templeInformation.moolavar}</span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
