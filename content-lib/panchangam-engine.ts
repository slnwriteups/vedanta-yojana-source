/**
 * Vedanta Yojana's own Panchangam: the day's tithi, nakshatram,
 * sunrise/sunset, kaalams, festivals, next Ekadasi and the Sankalpam
 * declaration, all computed on the reader's device from
 * content-lib/panchangam-astronomy.ts. No network service is consulted,
 * so the calendar works offline and depends on no third party.
 *
 * Conventions (the ones South Indian Sri Vaishnava panchangams use):
 *
 *  - The day runs sunrise to sunrise. A day's tithi and nakshatram are
 *    the ones prevailing at its sunrise; their end times are given too.
 *  - Lunar months are amanta (new moon to new moon), named from the
 *    sidereal sign the Sun occupies at the opening new moon (Sun in Mina
 *    → Chaitra). A month with no sankranti in it is adhika, and
 *    month-specific festivals are kept to the nija month.
 *  - Solar (Tamil) months begin on the day whose sunset follows the
 *    sankranti. The 60-year samvatsara cycle turns at Mesha sankranti.
 *  - Ekadasi follows the Vaishnava rule: an Ekadasi touched by Dasami at
 *    arunodaya (96 minutes before sunrise), or prevailing at two
 *    sunrises, is observed the following day; a kshaya Ekadasi (one that
 *    sees no sunrise) is observed on the Dvadasi day.
 *
 * Festival dates come from fixed, published rules (a tithi in a lunar
 * month, or a nakshatram in a Tamil month) rather than a per-year list,
 * so they extend to any year without new data.
 */

import {
  lunarElongation,
  normalizeDegrees,
  siderealMoonLongitude,
  siderealSunLongitude,
  sunEvent,
} from "./panchangam-astronomy.ts";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const NAKSHATRA_SPAN = 360 / 27;
const ARUNODAYA_MS = 96 * MS_PER_MINUTE;

export interface PanchangamPlace {
  latitude: number;
  longitude: number;
  /** IANA time zone the reader's clock is in ("Asia/Kolkata"). */
  timeZone: string;
}

// ---------------------------------------------------------------------------
// Vocabulary. English spellings match the keys lib/panchangam-labels.ts
// (and its mobile twin) localize, so every value here translates.
// ---------------------------------------------------------------------------

const TITHI_NAMES = [
  "Prathama",
  "Dvithiya",
  "Trithiya",
  "Chaturthi",
  "Panchami",
  "Shashthi",
  "Saptami",
  "Ashtami",
  "Navami",
  "Dasami",
  "Ekadasi",
  "Dvadasi",
  "Trayodasi",
  "Chaturdasi",
];

export const NAKSHATRA_NAMES = [
  "Aswini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigasira",
  "Ardra",
  "Punarvasu",
  "Pushyami",
  "Aslesha",
  "Makha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swathi",
  "Visakha",
  "Anuradha",
  "Jyeshta",
  "Moola",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Satabhisha",
  "Purva Badra",
  "Uttara Badra",
  "Revathi",
];

export const TAMIL_MONTH_NAMES = [
  "Chithirai",
  "Vaikasi",
  "Ani",
  "Adi",
  "Avani",
  "Purattasi",
  "Aippasi",
  "Karthigai",
  "Margazhi",
  "Thai",
  "Masi",
  "Panguni",
];

/** Tithi index (0–29, 0 = Shukla Prathama) → the name lib/panchangam-labels.ts keys. */
export function tithiName(index: number): string {
  if (index === 14) return "Pournami";
  if (index === 29) return "Amavasya";
  return TITHI_NAMES[index % 15];
}

export function pakshaName(index: number): string {
  return index < 15 ? "Shukla Paksha" : "Krishna Paksha";
}

// Sanskrit (IAST) forms for the Sankalpam declaration.
const SAMVATSARA_IAST = [
  "Prabhava", "Vibhava", "Śukla", "Pramoduta", "Prajotpatti", "Āṅgīrasa", "Śrīmukha", "Bhava", "Yuva", "Dhātu",
  "Īśvara", "Bahudhānya", "Pramāthī", "Vikrama", "Vṛṣa", "Citrabhānu", "Svabhānu", "Tāraṇa", "Pārthiva", "Vyaya",
  "Sarvajit", "Sarvadhārī", "Virodhī", "Vikṛti", "Khara", "Nandana", "Vijaya", "Jaya", "Manmatha", "Durmukhī",
  "Hevilambī", "Vilambī", "Vikārī", "Śārvarī", "Plava", "Śubhakṛt", "Śobhakṛt", "Krodhī", "Viśvāvasu", "Parābhava",
  "Plavaṅga", "Kīlaka", "Saumya", "Sādhāraṇa", "Virodhikṛt", "Paridhāvī", "Pramādī", "Ānanda", "Rākṣasa", "Nala",
  "Piṅgala", "Kālayukti", "Siddhārthī", "Raudrī", "Durmati", "Dundubhi", "Rudhirodgārī", "Raktākṣī", "Krodhana", "Akṣaya",
];
const RASI_IAST = ["meṣa", "vṛṣabha", "mithuna", "karkaṭa", "siṁha", "kanyā", "tulā", "vṛścika", "dhanus", "makara", "kumbha", "mīna"];
const RITU_IAST = ["vasanta", "grīṣma", "varṣa", "śarad", "hemanta", "śiśira"];
const VASARA_IAST = ["bhānu", "indu", "bhauma", "saumya", "guru", "bhṛgu", "sthira"];
const TITHI_LOCATIVE_IAST = [
  "prathamāyām", "dvitīyāyām", "tṛtīyāyām", "caturthyām", "pañcamyām", "ṣaṣṭhyām", "saptamyām", "aṣṭamyām",
  "navamyām", "daśamyām", "ekādaśyām", "dvādaśyām", "trayodaśyām", "caturdaśyām",
];
const NAKSHATRA_IAST = [
  "aśvinī", "apabharaṇī", "kṛttikā", "rohiṇī", "mṛgaśīrṣa", "ārdrā", "punarvasu", "puṣya", "āśleṣā", "maghā",
  "pūrvaphalgunī", "uttaraphalgunī", "hasta", "citrā", "svātī", "viśākhā", "anurādhā", "jyeṣṭhā", "mūla",
  "pūrvāṣāḍhā", "uttarāṣāḍhā", "śravaṇa", "śraviṣṭhā", "śatabhiṣak", "pūrvaproṣṭhapadā", "uttaraproṣṭhapadā", "revatī",
];

// ---------------------------------------------------------------------------
// Time zones. Day numbers are whole days since 1970-01-01 for a civil
// date ("2026-10-08" → 20734), independent of any zone.
// ---------------------------------------------------------------------------

const offsetFormatters = new Map<string, Intl.DateTimeFormat | null>();

function offsetFormatter(timeZone: string): Intl.DateTimeFormat | null {
  if (!offsetFormatters.has(timeZone)) {
    let formatter: Intl.DateTimeFormat | null = null;
    try {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      });
      formatter.formatToParts(0);
    } catch {
      formatter = null;
    }
    offsetFormatters.set(timeZone, formatter);
  }
  return offsetFormatters.get(timeZone) ?? null;
}

/**
 * Minutes east of UTC for `timeZone` at instant `ms`. An unknown zone, or
 * a runtime without Intl time-zone support, falls back to the device's
 * own offset -- the zone every caller passes is the device's own anyway.
 */
export function utcOffsetMinutes(ms: number, timeZone: string): number {
  const formatter = offsetFormatter(timeZone);
  if (!formatter) return -new Date(ms).getTimezoneOffset();
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(ms)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MS_PER_MINUTE);
}

export function dayNumberOf(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/** Epoch ms of local midnight that starts civil day `dayNumber` in `timeZone`. */
function dayStart(dayNumber: number, timeZone: string): number {
  const nominal = dayNumber * MS_PER_DAY;
  let guess = nominal - utcOffsetMinutes(nominal, timeZone) * MS_PER_MINUTE;
  guess = nominal - utcOffsetMinutes(guess, timeZone) * MS_PER_MINUTE;
  return guess;
}

interface LocalTime {
  dayNumber: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localTime(ms: number, timeZone: string): LocalTime {
  const shifted = new Date(ms + utcOffsetMinutes(ms, timeZone) * MS_PER_MINUTE);
  return {
    dayNumber: Math.floor(shifted.getTime() / MS_PER_DAY),
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "06:02" -- 24-hour local clock, seconds dropped as printed panchangams do. */
function clock24(ms: number, timeZone: string): string {
  const t = localTime(ms, timeZone);
  return `${pad2(t.hour)}:${pad2(t.minute)}`;
}

/** "10:00 AM" / "10:31:24 PM". */
function clock12(ms: number, timeZone: string, withSeconds: boolean): string {
  const t = localTime(ms, timeZone);
  const period = t.hour >= 12 ? "PM" : "AM";
  const hour12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
  return withSeconds
    ? `${pad2(hour12)}:${pad2(t.minute)}:${pad2(t.second)} ${period}`
    : `${hour12}:${pad2(t.minute)} ${period}`;
}

const MONTH_ABBREVIATIONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

function weekdayOf(dayNumber: number): number {
  return (((dayNumber + 4) % 7) + 7) % 7;
}

function civilDate(dayNumber: number): { year: number; month: number; day: number } {
  const date = new Date(dayNumber * MS_PER_DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** "8th Oct 2026". */
function longDate(dayNumber: number): string {
  const { year, month, day } = civilDate(dayNumber);
  return `${ordinal(day)} ${MONTH_ABBREVIATIONS[month - 1]} ${year}`;
}

/** The short zone label shown after a Sankalpam's time ("IST", "EDT", "GMT+1"). */
export function timeZoneLabel(ms: number, timeZone: string): string {
  if (timeZone === "Asia/Kolkata" || timeZone === "Asia/Calcutta") return "IST";
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(ms)
      .find((part) => part.type === "timeZoneName")?.value;
    if (name && !/\s/.test(name)) return name;
  } catch {
    // fall through to the numeric label
  }
  const offset = utcOffsetMinutes(ms, timeZone);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  return `GMT${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${pad2(abs % 60)}` : ""}`;
}

// ---------------------------------------------------------------------------
// Angular boundaries: when does the Moon (or Sun) reach the next / last
// multiple of a span?
// ---------------------------------------------------------------------------

type AngleFn = (ms: number) => number;

function signedDifference(target: number, value: number): number {
  return ((target - value + 540) % 360) - 180;
}

function solveFor(fn: AngleFn, target: number, guess: number, degreesPerDay: number): number {
  let t = guess;
  for (let pass = 0; pass < 12; pass += 1) {
    const diff = signedDifference(target, fn(t));
    t += (diff / degreesPerDay) * MS_PER_DAY;
    if (Math.abs(diff) < 1e-7) break;
  }
  return t;
}

interface Segment {
  index: number;
  start: number;
  end: number;
}

function segmentAt(fn: AngleFn, span: number, degreesPerDay: number, ms: number): Segment {
  const value = fn(ms);
  const index = Math.floor(value / span) % Math.round(360 / span);
  const startAngle = normalizeDegrees(index * span);
  const endAngle = normalizeDegrees((index + 1) * span);
  const start = solveFor(fn, startAngle, ms - ((value - index * span) / degreesPerDay) * MS_PER_DAY, degreesPerDay);
  const end = solveFor(fn, endAngle, ms + (((index + 1) * span - value) / degreesPerDay) * MS_PER_DAY, degreesPerDay);
  return { index, start, end };
}

const TITHI_RATE = 12.19;
const NAKSHATRA_RATE = 13.18;
const SUN_RATE = 0.9856;

/** Tithi index (0–29) in force at `ms`, without solving for its start and end. */
function tithiIndexAt(ms: number): number {
  return Math.floor(lunarElongation(ms) / 12) % 30;
}

export function tithiAt(ms: number): Segment {
  return segmentAt(lunarElongation, 12, TITHI_RATE, ms);
}

export function nakshatraAt(ms: number): Segment {
  return segmentAt(siderealMoonLongitude, NAKSHATRA_SPAN, NAKSHATRA_RATE, ms);
}

function rasiAt(ms: number): Segment {
  return segmentAt(siderealSunLongitude, 30, SUN_RATE, ms);
}

function rasiIndexAt(ms: number): number {
  return Math.floor(siderealSunLongitude(ms) / 30) % 12;
}

/** Amanta lunar month (0 = Chaitra) in force at `ms`, and whether it is adhika. */
export function lunarMonthAt(ms: number): { index: number; adhika: boolean } {
  // The current lunation opened at the end of the last Amavasya.
  const elongation = lunarElongation(ms);
  const newMoon = solveFor(lunarElongation, 0, ms - (elongation / TITHI_RATE) * MS_PER_DAY, TITHI_RATE);
  const nextNewMoon = solveFor(lunarElongation, 0, newMoon + 29.53 * MS_PER_DAY, TITHI_RATE);
  const rasi = rasiIndexAt(newMoon);
  return { index: (rasi + 1) % 12, adhika: rasiIndexAt(nextNewMoon) === rasi };
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

interface SunDay {
  dayNumber: number;
  start: number;
  sunrise: number;
  sunset: number;
  /** False when the Sun doesn't rise or set (polar latitudes) and 06:00/18:00 stand in. */
  hasSunEvents: boolean;
}

/** Per-place memo of each day's sunrise/sunset, shared by every rule a computation evaluates. */
class SunCalendar {
  private readonly days = new Map<number, SunDay>();
  private readonly sunriseTithis = new Map<number, number>();
  private readonly tamilMonths = new Map<number, number>();
  readonly place: PanchangamPlace;

  constructor(place: PanchangamPlace) {
    this.place = place;
  }

  day(dayNumber: number): SunDay {
    let cached = this.days.get(dayNumber);
    if (!cached) {
      const { latitude, longitude, timeZone } = this.place;
      const start = dayStart(dayNumber, timeZone);
      const rise = sunEvent(start, latitude, longitude, "rise");
      const set = sunEvent(start, latitude, longitude, "set");
      const hasSunEvents = rise !== null && set !== null && set > rise;
      cached = {
        dayNumber,
        start,
        sunrise: hasSunEvents ? (rise as number) : start + 6 * MS_PER_HOUR,
        sunset: hasSunEvents ? (set as number) : start + 18 * MS_PER_HOUR,
        hasSunEvents,
      };
      this.days.set(dayNumber, cached);
    }
    return cached;
  }

  dayOf(ms: number): number {
    return localTime(ms, this.place.timeZone).dayNumber;
  }

  /** The Hindu day (sunrise to sunrise) an instant belongs to. */
  hinduDayOf(ms: number): number {
    const civil = this.dayOf(ms);
    return ms < this.day(civil).sunrise ? civil - 1 : civil;
  }

  tithiAtSunrise(dayNumber: number): number {
    let index = this.sunriseTithis.get(dayNumber);
    if (index === undefined) {
      index = tithiIndexAt(this.day(dayNumber).sunrise);
      this.sunriseTithis.set(dayNumber, index);
    }
    return index;
  }

  /** Tamil (solar) month of a civil day: the Sun's sign at that day's sunset. */
  tamilMonth(dayNumber: number): number {
    let month = this.tamilMonths.get(dayNumber);
    if (month === undefined) {
      month = rasiIndexAt(this.day(dayNumber).sunset);
      this.tamilMonths.set(dayNumber, month);
    }
    return month;
  }
}

/** Aparahna is the fourth fifth of the daytime; its middle is used. */
type DayPoint = "sunrise" | "midday" | "aparahna" | "sunset";

function pointOf(day: SunDay, point: DayPoint): number {
  if (point === "sunrise") return day.sunrise;
  if (point === "sunset") return day.sunset;
  if (point === "aparahna") return day.sunrise + 0.7 * (day.sunset - day.sunrise);
  return (day.sunrise + day.sunset) / 2;
}

/**
 * The civil day a tithi/nakshatram occurrence is kept on: the first day
 * whose `point` falls inside it, or -- for one too short to contain any
 * such point -- the day whose point it follows.
 */
function dayAtPoint(cal: SunCalendar, segment: Segment, point: DayPoint): number {
  const first = cal.dayOf(segment.start) - 1;
  const last = cal.dayOf(segment.end) + 1;
  let previous = first;
  for (let d = first; d <= last; d += 1) {
    const at = pointOf(cal.day(d), point);
    if (at >= segment.start && at < segment.end) return d;
    if (at < segment.start) previous = d;
  }
  return previous;
}

/** The civil day on which an occurrence covers the most daylight. */
function dayOfMostDaylight(cal: SunCalendar, segment: Segment): number {
  let best = cal.dayOf(segment.end);
  let bestCoverage = 0;
  for (let d = cal.dayOf(segment.start); d <= cal.dayOf(segment.end); d += 1) {
    const day = cal.day(d);
    const coverage = Math.min(segment.end, day.sunset) - Math.max(segment.start, day.sunrise);
    if (coverage > bestCoverage) {
      bestCoverage = coverage;
      best = d;
    }
  }
  return best;
}

/** Every occurrence of a tithi/nakshatram that overlaps civil days `from`..`to`. */
function segmentsBetween(cal: SunCalendar, at: (ms: number) => Segment, from: number, to: number): Segment[] {
  const end = cal.day(to).start + MS_PER_DAY;
  const segments: Segment[] = [];
  let segment = at(cal.day(from).start);
  for (let guard = 0; guard < 16 && segment.start < end; guard += 1) {
    segments.push(segment);
    segment = at(segment.end + MS_PER_MINUTE);
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Ekadasi (Vaishnava)
// ---------------------------------------------------------------------------

const EKADASI = [10, 25];

/**
 * Whether the Ekadasi first seen at sunrise on day `f` is kept the next
 * day instead: when Dasami still runs at arunodaya (viddha), when the
 * Ekadasi also holds the next sunrise, or when the Dvadasi that follows
 * holds two sunrises (vyañjulī mahādvādaśī).
 */
function ekadasiMovesOn(cal: SunCalendar, f: number, e: number): boolean {
  const viddha = tithiIndexAt(cal.day(f).sunrise - ARUNODAYA_MS) === e - 1;
  const doubled = cal.tithiAtSunrise(f + 1) === e;
  const longDvadasi = cal.tithiAtSunrise(f + 1) === e + 1 && cal.tithiAtSunrise(f + 2) === e + 1;
  return viddha || doubled || longDvadasi;
}

/** Whether civil day `d` is a Vaishnava Ekadasi fast day, and for which paksha's Ekadasi. */
function ekadasiObservedOn(cal: SunCalendar, d: number): number | null {
  for (const e of EKADASI) {
    // Ekadasi first seen at sunrise on d.
    if (cal.tithiAtSunrise(d) === e && cal.tithiAtSunrise(d - 1) !== e && !ekadasiMovesOn(cal, d, e)) return e;
    // Ekadasi first seen at sunrise on d-1, but moved to d.
    if (cal.tithiAtSunrise(d - 1) === e && cal.tithiAtSunrise(d - 2) !== e && ekadasiMovesOn(cal, d - 1, e)) return e;
    // Kshaya Ekadasi: Dasami at yesterday's sunrise, Dvadasi at today's.
    if (cal.tithiAtSunrise(d) === e + 1 && cal.tithiAtSunrise(d - 1) === e - 1) return e;
  }
  return null;
}

function nextEkadasiDay(cal: SunCalendar, from: number): number | null {
  for (let d = from; d < from + 20; d += 1) {
    if (ekadasiObservedOn(cal, d) !== null) return d;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Festivals
// ---------------------------------------------------------------------------

interface TithiFestival {
  name: string;
  /** Amanta lunar month, 0 = Chaitra; null for every month. */
  month: number | null;
  tithi: number;
  at: DayPoint;
}

interface NakshatraFestival {
  name: string;
  /** Tamil month, 0 = Chithirai. */
  tamilMonth: number;
  nakshatra: number;
  krishnaPakshaOnly?: boolean;
}

const TITHI_FESTIVALS: TithiFestival[] = [
  { name: "Yugadi", month: 0, tithi: 0, at: "sunrise" },
  { name: "Sri Rama Navami", month: 0, tithi: 8, at: "sunrise" },
  { name: "Akshaya Tritiya", month: 1, tithi: 2, at: "sunrise" },
  { name: "Sri Narasimha Jayanthi", month: 1, tithi: 13, at: "sunset" },
  { name: "Yajur Upakarma", month: 4, tithi: 14, at: "midday" },
  { name: "Vinayaka Chaturthi", month: 5, tithi: 3, at: "midday" },
  { name: "Vamana Jayanthi", month: 5, tithi: 11, at: "sunrise" },
  { name: "Mahalaya Paksham begins", month: 5, tithi: 15, at: "sunrise" },
  { name: "Mahalaya Amavasya", month: 5, tithi: 29, at: "sunrise" },
  { name: "Navaratri begins", month: 6, tithi: 0, at: "sunrise" },
  { name: "Maha Navami", month: 6, tithi: 8, at: "sunrise" },
  { name: "Vijaya Dasami", month: 6, tithi: 9, at: "sunrise" },
  { name: "Deepavali", month: 6, tithi: 28, at: "sunrise" },
  { name: "Ratha Saptami", month: 10, tithi: 6, at: "sunrise" },
  { name: "Pradosham", month: null, tithi: 12, at: "sunset" },
  { name: "Pradosham", month: null, tithi: 27, at: "sunset" },
  { name: "Amavasya Tarpanam", month: null, tithi: 29, at: "aparahna" },
];

const NAKSHATRA_FESTIVALS: NakshatraFestival[] = [
  { name: "Sri Ramanuja Jayanthi", tamilMonth: 0, nakshatra: 5 },
  { name: "Madhurakavi Azhvar Tirunakshatram", tamilMonth: 0, nakshatra: 13 },
  { name: "Nammazhvar Tirunakshatram", tamilMonth: 1, nakshatra: 15 },
  { name: "Periyazhvar Tirunakshatram", tamilMonth: 2, nakshatra: 14 },
  { name: "Nathamunigal Tirunakshatram", tamilMonth: 2, nakshatra: 16 },
  { name: "Andal Tiruvadipuram", tamilMonth: 3, nakshatra: 10 },
  { name: "Alavandar Tirunakshatram", tamilMonth: 3, nakshatra: 20 },
  { name: "Sri Hayagriva Jayanthi", tamilMonth: 4, nakshatra: 21 },
  { name: "Rig Upakarma", tamilMonth: 4, nakshatra: 21 },
  { name: "Sri Jayanthi", tamilMonth: 4, nakshatra: 3, krishnaPakshaOnly: true },
  { name: "Swami Desikan Tirunakshatram", tamilMonth: 5, nakshatra: 21 },
  { name: "Poigai Azhvar Tirunakshatram", tamilMonth: 6, nakshatra: 21 },
  { name: "Bhoothathazhvar Tirunakshatram", tamilMonth: 6, nakshatra: 22 },
  { name: "Peyazhvar Tirunakshatram", tamilMonth: 6, nakshatra: 23 },
  { name: "Manavala Mamunigal Tirunakshatram", tamilMonth: 6, nakshatra: 18 },
  { name: "Thirumangai Azhvar Tirunakshatram", tamilMonth: 7, nakshatra: 2 },
  { name: "Karthigai Deepam", tamilMonth: 7, nakshatra: 2 },
  { name: "Thiruppanazhvar Tirunakshatram", tamilMonth: 7, nakshatra: 3 },
  { name: "Thondaradippodi Azhvar Tirunakshatram", tamilMonth: 8, nakshatra: 17 },
  { name: "Thirumazhisai Azhvar Tirunakshatram", tamilMonth: 9, nakshatra: 9 },
  { name: "Kulasekhara Azhvar Tirunakshatram", tamilMonth: 10, nakshatra: 6 },
  { name: "Masi Magam", tamilMonth: 10, nakshatra: 9 },
  { name: "Panguni Uttiram", tamilMonth: 11, nakshatra: 11 },
];

/**
 * Every festival name this module can produce -- a closed vocabulary,
 * unlike a feed's free text. The one formatted entry is the day after an
 * Ekadasi's "Dvadasi Paranai 06:01-08:27" (or "… after 08:47"), the
 * window for breaking the fast.
 */
export const FESTIVAL_NAMES: readonly string[] = Array.from(
  new Set([
    ...TITHI_FESTIVALS.map((f) => f.name),
    ...NAKSHATRA_FESTIVALS.map((f) => f.name),
    "Gayatri Japam",
    "Ekadasi",
    "Vaikunta Ekadasi",
    "Kaisika Ekadasi",
    "Tamil New Year",
    "Bhogi",
    "Makara Sankranti",
    ...TAMIL_MONTH_NAMES.map((m) => `${m} Masa Pravesam`),
  ])
);

/** Shukla Ekadasis with names of their own, by Tamil month. */
const SHUKLA_EKADASI_NAMES: Record<number, string> = { 7: "Kaisika Ekadasi", 8: "Vaikunta Ekadasi" };

/**
 * When a nakshatram falls twice in one Tamil month, its festival is kept
 * on the second occurrence.
 */
function recursInSameTamilMonth(cal: SunCalendar, segment: Segment, tamilMonth: number): boolean {
  let next = nakshatraAt(segment.start + 27.3217 * MS_PER_DAY + 6 * MS_PER_HOUR);
  if (next.index !== segment.index) next = nakshatraAt(next.index === (segment.index + 1) % 27 ? next.start - MS_PER_HOUR : next.end + MS_PER_HOUR);
  return next.index === segment.index && cal.tamilMonth(dayOfMostDaylight(cal, next)) === tamilMonth;
}

/**
 * The Dvadasi Paranai window on day `d`, after the Ekadasi (paksha
 * index `e`) fasted the day before: from sunrise -- or from the end of
 * the Ekadasi if it is still running -- through the first fifth of the
 * daytime, cut short if Dvadasi itself ends sooner.
 */
function paranaText(cal: SunCalendar, d: number, e: number): string {
  const { timeZone } = cal.place;
  const day = cal.day(d);
  const atSunrise = tithiAt(day.sunrise);
  const start = atSunrise.index === e ? atSunrise.end : day.sunrise;
  let end = day.sunrise + (day.sunset - day.sunrise) / 5;
  const dvadasi = tithiAt(start + MS_PER_MINUTE);
  if (dvadasi.index === e + 1) end = Math.min(end, dvadasi.end);
  return end - start < MS_PER_MINUTE
    ? `Dvadasi Paranai after ${clock24(start, timeZone)}`
    : `Dvadasi Paranai ${clock24(start, timeZone)}-${clock24(end, timeZone)}`;
}

function tithiFestivalsOn(cal: SunCalendar, d: number): string[] {
  const names: string[] = [];
  for (const segment of segmentsBetween(cal, tithiAt, d - 2, d + 2)) {
    const rules = TITHI_FESTIVALS.filter((rule) => rule.tithi === segment.index);
    if (rules.length === 0) continue;
    let month: { index: number; adhika: boolean } | null = null;
    for (const rule of rules) {
      if (dayAtPoint(cal, segment, rule.at) !== d) continue;
      if (rule.month !== null) {
        month ??= lunarMonthAt(segment.start + MS_PER_MINUTE);
        if (month.adhika || month.index !== rule.month) continue;
      }
      names.push(rule.name);
    }
  }
  return names;
}

function festivalsOn(cal: SunCalendar, d: number): string[] {
  const names: string[] = [];

  // Solar month starts.
  const tamilMonth = cal.tamilMonth(d);
  if (tamilMonth !== cal.tamilMonth(d - 1)) {
    names.push(`${TAMIL_MONTH_NAMES[tamilMonth]} Masa Pravesam`);
    if (tamilMonth === 0) names.push("Tamil New Year");
    if (tamilMonth === 9) names.push("Makara Sankranti");
  }
  if (cal.tamilMonth(d + 1) === 9 && tamilMonth === 8) names.push("Bhogi");

  // Ekadasi.
  const ekadasi = ekadasiObservedOn(cal, d);
  if (ekadasi !== null) {
    const special = ekadasi === 10 ? SHUKLA_EKADASI_NAMES[tamilMonth] : undefined;
    names.push(special ?? "Ekadasi");
  }
  const ekadasiYesterday = ekadasiObservedOn(cal, d - 1);
  if (ekadasiYesterday !== null) names.push(paranaText(cal, d, ekadasiYesterday));

  // Tithi festivals; Gayatri Japam follows the day after Yajur Upakarma.
  names.push(...tithiFestivalsOn(cal, d));
  if (tithiFestivalsOn(cal, d - 1).includes("Yajur Upakarma")) names.push("Gayatri Japam");

  // Nakshatram festivals.
  for (const segment of segmentsBetween(cal, nakshatraAt, d - 2, d + 2)) {
    const rules = NAKSHATRA_FESTIVALS.filter((rule) => rule.nakshatra === segment.index && rule.tamilMonth === tamilMonth);
    if (rules.length === 0 || dayOfMostDaylight(cal, segment) !== d) continue;
    if (recursInSameTamilMonth(cal, segment, tamilMonth)) continue;
    for (const rule of rules) {
      if (rule.krishnaPakshaOnly && cal.tithiAtSunrise(d) < 15) continue;
      names.push(rule.name);
    }
  }

  // Mahalaya Amavasya is itself the month's Amavasya tarpanam.
  const unique = Array.from(new Set(names));
  return unique.includes("Mahalaya Amavasya") ? unique.filter((name) => name !== "Amavasya Tarpanam") : unique;
}

// ---------------------------------------------------------------------------
// Sankalpam
// ---------------------------------------------------------------------------

function samvatsaraIndexAt(ms: number, timeZone: string): number {
  const { year, month } = localTime(ms, timeZone);
  // Before Mesha sankranti (Sun still in Dhanus…Mina early in the year) the previous year's samvatsara runs.
  const solarYear = month <= 4 && siderealSunLongitude(ms) >= 240 ? year - 1 : year;
  return (((solarYear - 1987) % 60) + 60) % 60;
}

function sankalpamDeclaration(cal: SunCalendar, ms: number): string {
  const rasi = rasiIndexAt(ms);
  const tithi = tithiAt(ms).index;
  const nakshatra = nakshatraAt(ms).index;
  const vasara = weekdayOf(cal.hinduDayOf(ms));
  const tithiWord = tithi === 14 ? "paurṇamāsyām" : tithi === 29 ? "amāvāsyāyām" : TITHI_LOCATIVE_IAST[tithi % 15];
  const ayana = rasi >= 3 && rasi <= 8 ? "dakṣiṇāyane" : "uttarāyaṇe";
  return [
    `${SAMVATSARA_IAST[samvatsaraIndexAt(ms, cal.place.timeZone)]} nāma saṁvatsare`,
    ayana,
    `${RITU_IAST[Math.floor(rasi / 2)]} ṛtau`,
    `${RASI_IAST[rasi]} māse`,
    `${tithi < 15 ? "śukla" : "kṛṣṇa"} pakṣe`,
    `${tithiWord} śubha tithau`,
    `${VASARA_IAST[vasara]} vāsara yuktāyām`,
    `${NAKSHATRA_IAST[nakshatra]} nakṣatra yuktāyām`,
    "evaṅguṇa viśeṣaṇa viśiṣṭāyām asyām vartamānāyām śubha tithau.",
  ].join(", ");
}

/**
 * "Sankalpam for Chennai on 8th Oct 2026 At 10:00 AM IST and valid
 * through 10:31:24 PM: Parābhava nāma saṁvatsare, …" -- the declaration
 * for the moment `ms`, and how long it stays true: until the tithi,
 * nakshatram, solar month or (at sunrise) weekday it names next changes.
 */
function sankalpamText(cal: SunCalendar, ms: number, placeName: string): string {
  const { timeZone } = cal.place;
  const nextSunrise = cal.day(cal.hinduDayOf(ms) + 1).sunrise;
  const validUntil = Math.min(tithiAt(ms).end, nakshatraAt(ms).end, rasiAt(ms).end, nextSunrise);
  const today = localTime(ms, timeZone).dayNumber;
  const followingDay = localTime(validUntil, timeZone).dayNumber !== today ? " of following day" : "";
  return (
    `Sankalpam for ${placeName} on ${longDate(today)} At ${clock12(ms, timeZone, false)} ${timeZoneLabel(ms, timeZone)} ` +
    `and valid through ${clock12(validUntil, timeZone, true)}${followingDay}: ${sankalpamDeclaration(cal, ms)}`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ComputedPanchangam {
  /** Tithi at sunrise, spelled as lib/panchangam-labels.ts keys it. */
  tithi: string;
  paksha: string;
  /** Nakshatram at sunrise. */
  nakshatram: string;
  /** The day's observances, comma-separated, or "". */
  festival: string;
  /** "Next Ekadasi: Thursday, 22nd Oct 2026." */
  upcomingEkadashiText: string;
  sankalpamText: string;
  /** 24-hour local "HH:MM", or "" where the Sun doesn't rise/set. */
  sunrise: string;
  sunset: string;
  /** "HH:MM-HH:MM". */
  rahuKaalam: string;
  yamagandam: string;
  gulikaKaalam: string;
  /** End time of the sunrise tithi / nakshatram ("22:41", or "22:41 (+1)" past midnight). */
  tithiEnds: string;
  nakshatramEnds: string;
  /** Tamil month and day ("Purattasi 22"). */
  tamilDate: string;
}

// The part of the day each kaalam takes (daylight in eighths), by weekday from Sunday.
const RAHU_PART = [7, 1, 6, 4, 5, 3, 2];
const YAMAGANDAM_PART = [4, 3, 2, 1, 0, 6, 5];
const GULIKA_PART = [6, 5, 4, 3, 2, 1, 0];

function kaalam(day: SunDay, part: number, timeZone: string): string {
  if (!day.hasSunEvents) return "";
  const eighth = (day.sunset - day.sunrise) / 8;
  const start = day.sunrise + part * eighth;
  return `${clock24(start, timeZone)}-${clock24(start + eighth, timeZone)}`;
}

function endsLabel(cal: SunCalendar, d: number, ms: number): string {
  const { timeZone } = cal.place;
  const daysLater = localTime(ms, timeZone).dayNumber - d;
  return `${clock24(ms, timeZone)}${daysLater > 0 ? ` (+${daysLater})` : ""}`;
}

function tamilDayOfMonth(cal: SunCalendar, d: number): number {
  const month = cal.tamilMonth(d);
  let first = d;
  while (cal.tamilMonth(first - 1) === month && d - first < 40) first -= 1;
  return d - first + 1;
}

export interface ComputeOptions {
  /** The moment the Sankalpam is declared for; defaults to the day's sunrise. */
  sankalpamAt?: number;
  /** The place name the Sankalpam names. */
  placeName: string;
}

/**
 * Computes the Panchangam for civil day `dayNumber` (see dayNumberOf)
 * at `place`.
 */
export function computePanchangam(dayNumber: number, place: PanchangamPlace, options: ComputeOptions): ComputedPanchangam {
  const cal = new SunCalendar(place);
  const day = cal.day(dayNumber);
  const { timeZone } = place;
  const weekday = weekdayOf(dayNumber);
  const tithi = tithiAt(day.sunrise);
  const nakshatra = nakshatraAt(day.sunrise);

  const ekadasiDay = nextEkadasiDay(cal, dayNumber);
  const upcomingEkadashiText =
    ekadasiDay === null ? "" : `Next Ekadasi: ${WEEKDAY_NAMES[weekdayOf(ekadasiDay)]}, ${longDate(ekadasiDay)}.`;

  return {
    tithi: tithiName(tithi.index),
    paksha: pakshaName(tithi.index),
    nakshatram: NAKSHATRA_NAMES[nakshatra.index],
    festival: festivalsOn(cal, dayNumber).join(", "),
    upcomingEkadashiText,
    sankalpamText: sankalpamText(cal, options.sankalpamAt ?? day.sunrise, options.placeName),
    sunrise: day.hasSunEvents ? clock24(day.sunrise, timeZone) : "",
    sunset: day.hasSunEvents ? clock24(day.sunset, timeZone) : "",
    rahuKaalam: kaalam(day, RAHU_PART[weekday], timeZone),
    yamagandam: kaalam(day, YAMAGANDAM_PART[weekday], timeZone),
    gulikaKaalam: kaalam(day, GULIKA_PART[weekday], timeZone),
    tithiEnds: endsLabel(cal, dayNumber, tithi.end),
    nakshatramEnds: endsLabel(cal, dayNumber, nakshatra.end),
    tamilDate: `${TAMIL_MONTH_NAMES[cal.tamilMonth(dayNumber)]} ${tamilDayOfMonth(cal, dayNumber)}`,
  };
}

/**
 * The Panchangam for the reader's civil day containing `date`. On today
 * the Sankalpam is declared for the present moment (`now`); on any other
 * day, for that day's sunrise.
 */
export function computePanchangamForDate(
  date: Date,
  place: PanchangamPlace,
  placeName: string,
  now: Date = new Date()
): ComputedPanchangam {
  const dayNumber = localTime(date.getTime(), place.timeZone).dayNumber;
  const isToday = dayNumber === localTime(now.getTime(), place.timeZone).dayNumber;
  return computePanchangam(dayNumber, place, { placeName, sankalpamAt: isToday ? now.getTime() : undefined });
}
