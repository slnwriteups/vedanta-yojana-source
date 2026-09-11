"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGUAGE_STORAGE_KEY, isValidLanguageCode, type LanguageCode } from "@/lib/preferences";
import { LanguageContext, type LanguageContextValue } from "@/lib/language-context";
import { readJSON, writeJSON } from "@/lib/storage";

/**
 * Web port of mobile/LanguageProvider.tsx. Loads the persisted language
 * choice once on mount (defaulting to English -- null -- until that read
 * resolves, the same brief first-paint tradeoff ThemeProvider makes),
 * persists every change.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode | null>(null);

  useEffect(() => {
    let cancelled = false;
    readJSON(LANGUAGE_STORAGE_KEY, isValidLanguageCode).then((stored) => {
      if (!cancelled && stored !== null) setLanguageState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (next: LanguageCode | null) => {
        setLanguageState(next);
        void writeJSON(LANGUAGE_STORAGE_KEY, next);
      },
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
