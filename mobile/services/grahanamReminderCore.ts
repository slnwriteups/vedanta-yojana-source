import { dayNumberAt, dayStart, type PanchangamPlace } from "../../content-lib/panchangam-engine.ts";
import { grahanamsBetween } from "../../content-lib/panchangam-eclipses.ts";
import type { LanguageCode } from "../content-lib/preferences.ts";
import { formatPanchangamTime } from "./panchangamTimings.ts";

/**
 * Which grahaṇam reminders to schedule: one at GRAHANAM_REMINDER_HOUR on
 * the place's clock the day before each eclipse that can be seen there
 * (content-lib/panchangam-eclipses.ts, the same eclipses the calendar
 * shows), naming the eclipse and the time it can be seen, with the
 * owner's guidance: chant Sri Vishnu Sahasranamam, and place darbha grass
 * in the fridge and on perishable food before it begins.
 *
 * Penumbral lunar eclipses are shown on the calendar but not reminded:
 * the Moon barely dims.
 *
 * Pure: no React Native, so it runs under the plain Node tests.
 * services/ekadasiReminderService.ts schedules the result.
 */

/** Owner decision, 23 Nov 2026: 10 AM the day before. */
export const GRAHANAM_REMINDER_HOUR = 10;

/** Rescheduled on every launch; eclipses are a few a year, so look a year ahead. */
export const GRAHANAM_REMINDER_HORIZON_DAYS = 370;

export const GRAHANAM_REMINDER_ID_PREFIX = "grahanam-eve-";

export interface GrahanamReminder {
  id: string;
  fireAt: number;
  title: string;
  body: string;
}

const MS_PER_HOUR = 60 * 60 * 1000;

type Wording<T> = { en: T } & Record<LanguageCode, T>;

function inLanguage<T>(wording: Wording<T>, language: LanguageCode | null): T {
  return language ? wording[language] : wording.en;
}

const TITLES: Wording<string> = {
  en: "Grahaṇam tomorrow",
  ta: "நாளை கிரகணம்",
  kn: "ನಾಳೆ ಗ್ರಹಣ",
  hi: "कल ग्रहण है",
  te: "రేపు గ్రహణం",
};

const NAMES: Wording<{ lunar: string; solar: string }> = {
  en: { lunar: "Lunar eclipse", solar: "Solar eclipse" },
  ta: { lunar: "சந்திர கிரகணம்", solar: "சூரிய கிரகணம்" },
  kn: { lunar: "ಚಂದ್ರ ಗ್ರಹಣ", solar: "ಸೂರ್ಯ ಗ್ರಹಣ" },
  hi: { lunar: "चन्द्र ग्रहण", solar: "सूर्य ग्रहण" },
  te: { lunar: "చంద్ర గ్రహణం", solar: "సూర్య గ్రహణం" },
};

const BODIES: Wording<(name: string, window: string) => string> = {
  en: (name, window) =>
    `${name}, visible here ${window}. Chant Sri Vishnu Sahasranamam during it, and place darbha grass in the fridge and on perishable food before it begins.`,
  ta: (name, window) =>
    `${name}, இங்கு தெரியும் நேரம் ${window}. கிரகண காலத்தில் ஸ்ரீ விஷ்ணு ஸஹஸ்ரநாமம் பாராயணம் செய்யுங்கள்; தொடங்கும் முன் குளிர்சாதனப் பெட்டியினுள்ளும் கெட்டுப்போகும் உணவின் மீதும் தர்ப்பம் வையுங்கள்.`,
  kn: (name, window) =>
    `${name}, ಇಲ್ಲಿ ಕಾಣುವ ಸಮಯ ${window}. ಗ್ರಹಣದ ಸಮಯದಲ್ಲಿ ಶ್ರೀ ವಿಷ್ಣು ಸಹಸ್ರನಾಮವನ್ನು ಪಠಿಸಿ; ಆರಂಭವಾಗುವ ಮೊದಲು ಫ್ರಿಜ್‌ನೊಳಗೆ ಮತ್ತು ಹಾಳಾಗುವ ಆಹಾರದ ಮೇಲೆ ದರ್ಭೆಯನ್ನು ಇಡಿ.`,
  hi: (name, window) =>
    `${name}, यहाँ दिखाई देगा ${window}। ग्रहण के समय श्री विष्णु सहस्रनाम का पाठ करें; आरम्भ होने से पहले फ्रिज में और जल्दी खराब होने वाले भोजन पर दर्भ रखें।`,
  te: (name, window) =>
    `${name}, ఇక్కడ కనిపించే సమయం ${window}. గ్రహణ సమయంలో శ్రీ విష్ణు సహస్రనామం పారాయణం చేయండి; ప్రారంభమయ్యే ముందు ఫ్రిజ్‌లో మరియు త్వరగా పాడయ్యే ఆహారం పైన దర్భను ఉంచండి.`,
};

const CHANNEL_NAMES: Wording<string> = {
  en: "Grahanam reminders",
  ta: "கிரகண நினைவூட்டல்கள்",
  kn: "ಗ್ರಹಣ ಜ್ಞಾಪನೆಗಳು",
  hi: "ग्रहण अनुस्मारक",
  te: "గ్రహణ రిమైండర్లు",
};

export function grahanamReminderChannelName(language: LanguageCode | null): string {
  return inLanguage(CHANNEL_NAMES, language);
}

/** The reminders still to come after `now` for the eclipses seen at `place`, in `language`. */
export function planGrahanamReminders(place: PanchangamPlace, now: number, language: LanguageCode | null): GrahanamReminder[] {
  const today = dayNumberAt(now, place.timeZone);
  return grahanamsBetween(place, today + 1, today + GRAHANAM_REMINDER_HORIZON_DAYS)
    .filter((g) => g.kind !== "penumbral")
    .map((g) => ({
      id: `${GRAHANAM_REMINDER_ID_PREFIX}${g.dayNumber}`,
      fireAt: dayStart(g.dayNumber - 1, place.timeZone) + GRAHANAM_REMINDER_HOUR * MS_PER_HOUR,
      title: inLanguage(TITLES, language),
      body: inLanguage(BODIES, language)(
        inLanguage(NAMES, language)[g.body],
        formatPanchangamTime(`${g.labels.visibleFrom}-${g.labels.visibleTo}`, language || "en-US")
      ),
    }))
    .filter((reminder) => reminder.fireAt > now);
}
