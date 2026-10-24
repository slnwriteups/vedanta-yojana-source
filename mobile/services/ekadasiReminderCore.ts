import { localizeEnglishDates } from "../../content-lib/panchangam-dates.ts";
import { dayNumberAt, upcomingEkadasis, type PanchangamPlace } from "../../content-lib/panchangam-engine.ts";
import type { LanguageCode } from "../content-lib/preferences.ts";

/**
 * Which Dasami-eve reminders to schedule: one on the day before each
 * coming Ekadasi fast, at EKADASI_REMINDER_HOUR on the place's clock,
 * saying that tomorrow is Ekadasi. The fast days come from the
 * Panchangam engine's own Vaishnava rules (upcomingEkadasis), so the
 * reminder always names the day the calendar shows -- the eve is the
 * day before the fast, which is Dasami except when the fast moves on a
 * day (viddha, a doubled Ekadasi), where it still comes the evening
 * before the fast.
 *
 * Pure: no React Native, so it runs under the plain Node tests.
 * services/ekadasiReminderService.ts hands the result to
 * expo-notifications.
 */

/** Local hour on the eve the reminder is shown: early, so the day's meals can be planned around the fast. */
export const EKADASI_REMINDER_HOUR = 7;

/** How far ahead reminders are scheduled; rescheduled on every launch, so this only has to outlast a long gap between uses. */
export const EKADASI_REMINDER_HORIZON_DAYS = 120;

/** Every scheduled reminder's identifier starts with this, so they can be replaced without touching anything else. */
export const EKADASI_REMINDER_ID_PREFIX = "ekadasi-eve-";

export interface EkadasiReminder {
  /** EKADASI_REMINDER_ID_PREFIX + the fast's civil day number. */
  id: string;
  /** Epoch ms the notification is shown. */
  fireAt: number;
  title: string;
  body: string;
}

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Each wording below is a Record over every language the app offers (plus
 * English), so adding a language to LanguageCode fails the typecheck until
 * the reminder is written in it too; tests/ekadasi-reminders.test.ts checks
 * each one is in its own script.
 */
type Wording<T> = { en: T } & Record<LanguageCode, T>;

function inLanguage<T>(wording: Wording<T>, language: LanguageCode | null): T {
  return language ? wording[language] : wording.en;
}

/** The engine's Ekadasi names, in each script (transliterated, as panchangam-labels.ts does). */
const EKADASI_NAMES: Record<string, Wording<string>> = {
  "Ekadasi Vratam": { en: "Ekadasi", ta: "ஏகாதசி", kn: "ಏಕಾದಶಿ", hi: "एकादशी", te: "ఏకాదశి" },
  "Kaisika Ekadasi": { en: "Kaisika Ekadasi", ta: "கைசிக ஏகாதசி", kn: "ಕೈಶಿಕ ಏಕಾದಶಿ", hi: "कैशिक एकादशी", te: "కైశిక ఏకాదశి" },
  "Vaikunta Ekadasi": { en: "Vaikunta Ekadasi", ta: "வைகுண்ட ஏகாதசி", kn: "ವೈಕುಂಠ ಏಕಾದಶಿ", hi: "वैकुण्ठ एकादशी", te: "వైకుంఠ ఏకాదశి" },
  "Bhishma Ekadasi": { en: "Bhishma Ekadasi", ta: "பீஷ்ம ஏகாதசி", kn: "ಭೀಷ್ಮ ಏಕಾದಶಿ", hi: "भीष्म एकादशी", te: "భీష్మ ఏకాదశి" },
};

/** The engine names a reminder can carry (every name upcomingEkadasis returns). */
export const EKADASI_REMINDER_NAMES: readonly string[] = Object.keys(EKADASI_NAMES);

const TITLES: Wording<(name: string) => string> = {
  en: (name) => `Tomorrow is ${name}`,
  ta: (name) => `நாளை ${name}`,
  kn: (name) => `ನಾಳೆ ${name}`,
  hi: (name) => `कल ${name} है`,
  te: (name) => `రేపు ${name}`,
};

const BODIES: Wording<(date: string) => string> = {
  en: (date) => `Fast on ${date}.`,
  ta: (date) => `விரதம்: ${date}`,
  kn: (date) => `ವ್ರತ: ${date}`,
  hi: (date) => `व्रत: ${date}`,
  te: (date) => `వ్రతం: ${date}`,
};

/** The name of the Android notification channel the reminders arrive on, as the phone's settings list it. */
const CHANNEL_NAMES: Wording<string> = {
  en: "Ekadasi reminders",
  ta: "ஏகாதசி நினைவூட்டல்கள்",
  kn: "ಏಕಾದಶಿ ಜ್ಞಾಪನೆಗಳು",
  hi: "एकादशी अनुस्मारक",
  te: "ఏకాదశి గుర్తింపులు",
};

export function ekadasiReminderTitle(name: string, language: LanguageCode | null): string {
  return inLanguage(TITLES, language)(inLanguage(EKADASI_NAMES[name] ?? EKADASI_NAMES["Ekadasi Vratam"], language));
}

/** `dateText` is the engine's English date ("Thursday, 5th Nov 2026"), rewritten in `language`. */
export function ekadasiReminderBody(dateText: string, language: LanguageCode | null): string {
  return inLanguage(BODIES, language)(localizeEnglishDates(dateText, language));
}

export function ekadasiReminderChannelName(language: LanguageCode | null): string {
  return inLanguage(CHANNEL_NAMES, language);
}

/** The reminders still to come after `now` for the Ekadasis at `place`, in `language`. */
export function planEkadasiReminders(place: PanchangamPlace, now: number, language: LanguageCode | null): EkadasiReminder[] {
  const today = dayNumberAt(now, place.timeZone);
  // From tomorrow: today's own fast has no eve left to remind on.
  return upcomingEkadasis(place, today + 1, EKADASI_REMINDER_HORIZON_DAYS)
    .map((ekadasi) => ({
      id: `${EKADASI_REMINDER_ID_PREFIX}${ekadasi.dayNumber}`,
      fireAt: ekadasi.eveStartsAt + EKADASI_REMINDER_HOUR * MS_PER_HOUR,
      title: ekadasiReminderTitle(ekadasi.name, language),
      body: ekadasiReminderBody(ekadasi.dateText, language),
    }))
    .filter((reminder) => reminder.fireAt > now);
}
