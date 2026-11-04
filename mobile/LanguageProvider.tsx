import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGUAGE_STORAGE_KEY, isValidLanguageCode, type LanguageCode } from "./content-lib/preferences.ts";
import { LanguageContext, type LanguageContextValue } from "./language-context.ts";
import { readJSON, writeJSON } from "./storage.ts";

/**
 * Same shape as ThemeProvider.tsx/ReadingPreferencesProvider.tsx: loads
 * the persisted language choice once on mount (defaulting to English --
 * `null` -- until that read resolves, the same brief first-paint
 * tradeoff those two providers already make), persists every change.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readJSON(LANGUAGE_STORAGE_KEY, isValidLanguageCode).then((stored) => {
      if (cancelled) return;
      if (stored !== null) setLanguageState(stored);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      ready,
      setLanguage: (next: LanguageCode | null) => {
        setLanguageState(next);
        setReady(true);
        void writeJSON(LANGUAGE_STORAGE_KEY, next);
      },
    }),
    [language, ready]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
