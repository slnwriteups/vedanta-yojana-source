import { Platform } from "react-native";
import { typography } from "./theme";
import type { LanguageCode } from "./content-lib/preferences.ts";

/**
 * The reading face for `language`.
 *
 * Kannada on iOS uses Apple's system Kannada font. React Native draws iOS
 * text with TextKit 1, which misplaces a glyph of conjuncts such as ಸ್ತೋ
 * with Kannada Sangam MN/MN (Georgia's Kannada fallback) and the Noto
 * Kannada fonts: a blank gap with the vowel sign stranded or thrown to the
 * margin. The system font lays out all 4,651 Kannada paragraphs of the
 * Sahasranaama correctly in regular and bold. `undefined` selects it, and a
 * subheading's fontWeight "700" still gives its true bold.
 *
 * Every other case (Android, other languages) keeps the usual reading face.
 */
export function readingFont(language: LanguageCode | null): { fontFamily: string | undefined } {
  if (language === "kn" && Platform.OS === "ios") return { fontFamily: undefined };
  return { fontFamily: Platform.select(typography.readingFontFamily) };
}
