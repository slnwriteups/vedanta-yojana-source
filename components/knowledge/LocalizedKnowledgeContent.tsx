"use client";

import { useMemo, type ReactNode } from "react";
import type { PublicKnowledge } from "@/lib/public-content";
import { localizeKnowledge } from "@/content-lib/i18n.ts";
import { useLanguage } from "@/lib/language-context";
import { LongFormSection } from "@/components/shared/LongFormSection";
import { LocalizedText } from "@/components/shared/LocalizedText";

/**
 * The one client boundary on the Knowledge/introduction page -- wraps
 * the fields content-lib/i18n.ts's localizeKnowledge() actually
 * translates (title, body). Fixes a real bug: the page previously called
 * loadKnowledgeRecord() and rendered `record.title`/`record.body`
 * directly with no localizeKnowledge() call at all, so the introduction
 * page stayed English regardless of the language switcher (mobile's
 * equivalent screen, mobile/app/(tabs)/divya-desams/introduction.tsx,
 * always localized it). `contentType` (e.g. "educational") is a plain
 * data field on the record, not translated content, and is rendered
 * verbatim as the eyebrow above the title, matching mobile.
 */
export function LocalizedKnowledgeContent({
  record,
  badge,
  images,
}: {
  record: PublicKnowledge;
  badge: ReactNode;
  /** Rendered between the title and the body, matching mobile's header -> ContentImage -> Section order. */
  images: ReactNode;
}) {
  const { language } = useLanguage();
  const localized = useMemo(() => localizeKnowledge(record, language), [record, language]);

  return (
    <>
      <div className="space-y-2">
        <p className="eyebrow text-[var(--accent)]">{record.contentType}</p>
        {badge}
        <h1 className="page-title">{localized.title}</h1>
      </div>

      {images}

      {localized.body ? (
        <LongFormSection text={localized.body} />
      ) : (
        <LocalizedText stringKey="noRecordContentYet" className="prose-body text-[var(--muted)]" />
      )}
    </>
  );
}
