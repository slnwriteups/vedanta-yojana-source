import type { LanguageCode } from "./schemas/language.ts";

/**
 * The Panchangam engine writes dates in English ("22nd Oct 2026",
 * "Thursday, 22nd Oct 2026"). These are rewritten in the reader's
 * language with the full month and weekday names, spelled out here rather
 * than taken from the device's Intl data, which formats differently on
 * different phones and leaves some months abbreviated.
 */

const MONTHS: Record<LanguageCode, readonly string[]> = {
  ta: ["ஜனவரி", "பிப்ரவரி", "மார்ச்", "ஏப்ரல்", "மே", "ஜூன்", "ஜூலை", "ஆகஸ்ட்", "செப்டம்பர்", "அக்டோபர்", "நவம்பர்", "டிசம்பர்"],
  kn: ["ಜನವರಿ", "ಫೆಬ್ರವರಿ", "ಮಾರ್ಚ್", "ಏಪ್ರಿಲ್", "ಮೇ", "ಜೂನ್", "ಜುಲೈ", "ಆಗಸ್ಟ್", "ಸೆಪ್ಟೆಂಬರ್", "ಅಕ್ಟೋಬರ್", "ನವೆಂಬರ್", "ಡಿಸೆಂಬರ್"],
  hi: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
  te: ["జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్", "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్"],
};

const WEEKDAYS: Record<LanguageCode, readonly string[]> = {
  ta: ["ஞாயிறு", "திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி"],
  kn: ["ಭಾನುವಾರ", "ಸೋಮವಾರ", "ಮಂಗಳವಾರ", "ಬುಧವಾರ", "ಗುರುವಾರ", "ಶುಕ್ರವಾರ", "ಶನಿವಾರ"],
  hi: ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"],
  te: ["ఆదివారం", "సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం"],
};

const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const EN_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** "22nd Oct 2026" or "Thursday, 22nd Oct 2026", anywhere in a sentence. */
const ENGLISH_DATE = /\b(?:(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+)?(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})\b/g;

/** Every engine-written English date in `text`, in `language` ("22 ಅಕ್ಟೋಬರ್ 2026"; with its weekday first when it had one). */
export function localizeEnglishDates(text: string, language: LanguageCode | null): string {
  if (!language) return text;
  return text.replace(ENGLISH_DATE, (whole, weekday: string | undefined, day: string, month: string, year: string) => {
    const m = EN_MONTHS.indexOf(month.toLowerCase());
    if (m === -1) return whole;
    const date = `${Number(day)} ${MONTHS[language][m]} ${year}`;
    if (!weekday) return date;
    return `${WEEKDAYS[language][EN_WEEKDAYS.indexOf(weekday.toLowerCase())]}, ${date}`;
  });
}
