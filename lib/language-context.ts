import { createContext, useContext } from "react";
import type { LanguageCode } from "./preferences";

/**
 * Web port of mobile/language-context.ts, plus `ready`. Reader-facing
 * content-language context, split from its Provider
 * (components/providers/LanguageProvider.tsx) the same way
 * ReadingPreferencesContext/ThemeContext already are.
 */
export interface LanguageContextValue {
  /** null = English, the base language every record always has. */
  language: LanguageCode | null;
  setLanguage: (language: LanguageCode | null) => void;
  /**
   * False until the saved choice has been read back, so a consumer that
   * must not act on the English default in the meantime (the page-view
   * ping) can wait for it.
   */
  ready: boolean;
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: null,
  setLanguage: () => {},
  ready: true,
});

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
