import { Platform } from "react-native";
import { isLoaded } from "expo-font";
import { typography } from "./theme";
import type { LanguageCode } from "./content-lib/preferences.ts";

/**
 * Kannada reading text needs a font that actually contains Kannada.
 * Georgia (the iOS reading face) has none, so iOS substitutes per
 * character, and in some contexts it splits a conjunct such as ಸ್ತೋ
 * across fonts: a blank gap with the vowel sign stranded beside it.
 * Naming Noto Serif Kannada (the web's Kannada reading face, OFL, bundled
 * in assets/fonts) keeps every Kannada cluster in one font. Latin,
 * digits and Devanagari, which it lacks, still fall back cleanly.
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
  if (language === "kn") {
    const family = bold ? "NotoSerifKannada-Bold" : "NotoSerifKannada";
    if (isLoaded(family)) return bold ? { fontFamily: family, fontWeight: "400" } : { fontFamily: family };
  }
  return { fontFamily: Platform.select(typography.readingFontFamily) };
}
