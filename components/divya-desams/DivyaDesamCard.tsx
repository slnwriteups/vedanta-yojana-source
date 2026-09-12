"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { DivyaDesam } from "@/content-lib/schemas";
import { localizeDivyaDesam } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme";
import { sectionTint } from "@/lib/section-tints";
import { DraftBadge } from "@/components/shared/DraftBadge";

/**
 * One row of the Divya Desam index -- a photo thumbnail (mobile's
 * ContentCard `variant="temple"`, `mobile/app/(tabs)/divya-desams/index.tsx`)
 * plus the same text stack Phase 5J/5K already established. The
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
  record: DivyaDesam;
  number: string;
  imageHref: string | null;
}) {
  const { language } = useLanguage();
  const theme = useTheme();
  const localized = useMemo(() => localizeDivyaDesam(record, language), [record, language]);
  const tint = sectionTint("divya-desams", theme);

  return (
    <li>
      <Link
        href={`/divya-desams/${record.slug}`}
        className="relative flex items-center gap-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: tint }} />
        {imageHref ? (
          // 108x81 (4:3) -- mobile's ContentCard `variant="temple"` thumbnail
          // size (mobile/components/ContentCard.tsx), not a square crop.
          <img
            src={imageHref}
            alt=""
            loading="lazy"
            className="h-[81px] w-[108px] flex-none rounded-sm border border-[var(--border)] object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <DraftBadge status={record.status} needsReview={record.migration.needsReview} />
          <span className="mr-2 tabular-nums text-[var(--muted)]">{number}.</span>
          <span className="font-medium">{localized.displayName}</span>
          {localized.templeInformation.moolavar ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              {localized.templeInformation.moolavar}
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
