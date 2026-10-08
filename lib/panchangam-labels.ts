import type { LanguageCode } from "./preferences";

/**
 * Web port of mobile/panchangam-labels.ts, verbatim (content unchanged,
 * only the import path differs). Native-script transliterations for the
 * Panchangam vocabulary lib/panchangam-service.ts returns (paksha,
 * tithi, nakshatram) -- same convention as
 * content-lib/divya-desam-region-labels.ts: real Sanskrit/Tamil calendar
 * terms are transliterated into Tamil/Kannada/Devanagari script, not
 * translated into different words. English (language === null) keeps
 * the engine's English value untouched.
 *
 * Each map is keyed by exactly the English name
 * content-lib/panchangam-engine.ts produces (TITHI/NAKSHATRA name
 * lists there), with a fallback to the English value for anything not
 * mapped -- a missing entry degrades to English, never a blank or wrong
 * label.
 *
 * Does NOT cover `festival` (left in English, as before).
 *
 * `upcomingEkadashiText`/`sankalpamText` ARE partially covered, by
 * localizeUpcomingEkadashi()/localizeSankalpamText() below: the
 * date/time/Sanskrit-declaration values inside them are left untouched,
 * but the FIXED English wrapper phrasing around those values ("Next
 * Ekadasi:", "Sankalpam for X on Y At Z IST and valid through W of
 * following day:") is a closed, known shape the engine always produces,
 * so it can be safely pattern-matched and re-templated per language
 * without ever altering the dynamic values themselves.
 */

const PAKSHA_LABELS: Record<string, Record<LanguageCode, string>> = {
  "Shukla Paksha": { ta: "சுக்ல பக்ஷம்", kn: "ಶುಕ್ಲ ಪಕ್ಷ", hi: "शुक्ल पक्ष", te: "శుక్ల పక్షం" },
  "Krishna Paksha": { ta: "கிருஷ்ண பக்ஷம்", kn: "ಕೃಷ್ಣ ಪಕ್ಷ", hi: "कृष्ण पक्ष", te: "కృష్ణ పక్షం" },
};

const TITHI_LABELS: Record<string, Record<LanguageCode, string>> = {
  Prathama: { ta: "பிரதமை", kn: "ಪ್ರಥಮ", hi: "प्रथमा", te: "ప్రథమ" },
  Dvithiya: { ta: "துவிதியை", kn: "ದ್ವಿತೀಯಾ", hi: "द्वितीया", te: "ద్వితీయ" },
  Trithiya: { ta: "திருதியை", kn: "ತೃತೀಯಾ", hi: "तृतीया", te: "తృతీయ" },
  Chaturthi: { ta: "சதுர்த்தி", kn: "ಚತುರ್ಥಿ", hi: "चतुर्थी", te: "చతుర్థి" },
  Panchami: { ta: "பஞ்சமி", kn: "ಪಂಚಮಿ", hi: "पञ्चमी", te: "పంచమి" },
  Shashthi: { ta: "சஷ்டி", kn: "ಷಷ್ಠಿ", hi: "षष्ठी", te: "షష్ఠి" },
  Saptami: { ta: "சப்தமி", kn: "ಸಪ್ತಮಿ", hi: "सप्तमी", te: "సప్తమి" },
  Ashtami: { ta: "அஷ்டமி", kn: "ಅಷ್ಟಮಿ", hi: "अष्टमी", te: "అష్టమి" },
  Navami: { ta: "நவமி", kn: "ನವಮಿ", hi: "नवमी", te: "నవమి" },
  Dasami: { ta: "தசமி", kn: "ದಶಮಿ", hi: "दशमी", te: "దశమి" },
  Ekadasi: { ta: "ஏகாதசி", kn: "ಏಕಾದಶಿ", hi: "एकादशी", te: "ఏకాదశి" },
  Dvadasi: { ta: "துவாதசி", kn: "ದ್ವಾದಶಿ", hi: "द्वादशी", te: "ద్వాదశి" },
  Trayodasi: { ta: "திரயோதசி", kn: "ತ್ರಯೋದಶಿ", hi: "त्रयोदशी", te: "త్రయోదశి" },
  Chaturdasi: { ta: "சதுர்த்தசி", kn: "ಚತುರ್ದಶಿ", hi: "चतुर्दशी", te: "చతుర్దశి" },
  Pournami: { ta: "பௌர்ணமி", kn: "ಹುಣ್ಣಿಮೆ", hi: "पूर्णिमा", te: "పౌర్ణమి" },
  Amavasya: { ta: "அமாவாசை", kn: "ಅಮಾವಾಸ್ಯೆ", hi: "अमावस्या", te: "అమావాస్య" },
};

/** Full 27-nakshatra cycle. The six Purva/Uttara-qualified entries are each their own distinct traditional name (esp. in Tamil), not a composed "qualifier + base" -- so each is its own key, keyed by exactly the engine's NAKSHATRA_NAMES spelling (the alternate spellings are kept for the bundled Paduka data and older cached values). */
const NAKSHATRAM_LABELS: Record<string, Record<LanguageCode, string>> = {
  Aswini: { ta: "அஸ்வினி", kn: "ಅಶ್ವಿನಿ", hi: "अश्विनी", te: "అశ్విని" },
  Asvini: { ta: "அஸ்வினி", kn: "ಅಶ್ವಿನಿ", hi: "अश्विनी", te: "అశ్విని" },
  Bharani: { ta: "பரணி", kn: "ಭರಣಿ", hi: "भरणी", te: "భరణి" },
  Krittika: { ta: "கார்த்திகை", kn: "ಕೃತ್ತಿಕಾ", hi: "कृत्तिका", te: "కృత్తిక" },
  Rohini: { ta: "ரோகிணி", kn: "ರೋಹಿಣಿ", hi: "रोहिणी", te: "రోహిణి" },
  Mrigasira: { ta: "மிருகசீரிடம்", kn: "ಮೃಗಶಿರಾ", hi: "मृगशिरा", te: "మృగశిర" },
  Ardra: { ta: "திருவாதிரை", kn: "ಆರ್ದ್ರಾ", hi: "आर्द्रा", te: "ఆర్ద్ర" },
  Punarvasu: { ta: "புனர்பூசம்", kn: "ಪುನರ್ವಸು", hi: "पुनर्वसु", te: "పునర్వసు" },
  Pushyami: { ta: "பூசம்", kn: "ಪುಷ್ಯ", hi: "पुष्य", te: "పుష్యమి" },
  Pushya: { ta: "பூசம்", kn: "ಪುಷ್ಯ", hi: "पुष्य", te: "పుష్యమి" },
  Aslesha: { ta: "ஆயில்யம்", kn: "ಆಶ್ಲೇಷಾ", hi: "आश्लेषा", te: "ఆశ్లేష" },
  Makha: { ta: "மகம்", kn: "ಮಖಾ", hi: "मघा", te: "మఖ" },
  "Purva Phalguni": { ta: "பூரம்", kn: "ಪೂರ್ವ ಫಲ್ಗುಣಿ", hi: "पूर्व फाल्गुनी", te: "పూర్వ ఫల్గుని" },
  "Uttara Phalguni": { ta: "உத்திரம்", kn: "ಉತ್ತರ ಫಲ್ಗುಣಿ", hi: "उत्तर फाल्गुनी", te: "ఉత్తర ఫల్గుని" },
  Hasta: { ta: "அஸ்தம்", kn: "ಹಸ್ತಾ", hi: "हस्त", te: "హస్త" },
  Chitra: { ta: "சித்திரை", kn: "ಚಿತ್ರಾ", hi: "चित्रा", te: "చిత్త" },
  Swathi: { ta: "சுவாதி", kn: "ಸ್ವಾತಿ", hi: "स्वाति", te: "స్వాతి" },
  Swati: { ta: "சுவாதி", kn: "ಸ್ವಾತಿ", hi: "स्वाति", te: "స్వాతి" },
  Visakha: { ta: "விசாகம்", kn: "ವಿಶಾಖಾ", hi: "विशाखा", te: "విశాఖ" },
  Anuradha: { ta: "அனுஷம்", kn: "ಅನುರಾಧಾ", hi: "अनुराधा", te: "అనూరాధ" },
  Jyeshta: { ta: "கேட்டை", kn: "ಜ್ಯೇಷ್ಠಾ", hi: "ज्येष्ठा", te: "జ్యేష్ఠ" },
  Moola: { ta: "மூலம்", kn: "ಮೂಲಾ", hi: "मूल", te: "మూల" },
  "Purva Ashadha": { ta: "பூராடம்", kn: "ಪೂರ್ವ ಆಷಾಢ", hi: "पूर्व आषाढ़", te: "పూర్వాషాఢ" },
  "Uttara Ashadha": { ta: "உத்திராடம்", kn: "ಉತ್ತರ ಆಷಾಢ", hi: "उत्तर आषाढ़", te: "ఉత్తరాషాఢ" },
  Shravana: { ta: "திருவோணம்", kn: "ಶ್ರವಣ", hi: "श्रवण", te: "శ్రవణం" },
  Sravana: { ta: "திருவோணம்", kn: "ಶ್ರವಣ", hi: "श्रवण", te: "శ్రవణం" },
  Dhanishta: { ta: "அவிட்டம்", kn: "ಧನಿಷ್ಠಾ", hi: "धनिष्ठा", te: "ధనిష్ఠ" },
  Satabhisha: { ta: "சதயம்", kn: "ಶತಭಿಷಾ", hi: "शतभिषा", te: "శతభిషం" },
  "Purva Bhadrapada": { ta: "பூரட்டாதி", kn: "ಪೂರ್ವ ಭಾದ್ರಪದ", hi: "पूर्व भाद्रपद", te: "పూర్వాభాద్ర" },
  "Uttara Bhadrapada": { ta: "உத்திரட்டாதி", kn: "ಉತ್ತರ ಭಾದ್ರಪದ", hi: "उत्तर भाद्रपद", te: "ఉత్తరాభాద్ర" },
  "Purva Badra": { ta: "பூரட்டாதி", kn: "ಪೂರ್ವ ಭಾದ್ರಪದ", hi: "पूर्व भाद्रपद", te: "పూర్వాభాద్ర" },
  "Uttara Badra": { ta: "உத்திரட்டாதி", kn: "ಉತ್ತರ ಭಾದ್ರಪದ", hi: "उत्तर भाद्रपद", te: "ఉత్తరాభాద్ర" },
  Revathi: { ta: "ரேவதி", kn: "ರೇವತಿ", hi: "रेवती", te: "రేవతి" },
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

/**
 * content-lib/panchangam-engine.ts always produces exactly "Next
 * Ekadasi: {dateSentence}" (the location-unavailable fallback sentence
 * doesn't match this shape and is returned untouched). Only the fixed
 * "Next Ekadasi:" label is replaced; the date sentence itself is left
 * byte-for-byte.
 */
const NEXT_EKADASHI_PREFIX: Record<LanguageCode, string> = {
  ta: "அடுத்த ஏகாதசி: ",
  kn: "ಮುಂದಿನ ಏಕಾದಶಿ: ",
  hi: "अगली एकादशी: ",
  te: "తదుపరి ఏకాదశి: ",
};

export function localizeUpcomingEkadashi(text: string, language: LanguageCode | null): string {
  if (!language) return text;
  const match = text.match(/^Next Ekadasi:\s*(.*)$/i);
  if (!match) return text;
  return `${NEXT_EKADASHI_PREFIX[language]}${match[1]}`;
}

/**
 * content-lib/panchangam-engine.ts always produces exactly "Sankalpam
 * for {location} on {date} At {time} {zone} and valid through
 * {validUntil}[ of following day]: {declaration}" (or "" when
 * unavailable, which doesn't match this shape and is returned
 * untouched) -- {zone} is the reader's own short time-zone label ("IST",
 * "EDT", "GMT+1"), and "of following day" only appears when the
 * validity window actually crosses midnight into the next calendar day,
 * so the regex and the localized wording both treat it as optional.
 * Only the fixed English wrapper phrasing is re-templated per language;
 * {location}/{date}/{time}/{zone}/{validUntil} are substituted verbatim,
 * and {declaration} -- the Sanskrit sankalpam formula itself
 * ("Parābhava nāma saṁvatsare...") -- is appended untranslated, matching
 * the app's convention that a Sanskrit declaration is always shown in
 * Sanskrit regardless of UI language.
 */
// Matches "2:13 PM" / "07:18 PM" / "03:19:12 PM" -- a real time-of-day, with
// or without seconds. Needed because a bare `:` can't reliably terminate the
// `validUntil` capture below: the time value ITSELF contains colons
// ("03:19:12 PM"), so a generic `(.+?):` stops at the first one, inside the
// time, rather than the one that actually ends the sentence.
const TIME_OF_DAY = /\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M/.source;
// Matches "22nd Sep 2026" -- the engine's own date format. Anchored to
// that shape for the same reason TIME_OF_DAY is: now that a real
// reverse-geocoded place name is named in the sentence, the location capture
// can itself contain the word "on" ("Stratford on Avon", "Newcastle upon
// Tyne"), and a generic `(.+?) on (.+?)` pair splits such a name down
// the middle -- location "Stratford", date "Avon on 22nd Sep 2026".
const DATE_OF_MONTH = /\d{1,2}(?:st|nd|rd|th)\s+[A-Za-z]+\s+\d{4}/.source;
const SANKALPAM_PATTERN = new RegExp(
  `^Sankalpam for (.+?) on (${DATE_OF_MONTH}) At (${TIME_OF_DAY}) (\\S+) and valid through (${TIME_OF_DAY})( of following day)?:\\s*(.*)$`,
  "i"
);

const SANKALPAM_INTRO: Record<
  LanguageCode,
  (location: string, date: string, time: string, zone: string, validUntil: string, nextDay: boolean) => string
> = {
  ta: (location, date, time, zone, validUntil, nextDay) =>
    `${location} க்கான சங்கல்பம் — ${date}, ${time} ${zone} முதல்${nextDay ? " மறுநாள்" : ""} ${validUntil} வரை செல்லுபடியாகும்:`,
  kn: (location, date, time, zone, validUntil, nextDay) =>
    `${location} ಗಾಗಿ ಸಂಕಲ್ಪ — ${date}, ${time} ${zone} ನಿಂದ${nextDay ? " ಮರುದಿನ" : ""} ${validUntil} ವರೆಗೆ ಮಾನ್ಯ:`,
  hi: (location, date, time, zone, validUntil, nextDay) =>
    `${location} के लिए संकल्प — ${date}, ${time} ${zone} से${nextDay ? " अगले दिन" : ""} ${validUntil} तक मान्य:`,
  te: (location, date, time, zone, validUntil, nextDay) =>
    `${location} కొరకు సంకల్పం — ${date}, ${time} ${zone} నుండి${nextDay ? " మరుసటి రోజు" : ""} ${validUntil} వరకు చెల్లుబాటు:`,
};

export function localizeSankalpamText(text: string, language: LanguageCode | null): string {
  if (!language) return text;
  const match = text.match(SANKALPAM_PATTERN);
  if (!match) return text;
  const [, location, date, time, zone, validUntil, followingDayPhrase, declaration] = match;
  const intro = SANKALPAM_INTRO[language](location, date, time, zone, validUntil, Boolean(followingDayPhrase));
  return declaration ? `${intro} ${declaration}` : intro;
}
