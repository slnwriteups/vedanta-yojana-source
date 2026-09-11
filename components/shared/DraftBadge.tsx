"use client";

import { useLanguage } from "@/lib/language-context";
import { translateUi } from "@/lib/ui-strings";

/**
 * Restrained draft/review indicator -- originally Phase 5K (Divya Desam),
 * relocated to components/shared/ in Phase 5L for reuse across Book,
 * Chapter, and Knowledge presentation, none of which are Divya-Desam-
 * specific. Client component (mirrors mobile/components/DraftBadge.tsx)
 * so its copy can follow the reader's language preference via
 * lib/ui-strings.ts, same as every other piece of UI chrome.
 *
 * Every migrated record currently has status "draft"; this makes that
 * state visible rather than letting the page look editorially finalized.
 * Internal migration metadata (sourcePageId, extractionConfidence) is
 * deliberately never surfaced here -- only the two public-facing signals
 * (status, needsReview) that every content type already exposes.
 */
export function DraftBadge({
  status,
  needsReview,
}: {
  status: string;
  needsReview: boolean;
}) {
  const { language } = useLanguage();
  if (status !== "draft") return null;

  return (
    <p
      className="eyebrow"
      aria-label={
        translateUi("draftBadgeA11y", language) +
        (needsReview ? translateUi("draftBadgeFlaggedA11ySuffix", language) : "")
      }
    >
      {translateUi("draftBadge", language)}
      {needsReview ? translateUi("draftBadgeFlaggedSuffix", language) : ""}
    </p>
  );
}
