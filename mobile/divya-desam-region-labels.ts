import type { DivyaDesamRegion } from "../content-lib/schemas/index.ts";
import type { LanguageCode } from "./content-lib/preferences.ts";

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
const REGION_LABELS: Record<DivyaDesamRegion, { ta: string; kn: string; hi: string; te: string }> = {
  "Chōḻa Nāḍu": { ta: "சோழ நாடு", kn: "ಚೋಳ ನಾಡು", hi: "चोल नाडु", te: "చోళ నాడు" },
  "Naḍu Nāḍu": { ta: "நடு நாடு", kn: "ನಡು ನಾಡು", hi: "नडु नाडु", te: "నడు నాడు" },
  "Toṇḍai Nāḍu": { ta: "தொண்டை நாடு", kn: "ತೊಂಡೈ ನಾಡು", hi: "तोंडई नाडु", te: "తొండై నాడు" },
  "Malai Nāḍu": { ta: "மலை நாடு", kn: "ಮಲೈ ನಾಡು", hi: "मलई नाडु", te: "మలై నాడు" },
  "Pāṇḍya Nāḍu": { ta: "பாண்டிய நாடு", kn: "ಪಾಂಡ್ಯ ನಾಡು", hi: "पांड्य नाडु", te: "పాండ్య నాడు" },
  "Vada Nāḍu": { ta: "வட நாடு", kn: "ವಡ ನಾಡು", hi: "वड नाडु", te: "వడ నాడు" },
  "Viṇṇulaga Tiruppatigaḷ": {
    ta: "விண்ணுலக திருப்பதிகள்",
    kn: "ವಿಣ್ಣುಲಗ ತಿರುಪ್ಪತಿಗಳ್",
    hi: "विण्णुलग तिरुप्पतिगळ्",
    te: "విణ్ణుళగ తిరుప్పతిగళ్",
  },
};

/** English (language === null) stays the IAST form already used as this app's canonical region value. */
export function regionLabel(region: DivyaDesamRegion, language: LanguageCode | null): string {
  return language ? REGION_LABELS[region][language] : region;
}
