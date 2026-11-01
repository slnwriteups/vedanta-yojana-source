import { Platform } from "react-native";
import { isLoaded } from "expo-font";
import { typography } from "./theme";
import type { LanguageCode } from "./content-lib/preferences.ts";

/**
 * Kannada reading text needs a font that lays its conjuncts out whole.
 *
 * iOS: React Native draws text with TextKit 1, which misplaces a glyph of
 * conjuncts such as ಸ್ತೋ with Georgia's Kannada fallback (Kannada Sangam
 * MN/MN) and with the Noto Kannada fonts: a blank gap with the vowel sign
 * stranded or thrown to the margin. Apple's system Kannada font lays out
 * all 4,651 Kannada paragraphs of the Sahasranaama correctly in regular and
 * bold, so Kannada uses the system font on iOS.
 *
 * Android: Noto Serif Kannada (the web's Kannada reading face, OFL, bundled
 * in assets/fonts). Latin, digits and Devanagari, which it lacks, fall
 * back cleanly.
 */
export const READING_FONT_ASSETS = {
  NotoSerifKannada: require("./assets/fonts/NotoSerifKannada-Regular.ttf"),
  "NotoSerifKannada-Bold": require("./assets/fonts/NotoSerifKannada-Bold.ttf"),
};

/**
 * The reading face for `language`. Bold Kannada names the Bold file and
 * resets the weight, so Android never synthesises a fake bold over it.
 * Until the font has loaded (or if it failed to), the usual face is used.
 */
export function readingFont(
  language: LanguageCode | null,
  bold = false,
): { fontFamily: string | undefined; fontWeight?: "400" } {
  // undefined = the system font; a subheading's fontWeight "700" gives its true bold.
  if (language === "kn" && Platform.OS === "ios") return { fontFamily: undefined };
  if (language === "kn") {
    const family = bold ? "NotoSerifKannada-Bold" : "NotoSerifKannada";
    if (isLoaded(family)) return bold ? { fontFamily: family, fontWeight: "400" } : { fontFamily: family };
  }
  return { fontFamily: Platform.select(typography.readingFontFamily) };
}
