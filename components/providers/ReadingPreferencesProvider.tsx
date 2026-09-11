"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_READING_PREFERENCES,
  READING_STORAGE_KEY,
  isValidReadingPreferences,
  type ReadingPreferences,
} from "@/lib/preferences";
import { ReadingPreferencesContext, type ReadingPreferencesContextValue } from "@/lib/reading-preferences-context";
import { readJSON, writeJSON } from "@/lib/storage";

/**
 * Web port of mobile/ReadingPreferencesProvider.tsx. Loads a persisted
 * font-scale preference once on mount (falling back silently to the
 * default if nothing is stored or the stored value is invalid), and
 * persists every change. Same brief-first-paint tradeoff as
 * ThemeProvider/LanguageProvider: the default (1x) is also the most
 * common case.
 */
export function ReadingPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ReadingPreferences>(DEFAULT_READING_PREFERENCES);

  useEffect(() => {
    let cancelled = false;
    readJSON(READING_STORAGE_KEY, isValidReadingPreferences).then((stored) => {
      if (!cancelled && stored) setPreferences(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ReadingPreferencesContextValue>(
    () => ({
      preferences,
      setFontScale: (fontScale: number) => {
        const next = { fontScale };
        setPreferences(next);
        void writeJSON(READING_STORAGE_KEY, next);
      },
    }),
    [preferences]
  );

  return <ReadingPreferencesContext.Provider value={value}>{children}</ReadingPreferencesContext.Provider>;
}
