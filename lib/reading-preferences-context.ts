import { createContext, useContext } from "react";
import { DEFAULT_READING_PREFERENCES, type ReadingPreferences } from "./preferences";

/**
 * Web port of mobile/preferences-context.ts, verbatim. Reading-preferences
 * context, split from its Provider (components/providers/
 * ReadingPreferencesProvider.tsx) the same way ThemeContext/
 * LanguageContext already are.
 */
export interface ReadingPreferencesContextValue {
  preferences: ReadingPreferences;
  setFontScale: (fontScale: number) => void;
}

export const ReadingPreferencesContext = createContext<ReadingPreferencesContextValue>({
  preferences: DEFAULT_READING_PREFERENCES,
  setFontScale: () => {},
});

export function useReadingPreferences(): ReadingPreferencesContextValue {
  return useContext(ReadingPreferencesContext);
}
