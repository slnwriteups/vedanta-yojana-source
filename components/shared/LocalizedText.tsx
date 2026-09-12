"use client";

import { useT, type UiStringKey } from "@/lib/ui-strings";

/**
 * A single localized ui-strings.ts string rendered as plain text (empty
 * states, fallback copy) -- the same tiny client-wrapper pattern as
 * LocalizedPageHeading.tsx, for spots that need only a `<p>`/`<span>`
 * rather than an `<h1>`.
 */
export function LocalizedText({
  stringKey,
  className,
  as: Tag = "p",
}: {
  stringKey: UiStringKey;
  className?: string;
  as?: "p" | "span";
}) {
  const t = useT();
  return <Tag className={className}>{t(stringKey)}</Tag>;
}
