import { createContext, useContext } from "react";
import type { LanguageCode } from "./content-lib/preferences.ts";

/**
 * Reader-facing content-language context, split from its Provider
 * (LanguageProvider.tsx) the same way ReadingPreferencesContext/
 * ThemeContext already are -- plain function calls with no JSX, so this
 * stays importable under `node --test`.
 */
export interface LanguageContextValue {
  /** null = English, the base language every record always has. */
  language: LanguageCode | null;
  /**
   * False until the saved choice has been read (language is English
   * meanwhile). Anything written out of the app in the reader's
   * language -- the Ekadasi notifications -- waits for it.
   */
  ready: boolean;
  setLanguage: (language: LanguageCode | null) => void;
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: null,
  ready: false,
  setLanguage: () => {},
});

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
