import { Platform } from "react-native";
import { isLoaded } from "expo-font";
import { typography } from "./theme";
import type { LanguageCode } from "./content-lib/preferences.ts";

/**
 * Kannada and Telugu reading text need a font that lays their conjuncts
 * out whole. The usual reading face, Georgia, has neither script, so
 * without this each character falls back to whatever font the system
 * picks for it.
 *
 * iOS: React Native draws text with TextKit 1, which misplaces a glyph of
 * conjuncts such as ಸ್ತೋ with Georgia's Kannada fallback (Kannada Sangam
 * MN/MN) and with the Noto Kannada fonts: a blank gap with the vowel sign
 * stranded or thrown to the margin. Apple's system Kannada font lays out
 * all 4,651 Kannada paragraphs of the Sahasranaama correctly in regular and
 * bold, so Kannada uses the system font on iOS. Telugu, a close sister
 * script with the same kind of stacked conjuncts and vowel signs, takes
 * the same route: Apple's system Telugu font (Kohinoor Telugu) rather than
 * Georgia's per-character fallback.
 *
 * Android: Noto Serif Kannada and Noto Serif Telugu (the web's reading
 * faces, OFL, bundled in assets/fonts), so every Android version shows
 * the same face as the website. Latin, digits and Devanagari, which
 * they lack or barely cover, fall back cleanly.
 */
export const READING_FONT_ASSETS = {
  NotoSerifKannada: require("./assets/fonts/NotoSerifKannada-Regular.ttf"),
  "NotoSerifKannada-Bold": require("./assets/fonts/NotoSerifKannada-Bold.ttf"),
  NotoSerifTelugu: require("./assets/fonts/NotoSerifTelugu-Regular.ttf"),
  "NotoSerifTelugu-Bold": require("./assets/fonts/NotoSerifTelugu-Bold.ttf"),
};

/** The bundled Android reading family for each script that has one. */
const BUNDLED_FAMILY: Partial<Record<LanguageCode, string>> = {
  kn: "NotoSerifKannada",
  te: "NotoSerifTelugu",
};

/**
 * The reading face for `language`. Bold names the Bold file and resets the
 * weight, so Android never synthesises a fake bold over it. Until the font
 * has loaded (or if it failed to), the usual face is used.
 */
export function readingFont(
  language: LanguageCode | null,
  bold = false,
): { fontFamily: string | undefined; fontWeight?: "400" } {
  const bundled = language ? BUNDLED_FAMILY[language] : undefined;
  // undefined = the system font; a subheading's fontWeight "700" gives its true bold.
  if (bundled && Platform.OS === "ios") return { fontFamily: undefined };
  if (bundled) {
    const family = bold ? `${bundled}-Bold` : bundled;
    if (isLoaded(family)) return bold ? { fontFamily: family, fontWeight: "400" } : { fontFamily: family };
  }
  return { fontFamily: Platform.select(typography.readingFontFamily) };
}
