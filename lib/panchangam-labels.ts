import type { LanguageCode } from "./preferences";

/**
 * Web port of mobile/panchangam-labels.ts, verbatim (content unchanged,
 * only the import path differs). Native-script transliterations for the
 * Panchangam vocabulary lib/panchangam-service.ts returns (paksha,
 * tithi, nakshatram) -- same convention as
 * content-lib/divya-desam-region-labels.ts: real Sanskrit/Tamil calendar
 * terms are transliterated into Tamil/Kannada/Devanagari script, not
 * translated into different words. English (language === null) keeps
 * the source API's own value untouched.
 *
 * Unlike DivyaDesamRegion's small closed enum, these values come
 * straight from a third-party API's free-text response, so each map is
 * keyed by exactly the capitalized string parseDailyCalendar() /
 * parseUpcomingEkadashi() produce, with a fallback to the original
 * English value for anything not yet mapped -- a missing entry
 * degrades to English, never a blank or wrong label.
 *
 * Deliberately does NOT cover `festival`, `upcomingEkadashiText`, or
 * `sankalpamText`: those are open-ended prose the calendar API
 * generates fresh per day (dozens of distinct festival names across a
 * year, a full sentence for Ekadashi/Sankalpam), not a small fixed
 * vocabulary -- there is no lookup table that could cover them
 * correctly, unlike the ~45 fixed paksha/tithi/nakshatram values below.
 */

const PAKSHA_LABELS: Record<string, { ta: string; kn: string; hi: string }> = {
  "Shukla Paksha": { ta: "சுக்ல பக்ஷம்", kn: "ಶುಕ್ಲ ಪಕ್ಷ", hi: "शुक्ल पक्ष" },
  "Krishna Paksha": { ta: "கிருஷ்ண பக்ஷம்", kn: "ಕೃಷ್ಣ ಪಕ್ಷ", hi: "कृष्ण पक्ष" },
};

const TITHI_LABELS: Record<string, { ta: string; kn: string; hi: string }> = {
  Prathama: { ta: "பிரதமை", kn: "ಪ್ರಥಮ", hi: "प्रथमा" },
  Dvithiya: { ta: "துவிதியை", kn: "ದ್ವಿತೀಯಾ", hi: "द्वितीया" },
  Trithiya: { ta: "திருதியை", kn: "ತೃತೀಯಾ", hi: "तृतीया" },
  Chaturthi: { ta: "சதுர்த்தி", kn: "ಚತುರ್ಥಿ", hi: "चतुर्थी" },
  Panchami: { ta: "பஞ்சமி", kn: "ಪಂಚಮಿ", hi: "पञ्चमी" },
  Shashthi: { ta: "சஷ்டி", kn: "ಷಷ್ಠಿ", hi: "षष्ठी" },
  Saptami: { ta: "சப்தமி", kn: "ಸಪ್ತಮಿ", hi: "सप्तमी" },
  Ashtami: { ta: "அஷ்டமி", kn: "ಅಷ್ಟಮಿ", hi: "अष्टमी" },
  Navami: { ta: "நவமி", kn: "ನವಮಿ", hi: "नवमी" },
  Dasami: { ta: "தசமி", kn: "ದಶಮಿ", hi: "दशमी" },
  Ekadasi: { ta: "ஏகாதசி", kn: "ಏಕಾದಶಿ", hi: "एकादशी" },
  Dvadasi: { ta: "துவாதசி", kn: "ದ್ವಾದಶಿ", hi: "द्वादशी" },
  Trayodasi: { ta: "திரயோதசி", kn: "ತ್ರಯೋದಶಿ", hi: "त्रयोदशी" },
  Chaturdasi: { ta: "சதுர்த்தசி", kn: "ಚತುರ್ದಶಿ", hi: "चतुर्दशी" },
  Pournami: { ta: "பௌர்ணமி", kn: "ಹುಣ್ಣಿಮೆ", hi: "पूर्णिमा" },
  Amavasya: { ta: "அமாவாசை", kn: "ಅಮಾವಾಸ್ಯೆ", hi: "अमावस्या" },
};

/** Full 27-nakshatra cycle. The six Purva/Uttara-qualified entries are each their own distinct traditional name (esp. in Tamil), not a composed "qualifier + base" -- so each is its own key, keyed by exactly what parseDailyCalendar()'s "Purva "/"Uttara " expansion produces. */
const NAKSHATRAM_LABELS: Record<string, { ta: string; kn: string; hi: string }> = {
  Aswini: { ta: "அஸ்வினி", kn: "ಅಶ್ವಿನಿ", hi: "अश्विनी" },
  Asvini: { ta: "அஸ்வினி", kn: "ಅಶ್ವಿನಿ", hi: "अश्विनी" },
  Bharani: { ta: "பரணி", kn: "ಭರಣಿ", hi: "भरणी" },
  Krittika: { ta: "கார்த்திகை", kn: "ಕೃತ್ತಿಕಾ", hi: "कृत्तिका" },
  Rohini: { ta: "ரோகிணி", kn: "ರೋಹಿಣಿ", hi: "रोहिणी" },
  Mrigasira: { ta: "மிருகசீரிடம்", kn: "ಮೃಗಶಿರಾ", hi: "मृगशिरा" },
  Ardra: { ta: "திருவாதிரை", kn: "ಆರ್ದ್ರಾ", hi: "आर्द्रा" },
  Punarvasu: { ta: "புனர்பூசம்", kn: "ಪುನರ್ವಸು", hi: "पुनर्वसु" },
  Pushyami: { ta: "பூசம்", kn: "ಪುಷ್ಯ", hi: "पुष्य" },
  Pushya: { ta: "பூசம்", kn: "ಪುಷ್ಯ", hi: "पुष्य" },
  Aslesha: { ta: "ஆயில்யம்", kn: "ಆಶ್ಲೇಷಾ", hi: "आश्लेषा" },
  Makha: { ta: "மகம்", kn: "ಮಖಾ", hi: "मघा" },
  "Purva Phalguni": { ta: "பூரம்", kn: "ಪೂರ್ವ ಫಲ್ಗುಣಿ", hi: "पूर्व फाल्गुनी" },
  "Uttara Phalguni": { ta: "உத்திரம்", kn: "ಉತ್ತರ ಫಲ್ಗುಣಿ", hi: "उत्तर फाल्गुनी" },
  Hasta: { ta: "அஸ்தம்", kn: "ಹಸ್ತಾ", hi: "हस्त" },
  Chitra: { ta: "சித்திரை", kn: "ಚಿತ್ರಾ", hi: "चित्रा" },
  Swathi: { ta: "சுவாதி", kn: "ಸ್ವಾತಿ", hi: "स्वाति" },
  Swati: { ta: "சுவாதி", kn: "ಸ್ವಾತಿ", hi: "स्वाति" },
  Visakha: { ta: "விசாகம்", kn: "ವಿಶಾಖಾ", hi: "विशाखा" },
  Anuradha: { ta: "அனுஷம்", kn: "ಅನುರಾಧಾ", hi: "अनुराधा" },
  Jyeshta: { ta: "கேட்டை", kn: "ಜ್ಯೇಷ್ಠಾ", hi: "ज्येष्ठा" },
  Moola: { ta: "மூலம்", kn: "ಮೂಲಾ", hi: "मूल" },
  "Purva Ashadha": { ta: "பூராடம்", kn: "ಪೂರ್ವ ಆಷಾಢ", hi: "पूर्व आषाढ़" },
  "Uttara Ashadha": { ta: "உத்திராடம்", kn: "ಉತ್ತರ ಆಷಾಢ", hi: "उत्तर आषाढ़" },
  Shravana: { ta: "திருவோணம்", kn: "ಶ್ರವಣ", hi: "श्रवण" },
  Sravana: { ta: "திருவோணம்", kn: "ಶ್ರವಣ", hi: "श्रवण" },
  Dhanishta: { ta: "அவிட்டம்", kn: "ಧನಿಷ್ಠಾ", hi: "धनिष्ठा" },
  Satabhisha: { ta: "சதயம்", kn: "ಶತಭಿಷಾ", hi: "शतभिषा" },
  "Purva Bhadrapada": { ta: "பூரட்டாதி", kn: "ಪೂರ್ವ ಭಾದ್ರಪದ", hi: "पूर्व भाद्रपद" },
  "Uttara Bhadrapada": { ta: "உத்திரட்டாதி", kn: "ಉತ್ತರ ಭಾದ್ರಪದ", hi: "उत्तर भाद्रपद" },
  "Purva Badra": { ta: "பூரட்டாதி", kn: "ಪೂರ್ವ ಭಾದ್ರಪದ", hi: "पूर्व भाद्रपद" },
  "Uttara Badra": { ta: "உத்திரட்டாதி", kn: "ಉತ್ತರ ಭಾದ್ರಪದ", hi: "उत्तर भाद्रपद" },
  Revathi: { ta: "ரேவதி", kn: "ರೇವತಿ", hi: "रेवती" },
};

export function pakshaLabel(paksha: string, language: LanguageCode | null): string {
  if (!language || !paksha) return paksha;
  return PAKSHA_LABELS[paksha]?.[language] ?? paksha;
}

export function tithiLabel(tithi: string, language: LanguageCode | null): string {
  if (!language || !tithi) return tithi;
  return TITHI_LABELS[tithi]?.[language] ?? tithi;
}

export function nakshatramLabel(nakshatram: string, language: LanguageCode | null): string {
  if (!language || !nakshatram) return nakshatram;
  return NAKSHATRAM_LABELS[nakshatram]?.[language] ?? nakshatram;
}
