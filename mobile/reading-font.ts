import { Platform } from "react-native";
import { isLoaded } from "expo-font";
import { typography } from "./theme";
import type { LanguageCode } from "./content-lib/preferences.ts";

/**
 * Kannada reading text needs a font that lays its conjuncts out whole.
 *
 * iOS: React Native draws text with TextKit 1, which misplaces a glyph of
 * conjuncts such as ಸ್ತೋ with every OpenType Kannada font tested (Noto
 * Serif/Sans Kannada, Kannada Sangam MN, Kannada MN, and Georgia's
 * fallback): a blank gap with the vowel sign stranded or thrown to the
 * margin. Apple's system Kannada font lays them out correctly, so Kannada
 * uses the system font on iOS.
 *
 * Android: HarfBuzz shapes every Kannada run in the content correctly
 * with Noto Serif Kannada, the website's Kannada reading face (Google
 * Fonts v2.005, static 400/700 instances, OFL, bundled in assets/fonts).
 */
export const READING_FONT_ASSETS = {
  NotoSerifKannada: require("./assets/fonts/NotoSerifKannada-Regular.ttf"),
  "NotoSerifKannada-Bold": require("./assets/fonts/NotoSerifKannada-Bold.ttf"),
};

/**
 * The reading face for `language`. Bold Kannada on Android names the Bold
 * file and resets the weight, so Android never synthesises a fake bold.
 * Until the font has loaded (or if it failed to), the usual face is used.
 */
export function readingFont(
  language: LanguageCode | null,
  bold = false,
): { fontFamily: string | undefined; fontWeight?: "400" } {
  if (language === "kn") {
    if (Platform.OS === "ios") return { fontFamily: undefined };
    const family = bold ? "NotoSerifKannada-Bold" : "NotoSerifKannada";
    if (isLoaded(family)) return bold ? { fontFamily: family, fontWeight: "400" } : { fontFamily: family };
  }
  return { fontFamily: Platform.select(typography.readingFontFamily) };
}
