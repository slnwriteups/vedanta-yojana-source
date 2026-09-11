import type { DivyaDesamRegion } from "./schemas/index.ts";
import type { LanguageCode } from "../lib/preferences";

/**
 * Native-script transliterations of the seven traditional Sri Vaishnava
 * regional classifications (content-lib/schemas/divya-desam.ts's
 * DIVYA_DESAM_REGION_ORDER). Unlike ui-strings.ts's pick()-based UI
 * chrome, these are proper geographical terms -- transliterated into
 * Tamil/Kannada/Devanagari script, not translated into different words,
 * matching the same IAST-to-native-script relationship the English forms
 * already have (e.g. "Chōḻa Nāḍu" is itself a transliteration, not an
 * English translation, of சோழ நாடு).
 */
const REGION_LABELS: Record<DivyaDesamRegion, { ta: string; kn: string; hi: string }> = {
  "Chōḻa Nāḍu": { ta: "சோழ நாடு", kn: "ಚೋಳ ನಾಡು", hi: "चोल नाडु" },
  "Naḍu Nāḍu": { ta: "நடு நாடு", kn: "ನಡು ನಾಡು", hi: "नडु नाडु" },
  "Toṇḍai Nāḍu": { ta: "தொண்டை நாடு", kn: "ತೊಂಡೈ ನಾಡು", hi: "तोंडई नाडु" },
  "Malai Nāḍu": { ta: "மலை நாடு", kn: "ಮಲೈ ನಾಡು", hi: "मलई नाडु" },
  "Pāṇḍya Nāḍu": { ta: "பாண்டிய நாடு", kn: "ಪಾಂಡ್ಯ ನಾಡು", hi: "पांड्य नाडु" },
  "Vada Nāḍu": { ta: "வட நாடு", kn: "ವಡ ನಾಡು", hi: "वड नाडु" },
  "Viṇṇulaga Tiruppatigaḷ": {
    ta: "விண்ணுலக திருப்பதிகள்",
    kn: "ವಿಣ್ಣುಲಗ ತಿರುಪ್ಪತಿಗಳ್",
    hi: "विण्णुलग तिरुप्पतिगळ्",
  },
};

/** English (language === null) stays the IAST form already used as this app's canonical region value. */
export function regionLabel(region: DivyaDesamRegion, language: LanguageCode | null): string {
  return language ? REGION_LABELS[region][language] : region;
}
