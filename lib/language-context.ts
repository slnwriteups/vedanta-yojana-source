import { createContext, useContext } from "react";
import type { LanguageCode } from "./preferences";

/**
 * Web port of mobile/language-context.ts, verbatim. Reader-facing
 * content-language context, split from its Provider
 * (components/providers/LanguageProvider.tsx) the same way
 * ReadingPreferencesContext/ThemeContext already are.
 */
export interface LanguageContextValue {
  /** null = English, the base language every record always has. */
  language: LanguageCode | null;
  setLanguage: (language: LanguageCode | null) => void;
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: null,
  setLanguage: () => {},
});

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
