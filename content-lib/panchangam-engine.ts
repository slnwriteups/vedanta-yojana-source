/**
 * Vedanta Yojana's own Panchangam: the day's tithi, nakshatram,
 * sunrise/sunset, kaalams, observances, next Ekadasi and the Sankalpam
 * declaration, computed on the reader's device. No network service is
 * consulted, so the calendar works offline and depends on no third party.
 *
 * It follows the traditional Sri Vaishnava reckoning of Sri Ahobila
 * Mutt's published calendar, and was checked day by day against the
 * Mutt's Parābhava (2026–27) calendar for Chennai, New York, London,
 * Sydney and Singapore:
 *
 *  - Tithi, nakshatram and the solar months come from the traditional
 *    (siddhantic) Sun and Moon of panchangam-siddhanta.ts; sunrise and
 *    sunset from the observed Sun at the reader's own place, its centre
 *    on the true horizon (panchangam-astronomy.ts). Every rule below is
 *    applied to the reader's local sunrise and clock, so the calendar is
 *    correct anywhere in the world, not only in India.
 *  - The day runs sunrise to sunrise; its tithi and nakshatram are the
 *    ones in force at its sunrise. Kaalams are eighths of the daylight in
 *    whole minutes.
 *  - Lunar months are amanta, named from the Sun's sign at the opening new
 *    moon; a month without a sankranti is adhika. Tamil months begin on
 *    the day whose sunset follows the sankranti. The samvatsara turns at
 *    Mesha sankranti.
 *  - Ekadasi follows the Vaishnava rules (arunodaya viddha, two-sunrise
 *    Ekadasi, vyañjulī mahādvādaśī, kshaya Ekadasi); Dvadasi Paranai
 *    waits out Hari Vasara.
 *  - Each observance is kept by its own traditional day rule -- sunrise,
 *    sunset, aparahna (sraddha days), or the nazhigai rule for
 *    tirunakshatrams and full-moon days -- documented with the festival
 *    tables below. The rules, not a per-year list, decide the dates, so
 *    they carry to any year and any place.
 */

import { normalizeDegrees, sunEvent } from "./panchangam-astronomy.ts";
import {
  traditionalElongation as lunarElongation,
  traditionalMoonLongitude as siderealMoonLongitude,
  traditionalSunLongitude as siderealSunLongitude,
} from "./panchangam-siddhanta.ts";

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

  private readonly starMonths = new Map<number, number>();

  /**
   * The Tamil month tirunakshatrams are reckoned in: it turns on the
   * sankranti's punyakalam day (see punyakalamDay) rather than by the
   * sunset rule.
   */
  tamilMonthOfStars(dayNumber: number): number {
    let month = this.starMonths.get(dayNumber);
    if (month === undefined) {
      month = this.tamilMonth(dayNumber);
      for (let back = 0; back < 33; back += 1) {
        const rasi = punyakalamRasiOn(this, dayNumber - back);
        if (rasi !== null) {
          month = rasi;
          break;
        }
      }
      this.starMonths.set(dayNumber, month);
    }
    return month;
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
type DayPoint = "arunodaya" | "sunrise" | "midday" | "aparahna" | "sunset";

function pointOf(day: SunDay, point: DayPoint): number {
  if (point === "sunrise") return day.sunrise;
  if (point === "arunodaya") return day.sunrise - ARUNODAYA_MS;
  if (point === "sunset") return day.sunset;
  if (point === "aparahna") return day.sunrise + 0.7 * (day.sunset - day.sunrise);
  return (day.sunrise + day.sunset) / 2;
}

/**
 * The civil day a tithi/nakshatram occurrence is kept on: the first (or,
 * with `latest`, the last) day whose `point` falls inside it, or -- for
 * one too short to contain any such point -- the day whose point it
 * follows.
 */
function dayAtPoint(cal: SunCalendar, segment: Segment, point: DayPoint, latest = false): number {
  const first = cal.dayOf(segment.start) - 1;
  const last = cal.dayOf(segment.end) + 1;
  let previous = first;
  let found: number | null = null;
  for (let d = first; d <= last; d += 1) {
    const at = pointOf(cal.day(d), point);
    if (at >= segment.start && at < segment.end) {
      if (!latest) return d;
      found = d;
    }
    if (at < segment.start) previous = d;
  }
  return found ?? previous;
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
// Festivals -- the Sri Vaishnava pattern of Sri Ahobila Mutt's calendar:
// the same observances, kept by the same day rules.
//
//  - A tithi festival is kept on the day whose sunrise falls in that
//    tithi; a tithi that sees no sunrise (kshaya) is kept on the day it
//    begins. A few use another moment of the day (noted per rule).
//  - A tirunakshatram (Azhvars, acharyas, the Azhagiyasingars) is kept in
//    its Tamil month on the day whose sunrise the nakshatram holds, if it
//    runs on for at least 10 nazhigai (4 hours) after that sunrise --
//    otherwise on the day before, when it began; if it falls twice in the
//    month, on the second. The monthly Rohini and Swathi days follow the
//    same rule; the monthly Sravanam keeps the plain sunrise rule.
//  - Aradhanams follow the sraddha rule: the day the tithi covers the
//    most of the aparahna (the fourth fifth of the daytime).
// ---------------------------------------------------------------------------

/** Daylight `from`..`to` (fractions of sunrise→sunset) on day `d` covered by `segment`, in ms. */
function coverage(cal: SunCalendar, segment: Segment, d: number, from = 0, to = 1): number {
  const day = cal.day(d);
  const length = day.sunset - day.sunrise;
  return Math.max(0, Math.min(segment.end, day.sunrise + to * length) - Math.max(segment.start, day.sunrise + from * length));
}

const NAZHIGAI_MS = 24 * MS_PER_MINUTE;
/** A tirunakshatram must hold 12 nazhigai past sunrise to be kept that day. */
const TIRUNAKSHATRAM_NAZHIGAI = 12;
/** The monthly Sravanam, Rohini and Swathi days need 6. */
const MONTHLY_STAR_NAZHIGAI = 6;

/**
 * The day a nakshatram's tirunakshatram is kept on: the day whose sunrise
 * it holds, provided it lasts 10 nazhigai past that sunrise -- else the
 * day it began. One that holds no sunrise is kept on the day it began.
 */
function dayOfStar(cal: SunCalendar, segment: Segment, nazhigai = TIRUNAKSHATRAM_NAZHIGAI): number {
  for (let d = cal.dayOf(segment.start); d <= cal.dayOf(segment.end); d += 1) {
    const sunrise = cal.day(d).sunrise;
    if (sunrise >= segment.start && sunrise < segment.end) {
      return segment.end - sunrise >= nazhigai * NAZHIGAI_MS ? d : d - 1;
    }
  }
  return cal.hinduDayOf(segment.start);
}

/** The day an occurrence covers the most of daylight window `from`..`to`, or null if it covers none. */
function dayOfMostCoverage(cal: SunCalendar, segment: Segment, from = 0, to = 1): number | null {
  let best: number | null = null;
  let bestCoverage = 0;
  for (let d = cal.dayOf(segment.start); d <= cal.dayOf(segment.end); d += 1) {
    const c = coverage(cal, segment, d, from, to);
    if (c > bestCoverage) {
      bestCoverage = c;
      best = d;
    }
  }
  return best;
}

const RASI_NAMES = ["Mesha", "Vrishabha", "Mithuna", "Kataka", "Simha", "Kanya", "Thula", "Vruschika", "Dhanur", "Makara", "Kumbha", "Meena"];
const LUNAR_MONTH_NAMES = [
  "Chaitram", "Vaisakham", "Jyeshtham", "Aashaadham", "Sraavanam", "Bhaadrapadam",
  "Aashvayujam", "Kaartikam", "Maargasirsham", "Pushyam", "Maagham", "Phaalgunam",
];

type TithiRule = {
  name: string;
  month: number | null;
  tithi: number;
  at?: DayPoint | "aparahna-coverage" | "last-sunset" | "last-arunodaya" | "6-nazhigai" | "12-nazhigai";
};

/** Lunar months: 0 Chaitra … 11 Phalguna (amanta, nija months only). Tithis: 0 Shukla Prathama … 29 Amavasya. */
const TITHI_FESTIVALS: TithiRule[] = [
  { name: "Sri Rama Navami", month: 0, tithi: 8 },
  { name: "Akshaya Tritiya", month: 1, tithi: 2 },
  { name: "Sri Nrsimha Jayanthi", month: 1, tithi: 13 },
  { name: "Yajur Upakarma", month: 4, tithi: 14, at: "12-nazhigai" },
  { name: "Gayatri Japam", month: 4, tithi: 15, at: "aparahna-coverage" },
  { name: "Mahalaya Paksham Begins", month: 5, tithi: 15, at: "aparahna-coverage" },
  { name: "Madhyashtami", month: 5, tithi: 22, at: "aparahna-coverage" },
  { name: "Mahalaya Amavasya", month: 5, tithi: 29, at: "aparahna-coverage" },
  { name: "Maha Navami", month: 6, tithi: 8 },
  { name: "Vijaya Dasami", month: 6, tithi: 9 },
  { name: "Deepavali", month: 6, tithi: 28, at: "last-arunodaya" },
  { name: "Ratha Saptami", month: 10, tithi: 6 },
  { name: "Ashtaka", month: 10, tithi: 22, at: "aparahna-coverage" },
  { name: "Anvashtaka", month: 10, tithi: 23, at: "aparahna-coverage" },
  // The first evening in Ashvina Shukla Dvitiya.
  { name: "Navaratri Pooja Begins", month: 6, tithi: 1, at: "sunset" },
  // Trayodasi at sunset; when it spans two sunsets, the second.
  { name: "Pradosham", month: null, tithi: 12, at: "last-sunset" },
  { name: "Pradosham", month: null, tithi: 27, at: "last-sunset" },
  { name: "Amavasya Tarpanam", month: null, tithi: 29, at: "aparahna-coverage" },
];

/** Observances kept by Tamil month (0 Chithirai … 11 Panguni) and tithi. */
const TAMIL_MONTH_TITHI_FESTIVALS: Array<{ name: string; tamilMonth: number; tithi: number; at: TithiRule["at"] }> = [
  { name: "Chitra Pournami", tamilMonth: 0, tithi: 14, at: "12-nazhigai" },
];

type StarRule = { name: string; tamilMonth: number; nakshatra: number; krishnaPakshaOnly?: boolean };

/** Nakshatras: 0 Aswini … 26 Revathi. */
const STAR_FESTIVALS: StarRule[] = [
  // Chithirai
  { name: "Uyyakondar", tamilMonth: 0, nakshatra: 2 },
  { name: "Sri Bhagavad Ramanuja", tamilMonth: 0, nakshatra: 5 },
  { name: "Sri Appullar", tamilMonth: 0, nakshatra: 5 },
  { name: "Sri Mudaliyandan", tamilMonth: 0, nakshatra: 6 },
  { name: "Sri Gadikasatam Ammal", tamilMonth: 0, nakshatra: 12 },
  { name: "Kidambi Achan", tamilMonth: 0, nakshatra: 12 },
  { name: "Madhurakavi Azhvar", tamilMonth: 0, nakshatra: 13 },
  { name: "Sri Nadadur Ammal", tamilMonth: 0, nakshatra: 13 },
  { name: "Srirangachariar", tamilMonth: 0, nakshatra: 26 },
  // Vaikasi
  { name: "Vaduka Nambi", tamilMonth: 1, nakshatra: 0 },
  { name: "Sri Thirukottiyur Nambi", tamilMonth: 1, nakshatra: 3 },
  { name: "Sri Nammazhvar", tamilMonth: 1, nakshatra: 15 },
  { name: "Sri Parasara Bhattar", tamilMonth: 1, nakshatra: 16 },
  { name: "Perumal Arayar", tamilMonth: 1, nakshatra: 17 },
  // Ani
  { name: "Sudarshana Jayanthi", tamilMonth: 2, nakshatra: 13 },
  { name: "Sri Periyazhvar", tamilMonth: 2, nakshatra: 14 },
  { name: "Vadakku Thiruveedhi Pillai", tamilMonth: 2, nakshatra: 14 },
  { name: "Nathamunigal", tamilMonth: 2, nakshatra: 16 },
  // Adi
  { name: "Thiru Adi Pooram", tamilMonth: 3, nakshatra: 10 },
  { name: "Sri Alavandar", tamilMonth: 3, nakshatra: 20 },
  // Avani
  { name: "Sri Jayanthi", tamilMonth: 4, nakshatra: 3, krishnaPakshaOnly: true },
  { name: "Periyavachan Pillai", tamilMonth: 4, nakshatra: 3, krishnaPakshaOnly: true },
  { name: "Kumara Varadacharyar", tamilMonth: 4, nakshatra: 3, krishnaPakshaOnly: true },
  { name: "Sama Upakarma", tamilMonth: 4, nakshatra: 12 },
  { name: "Rig Upakarma", tamilMonth: 4, nakshatra: 21 },
  // Purattasi
  { name: "Sri Adivan Satagopa Jeeyar", tamilMonth: 5, nakshatra: 17 },
  { name: "Sri Kesavacharyar", tamilMonth: 5, nakshatra: 17 },
  { name: "Sri Vedanta Desikan", tamilMonth: 5, nakshatra: 21 },
  { name: "Sri Kamalavasar", tamilMonth: 5, nakshatra: 21 },
  { name: "Sri Srinivasar", tamilMonth: 5, nakshatra: 21 },
  // Aippasi
  { name: "Sri Vishwaksenar", tamilMonth: 6, nakshatra: 19 },
  { name: "Thirukurugai Piran Pillan", tamilMonth: 6, nakshatra: 19 },
  { name: "Poigai Azhvar", tamilMonth: 6, nakshatra: 21 },
  { name: "Bhoothathazhvar", tamilMonth: 6, nakshatra: 22 },
  { name: "Peyazhvar", tamilMonth: 6, nakshatra: 23 },
  // Karthigai
  { name: "Thirumangai Azhvar", tamilMonth: 7, nakshatra: 2 },
  { name: "Nampillai", tamilMonth: 7, nakshatra: 2 },
  { name: "Thiruppanazhvar", tamilMonth: 7, nakshatra: 3 },
  // Margazhi
  { name: "Thondaradippodi Azhvar", tamilMonth: 8, nakshatra: 17 },
  { name: "Periya Nambi", tamilMonth: 8, nakshatra: 17 },
  // Thai
  { name: "Embar", tamilMonth: 9, nakshatra: 6 },
  { name: "Thirumazhisai Azhvar", tamilMonth: 9, nakshatra: 9 },
  { name: "Sri Koorathazhvan", tamilMonth: 9, nakshatra: 12 },
  { name: "Pallandu Recitation Resumes", tamilMonth: 9, nakshatra: 12 },
  // Masi
  { name: "Thirukkachi Nambi", tamilMonth: 10, nakshatra: 4 },
  { name: "Kulasekhara Azhvar", tamilMonth: 10, nakshatra: 6 },
  { name: "Kesavacharyar", tamilMonth: 10, nakshatra: 6 },
  { name: "Sri Manakkal Nambi", tamilMonth: 10, nakshatra: 9 },
  { name: "Masi Magam", tamilMonth: 10, nakshatra: 9 },
  // Panguni
  { name: "Panguni Uthiram", tamilMonth: 11, nakshatra: 11 },
  { name: "Nanjeeyar", tamilMonth: 11, nakshatra: 11 },
  { name: "Sri Ranganathar", tamilMonth: 11, nakshatra: 26 },
];

/**
 * The Azhagiyasingars (the pontiffs of Sri Ahobila Mutt, 2nd–46th; the
 * 1st is Sri Adivan Satagopa Jeeyar above): [pattam, Tamil month,
 * nakshatram] of each one's tirunakshatram.
 */
const AZHAGIYASINGAR_STARS: Array<[number, number, number]> = [
  [2, 4, 17], [3, 9, 21], [4, 8, 13], [5, 7, 2], [6, 9, 24], [7, 1, 15], [8, 8, 0], [9, 2, 5], [10, 1, 15],
  [11, 6, 18], [12, 5, 10], [13, 2, 20], [14, 3, 20], [15, 9, 13], [16, 8, 4], [17, 5, 23], [18, 5, 8],
  [19, 10, 9], [20, 5, 18], [21, 11, 12], [22, 3, 3], [23, 2, 25], [24, 0, 6], [25, 3, 14], [26, 3, 10],
  [27, 1, 22], [28, 4, 18], [29, 0, 13], [30, 8, 15], [31, 7, 9], [32, 0, 24], [33, 5, 15], [34, 7, 20],
  [35, 1, 17], [36, 3, 7], [37, 10, 7], [38, 9, 5], [39, 1, 1], [40, 8, 15], [41, 8, 24], [42, 9, 20],
  [43, 7, 19], [44, 4, 12], [45, 7, 25], [46, 2, 9],
];

function azhagiyasingar(pattam: number): string {
  return `${ordinal(pattam)} Azhagiyasingar`;
}

for (const [pattam, tamilMonth, nakshatra] of AZHAGIYASINGAR_STARS) {
  STAR_FESTIVALS.push({ name: `${azhagiyasingar(pattam)} Tirunakshatram`, tamilMonth, nakshatra });
}
STAR_FESTIVALS.push(
  { name: `${azhagiyasingar(46)} Ashrama Sweekaram`, tamilMonth: 0, nakshatra: 14 },
  { name: `${azhagiyasingar(45)} Ashrama Sweekaram`, tamilMonth: 6, nakshatra: 25 }
);

/** Aradhanams, by the sraddha rule: [pattam, Tamil month, tithi]. */
const ARADHANAMS: Array<[number, number, number]> = [
  [45, 1, 8],
  [44, 3, 17],
];


/** Every fixed festival name -- the line also carries the timed sankranti and Dvadasi Paranai entries. */
export const FESTIVAL_NAMES: readonly string[] = Array.from(
  new Set([
    "Ugadi",
    ...TITHI_FESTIVALS.map((f) => f.name),
    ...TAMIL_MONTH_TITHI_FESTIVALS.map((f) => f.name),
    ...STAR_FESTIVALS.map((f) => f.name),
    ...ARADHANAMS.map(([pattam]) => `${azhagiyasingar(pattam)} Aradhanam`),
    "Sravanam",
    "Rohini",
    "Swathi",
    ...LUNAR_MONTH_NAMES,
    ...LUNAR_MONTH_NAMES.flatMap((m) => [`Adhika ${m}`, `Nija ${m}`]),
    "Karthigai Deepam",
    "Ekadasi Vratam",
    "Kaisika Ekadasi",
    "Vaikunta Ekadasi",
    "Bhishma Ekadasi",
    "Gayatri Japam",
    "Navaratri Pooja Begins",
    "Maha Bharani",
    "AnadhyAyana Kalam Begins",
    "Koodarai Vellum",
    "Vanga Kadal",
    "Bhogi",
    "Kanu Pandigai",
    "Punyakalam",
    "Dakshinayana Punyakalam",
    "Makara Sankranti",
    "Uttarayana Punyakalam",
    "Varsha Pirappu",
    "Margazhi Thingal",
    "Karadayan Nonbu",
    ...RASI_NAMES.map((r) => `${r} Masa Punyakalam`),
  ])
);

/**
 * When a nakshatram falls twice in one Tamil month, its tirunakshatram is
 * kept on the second occurrence.
 */
function recursInSameTamilMonth(cal: SunCalendar, segment: Segment, tamilMonth: number): boolean {
  let next = nakshatraAt(segment.start + 27.3217 * MS_PER_DAY + 6 * MS_PER_HOUR);
  if (next.index !== segment.index) {
    next = nakshatraAt(next.index === (segment.index + 1) % 27 ? next.start - MS_PER_HOUR : next.end + MS_PER_HOUR);
  }
  if (next.index !== segment.index) return false;
  return cal.tamilMonthOfStars(dayOfStar(cal, next)) === tamilMonth;
}

/** Lunar month of an occurrence, "Adhika"/"Nija" aware. */
function lunarMonthOf(segment: Segment): { index: number; adhika: boolean; nija: boolean } {
  const month = lunarMonthAt(segment.start + MS_PER_MINUTE);
  const previous = lunarMonthAt(segment.start - 15 * MS_PER_DAY);
  return { ...month, nija: !month.adhika && previous.adhika && previous.index === month.index };
}

/**
 * The Dvadasi Paranai on day `d`, after the Ekadasi (paksha index `e`)
 * fasted the day before: from sunrise -- or from the end of the Ekadasi,
 * or of Hari Vasara (the first quarter of Dvadasi), whichever is later --
 * to the end of the first fifth of the daytime; "Alpa" when Dvadasi
 * itself ends sooner and cuts the window short.
 */
function paranaText(cal: SunCalendar, d: number, e: number): string {
  const { timeZone } = cal.place;
  const day = cal.day(d);
  const atSunrise = tithiAt(day.sunrise);
  const ekadasiEnd = atSunrise.index === e ? atSunrise.end : day.sunrise;
  const dvadasi = tithiAt(Math.max(day.sunrise, ekadasiEnd) + MS_PER_MINUTE);
  const hasDvadasi = dvadasi.index === e + 1;
  const hariVasaraEnd = hasDvadasi ? dvadasi.start + (dvadasi.end - dvadasi.start) / 4 : day.sunrise;
  const start = Math.max(day.sunrise, ekadasiEnd, hariVasaraEnd);
  const prathamaBhagaEnd = day.sunrise + (day.sunset - day.sunrise) / 5;
  const alpa = hasDvadasi && dvadasi.end < prathamaBhagaEnd;
  const end = alpa ? dvadasi.end : prathamaBhagaEnd;
  if (end - start < MS_PER_MINUTE) return `Dvadasi Paranai after ${clock24(start, timeZone)}`;
  return `${alpa ? "Alpa " : ""}Dvadasi Paranai ${clock24(start, timeZone)}-${clock24(end, timeZone)}`;
}

/** The sankranti (if any) in the Hindu day starting at day `d`'s sunrise. */
function sankrantiIn(cal: SunCalendar, d: number): { rasi: number; at: number } | null {
  const sign = rasiAt(cal.day(d).sunrise);
  return sign.end < cal.day(d + 1).sunrise ? { rasi: (sign.index + 1) % 12, at: sign.end } : null;
}

const SANKRANTI_PUNYAKALAM: Record<number, string[]> = {
  0: ["Varsha Pirappu", "Punyakalam"],
  3: ["Dakshinayana Punyakalam"],
  8: ["Punyakalam"],
  9: ["Makara Sankranti", "Uttarayana Punyakalam"],
};
const NEXT_DAY_PUNYAKALAM: Record<number, string[]> = {
  0: ["Varsha Pirappu", "Mesha Masa Punyakalam"],
  3: ["Dakshinayana Punyakalam"],
  8: ["Dhanur Masa Punyakalam"],
  9: ["Makara Sankranti", "Uttarayana Punyakalam"],
};

/**
 * The punyakalam day of the sankranti -- the civil day it falls on -- if
 * that is `d`; the sankranti itself is listed on the Hindu day it falls
 * in, which differs when it comes after midnight.
 */
function punyakalamRasiOn(cal: SunCalendar, d: number): number | null {
  for (const h of [d, d - 1]) {
    const s = sankrantiIn(cal, h);
    if (s && punyakalamDay(cal, h, s) === d) return s.rasi;
  }
  return null;
}

/**
 * The day a sankranti's punyakalam is kept, for a sankranti in Hindu day
 * `h`: the civil day it falls on -- so one after midnight moves to the
 * next day. Karkata's (Dakshinayana) punyakalam precedes the sankranti
 * and stays on day `h`; Makara's (Uttarayana) follows it, so one after
 * sunset moves to the next day.
 */
function punyakalamDay(cal: SunCalendar, h: number, sankranti: { rasi: number; at: number }): number {
  if (sankranti.rasi === 3) return h;
  if (sankranti.rasi === 9 && sankranti.at > cal.day(h).sunset) return h + 1;
  return localTime(sankranti.at, cal.place.timeZone).dayNumber;
}

function sankrantiFestivals(cal: SunCalendar, d: number): string[] {
  const names: string[] = [];
  const { timeZone } = cal.place;
  const today = sankrantiIn(cal, d);
  if (today) {
    if (today.rasi === 11) names.push("Karadayan Nonbu");
    const nextDay = localTime(today.at, timeZone).dayNumber > d;
    names.push(`${RASI_NAMES[today.rasi]} Ravi ${clock24(today.at, timeZone)}${nextDay ? " (+1)" : ""}`);
    if (punyakalamDay(cal, d, today) === d) names.push(...(SANKRANTI_PUNYAKALAM[today.rasi] ?? ["Punyakalam"]));
  }
  const yesterday = sankrantiIn(cal, d - 1);
  if (yesterday && punyakalamDay(cal, d - 1, yesterday) === d) {
    names.push(...(NEXT_DAY_PUNYAKALAM[yesterday.rasi] ?? [`${RASI_NAMES[yesterday.rasi]} Masa Punyakalam`]));
  }
  return names;
}

/**
 * Days since Margazhi Thingal (Margazhi 1 = 0), for the Tiruppavai days --
 * counted on even past the month's end, so Vanga Kadal (day 30) is kept
 * in a 29-day Margazhi too -- or null when not within 30 days of it.
 */
function margazhiDayIndex(cal: SunCalendar, d: number): number | null {
  for (let back = 0; back < 30; back += 1) {
    if (cal.tamilMonth(d - back) === 8 && cal.tamilMonth(d - back - 1) !== 8) return back;
  }
  return null;
}

function tithiFestivalsOn(cal: SunCalendar, d: number): string[] {
  const names: string[] = [];
  const tamilMonth = cal.tamilMonth(d);
  for (const segment of segmentsBetween(cal, tithiAt, d - 2, d + 2)) {
    const keptOn = (at: TithiRule["at"]) =>
      at === "aparahna-coverage"
        ? dayOfMostCoverage(cal, segment, 0.6, 0.8)
        : at === "last-sunset"
          ? dayAtPoint(cal, segment, "sunset", true)
          : at === "last-arunodaya"
            ? dayAtPoint(cal, segment, "arunodaya", true)
            : at === "6-nazhigai" || at === "12-nazhigai"
              ? dayOfStar(cal, segment, at === "6-nazhigai" ? 6 : 12)
              : dayAtPoint(cal, segment, at ?? "sunrise");
    let month: ReturnType<typeof lunarMonthOf> | null = null;
    const monthOf = () => (month ??= lunarMonthOf(segment));

    // The lunar month opens on the day of its Shukla Prathama.
    // The lunar month opens on the day of its Shukla Prathama (sunrise
    // rule); Chaitra -- Ugadi -- on the day Prathama covers the most daylight.
    if (segment.index === 0) {
      const m = monthOf();
      const opensOn = m.index === 0 && !m.adhika ? dayOfStar(cal, segment, 6) : dayAtPoint(cal, segment, "sunrise");
      if (opensOn === d) names.push(`${m.adhika ? "Adhika " : m.nija ? "Nija " : ""}${LUNAR_MONTH_NAMES[m.index]}`);
      if (opensOn === d && m.index === 0 && !m.adhika) names.push("Ugadi");
    }
    for (const rule of TITHI_FESTIVALS) {
      if (rule.tithi !== segment.index || keptOn(rule.at) !== d) continue;
      if (rule.month !== null && (monthOf().adhika || monthOf().index !== rule.month)) continue;
      names.push(rule.name);
    }
    for (const rule of TAMIL_MONTH_TITHI_FESTIVALS) {
      if (rule.tithi === segment.index && rule.tamilMonth === tamilMonth && keptOn(rule.at) === d) names.push(rule.name);
    }
    for (const [pattam, month, tithi] of ARADHANAMS) {
      if (tithi === segment.index && month === tamilMonth && keptOn("aparahna-coverage") === d) {
        names.push(`${azhagiyasingar(pattam)} Aradhanam`);
      }
    }
  }
  return names;
}

function starFestivalsOn(cal: SunCalendar, d: number): string[] {
  const names: string[] = [];
  const tamilMonth = cal.tamilMonth(d);
  for (const segment of segmentsBetween(cal, nakshatraAt, d - 2, d + 2)) {
    if (dayOfStar(cal, segment, MONTHLY_STAR_NAZHIGAI) === d) {
      if (segment.index === 21) names.push("Sravanam");
      if (segment.index === 3) names.push("Rohini");
      if (segment.index === 14) names.push("Swathi");
    }
    // Bharani in Mahalaya Paksham (the Krishna Paksha of Bhadrapada), a
    // sraddha day: kept where it covers the most of the aparahna.
    if (segment.index === 1 && dayOfMostCoverage(cal, segment, 0.6, 0.8) === d && cal.tithiAtSunrise(d) >= 15) {
      const m = lunarMonthAt(cal.day(d).sunrise);
      if (!m.adhika && m.index === 5) names.push("Maha Bharani");
    }
    const starMonth = cal.tamilMonthOfStars(d);
    // Karthigai Deepam: Krittika at sunrise in Karthigai.
    if (segment.index === 2 && starMonth === 7 && dayAtPoint(cal, segment, "sunrise") === d) names.push("Karthigai Deepam");
    if (dayOfStar(cal, segment) !== d) continue;
    const rules = STAR_FESTIVALS.filter((rule) => rule.nakshatra === segment.index && rule.tamilMonth === starMonth);
    if (rules.length === 0 || recursInSameTamilMonth(cal, segment, starMonth)) continue;
    for (const rule of rules) {
      if (rule.krishnaPakshaOnly && cal.tithiAtSunrise(d) < 15) continue;
      names.push(rule.name);
    }
  }
  return names;
}

function festivalsOn(cal: SunCalendar, d: number): string[] {
  const names: string[] = [];
  const tamilMonth = cal.tamilMonth(d);

  names.push(...starFestivalsOn(cal, d));
  if (starFestivalsOn(cal, d - 1).includes("Karthigai Deepam")) names.push("AnadhyAyana Kalam Begins");

  // Ekadasi, and the next morning's Paranai.
  const ekadasi = ekadasiObservedOn(cal, d);
  if (ekadasi !== null) {
    let name = "Ekadasi Vratam";
    if (ekadasi === 10 && tamilMonth === 7) name = "Kaisika Ekadasi";
    if (ekadasi === 10 && tamilMonth === 8) name = "Vaikunta Ekadasi";
    if (ekadasi === 10 && lunarMonthAt(cal.day(d).sunrise).index === 10) name = "Bhishma Ekadasi";
    names.push(name);
  }
  const ekadasiYesterday = ekadasiObservedOn(cal, d - 1);
  if (ekadasiYesterday !== null) names.push(paranaText(cal, d, ekadasiYesterday));

  // Tithi festivals.
  names.push(...tithiFestivalsOn(cal, d));


  // The solar year: sankrantis, and the Margazhi/Thai days around Pongal.
  names.push(...sankrantiFestivals(cal, d));
  const margazhiDay = margazhiDayIndex(cal, d);
  if (margazhiDay === 0) names.push("Margazhi Thingal");
  if (margazhiDay === 26) names.push("Koodarai Vellum");
  if (margazhiDay === 29) names.push("Vanga Kadal");
  if (punyakalamRasiOn(cal, d + 1) === 9) names.push("Bhogi");
  if (punyakalamRasiOn(cal, d - 1) === 9) names.push("Kanu Pandigai");

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

/**
 * The kaalam taking eighth `part` of the daylight, reckoned in whole
 * minutes as printed panchangams do: counted from sunrise to the
 * minute, each eighth the whole minutes in an eighth of the daylight,
 * and the last eighth running on to sunset.
 */
function kaalam(day: SunDay, part: number, timeZone: string): string {
  if (!day.hasSunEvents) return "";
  const sunrise = Math.floor(day.sunrise / MS_PER_MINUTE) * MS_PER_MINUTE;
  const sunset = Math.floor(day.sunset / MS_PER_MINUTE) * MS_PER_MINUTE;
  const eighth = Math.floor((day.sunset - day.sunrise) / 8 / MS_PER_MINUTE) * MS_PER_MINUTE;
  const start = sunrise + part * eighth;
  const end = part === 7 ? sunset : start + eighth;
  return `${clock24(start, timeZone)}-${clock24(end, timeZone)}`;
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
