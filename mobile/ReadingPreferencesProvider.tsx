import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_READING_PREFERENCES,
  READING_STORAGE_KEY,
  isValidReadingPreferences,
  normalizeReadingPreferences,
  type ReadingPreferences,
} from "./content-lib/preferences.ts";
import { ReadingPreferencesContext, type ReadingPreferencesContextValue } from "./preferences-context.ts";
import { readJSON, writeJSON } from "./storage.ts";

/**
 * Phase 6D -- loads a persisted font-scale preference once on mount
 * (falling back silently to the default if nothing is stored or the
 * stored value is invalid), and persists every change. No loading
 * screen/flash-of-wrong-size handling beyond that: the default (1x) is
 * also the most common case, so mounting with it before the async read
 * resolves is an acceptable, brief first paint -- matching "keep
 * implementation minimal" from the brief.
 */
export function ReadingPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ReadingPreferences>(DEFAULT_READING_PREFERENCES);

  useEffect(() => {
    let cancelled = false;
    readJSON(READING_STORAGE_KEY, isValidReadingPreferences).then((stored) => {
      if (!cancelled && stored) setPreferences(normalizeReadingPreferences(stored));
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
