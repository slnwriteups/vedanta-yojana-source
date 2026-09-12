"use client";

import { useT, type UiStringKey } from "@/lib/ui-strings";

/**
 * A page's own `<h1>`, localized via the same ui-strings.ts catalog
 * mobile's screen titles already use (e.g. `tabLibrary`, `tabDivyaDesams`,
 * `tabSearch`) -- so switching the language switcher actually retitles
 * the page, matching mobile's native header, instead of leaving a
 * hardcoded English heading behind while the content below it
 * translates. A tiny client component (mirrors LocalizedBookHeader.tsx's
 * pattern) since useT() needs the client-side language context; the
 * server page around it stays a server component.
 */
export function LocalizedPageHeading({ stringKey }: { stringKey: UiStringKey }) {
  const t = useT();
  return <h1 className="page-title">{t(stringKey)}</h1>;
}
