/**
 * Grahaṇam: the lunar and solar eclipses that can be seen from a place,
 * with their times on the place's clock, the part that can be seen there,
 * and the nakshatram and rāśi they fall in.
 *
 * The eclipse itself is modern astronomy (Astronomy Engine, MIT): the
 * app's traditional Moon (panchangam-siddhanta.ts) can stand up to ~3°
 * from the true one, enough to miss an eclipse or move its contacts by
 * hours. Checked against Sri Ranganātha Pādukā's printed Srirangam times
 * (tests/content/panchangam-eclipses.test.ts): 3 Mar 2026 and 7–8 Sep
 * 2025, every contact within 2 minutes.
 *
 * The nakshatram and rāśi are the app's own (traditional) longitude of
 * the Moon (lunar eclipse) or Sun (solar eclipse) at the eclipse's
 * greatest phase, so the label matches the rest of the calendar and the
 * published saṅkalpam.
 *
 * Contacts, for a lunar eclipse: sparśam and mokṣam are the start and end
 * of the partial (umbral) phase -- the Pādukā's usage -- or of the
 * penumbral phase for a penumbral-only eclipse; madhyam is the greatest
 * eclipse. For a solar eclipse they are the place's own first contact,
 * maximum and last contact. An eclipse is listed only where some part of
 * it can be seen (the Moon or Sun above the horizon, by the standard
 * rise/set definition), on the local day it is first seen.
 */

import * as Astronomy from "astronomy-engine";
import { clockOnDay, dayNumberAt, NAKSHATRA_NAMES, RASI_NAMES, type PanchangamPlace } from "./panchangam-engine.ts";
import { traditionalMoonLongitude, traditionalSunLongitude } from "./panchangam-siddhanta.ts";

export type GrahanamBody = "lunar" | "solar";
/** What the place sees: lunar total/partial/penumbral; solar total/annular/partial. */
export type GrahanamKind = "total" | "partial" | "penumbral" | "annular";

export interface Grahanam {
  body: GrahanamBody;
  kind: GrahanamKind;
  /** The eclipse's classification as a whole (for a solar eclipse it can differ from `kind`). */
  globalKind: GrahanamKind;
  /** Civil day number (dayNumberOf) at the place it is listed on: the day it is first seen. */
  dayNumber: number;
  sparsam: number;
  madhyam: number;
  moksham: number;
  totalBegin?: number;
  totalEnd?: number;
  /** The part that can be seen from the place. */
  visibleFrom: number;
  visibleTo: number;
  /** The Moon/Sun rises after sparśam: the eclipse is already underway when it can first be seen. */
  underwayAtRise: boolean;
  /** The Moon/Sun sets before mokṣam. */
  setsDuring: boolean;
  /** Whether madhyam falls in the part that can be seen. */
  peakVisible: boolean;
  /** Index into NAKSHATRA_NAMES / RASI_NAMES. */
  nakshatra: number;
  rasi: number;
  /** "HH:MM" on the place's clock, " (+1)" when after the listed day (as the rest of the calendar). */
  labels: {
    sparsam: string;
    madhyam: string;
    moksham: string;
    totalBegin?: string;
    totalEnd?: string;
    visibleFrom: string;
    visibleTo: string;
  };
}

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;
const NAKSHATRA_SPAN = 360 / 27;

function observerOf(place: PanchangamPlace): Astronomy.Observer {
  return new Astronomy.Observer(place.latitude, place.longitude, 0);
}

/** Whether `body` is above the horizon at `ms` (standard rise/set definition: upper limb, with refraction). */
function isUp(body: Astronomy.Body, observer: Astronomy.Observer, ms: number): boolean {
  const time = Astronomy.MakeTime(new Date(ms));
  const nextRise = Astronomy.SearchRiseSet(body, observer, +1, time, 2);
  const nextSet = Astronomy.SearchRiseSet(body, observer, -1, time, 2);
  if (nextRise && nextSet) return nextSet.date.getTime() < nextRise.date.getTime();
  // No rise or set within two days (polar day or night): go by altitude.
  const eq = Astronomy.Equator(body, time, observer, true, true);
  return Astronomy.Horizon(time, observer, eq.ra, eq.dec, "normal").altitude > 0;
}

/** The first stretch of [start, end] in which `body` is above the horizon, or null if none. */
function visibleStretch(body: Astronomy.Body, observer: Astronomy.Observer, start: number, end: number): [number, number] | null {
  let from = start;
  if (!isUp(body, observer, start)) {
    const rise = Astronomy.SearchRiseSet(body, observer, +1, Astronomy.MakeTime(new Date(start)), (end - start) / MS_PER_DAY);
    if (!rise || rise.date.getTime() > end) return null;
    from = rise.date.getTime();
  }
  const set = Astronomy.SearchRiseSet(body, observer, -1, Astronomy.MakeTime(new Date(from)), (end - from) / MS_PER_DAY);
  const to = set && set.date.getTime() < end ? set.date.getTime() : end;
  return [from, to];
}

function kindOf(kind: Astronomy.EclipseKind): GrahanamKind {
  switch (kind) {
    case Astronomy.EclipseKind.Total:
      return "total";
    case Astronomy.EclipseKind.Annular:
      return "annular";
    case Astronomy.EclipseKind.Penumbral:
      return "penumbral";
    default:
      return "partial";
  }
}

function build(
  place: PanchangamPlace,
  body: GrahanamBody,
  kind: GrahanamKind,
  globalKind: GrahanamKind,
  contacts: { sparsam: number; madhyam: number; moksham: number; totalBegin?: number; totalEnd?: number },
  greatestAt: number
): Grahanam | null {
  const observer = observerOf(place);
  const stretch = visibleStretch(body === "lunar" ? Astronomy.Body.Moon : Astronomy.Body.Sun, observer, contacts.sparsam, contacts.moksham);
  if (!stretch) return null;
  const [visibleFrom, visibleTo] = stretch;
  const dayNumber = dayNumberAt(visibleFrom, place.timeZone);
  const label = (ms: number) => clockOnDay(Math.floor(ms / MS_PER_MINUTE) * MS_PER_MINUTE, dayNumber, place.timeZone);
  const longitude = body === "lunar" ? traditionalMoonLongitude(greatestAt) : traditionalSunLongitude(greatestAt);
  return {
    body,
    kind,
    globalKind,
    dayNumber,
    ...contacts,
    visibleFrom,
    visibleTo,
    underwayAtRise: visibleFrom > contacts.sparsam,
    setsDuring: visibleTo < contacts.moksham,
    peakVisible: contacts.madhyam >= visibleFrom && contacts.madhyam <= visibleTo,
    nakshatra: Math.floor(longitude / NAKSHATRA_SPAN) % 27,
    rasi: Math.floor(longitude / 30) % 12,
    labels: {
      sparsam: label(contacts.sparsam),
      madhyam: label(contacts.madhyam),
      moksham: label(contacts.moksham),
      ...(contacts.totalBegin !== undefined ? { totalBegin: label(contacts.totalBegin) } : {}),
      ...(contacts.totalEnd !== undefined ? { totalEnd: label(contacts.totalEnd) } : {}),
      visibleFrom: label(visibleFrom),
      visibleTo: label(visibleTo),
    },
  };
}

function lunarEclipses(place: PanchangamPlace, fromMs: number, toMs: number): Grahanam[] {
  const found: Grahanam[] = [];
  for (let e = Astronomy.SearchLunarEclipse(new Date(fromMs)); e.peak.date.getTime() < toMs; e = Astronomy.NextLunarEclipse(e.peak)) {
    const peak = e.peak.date.getTime();
    const kind = kindOf(e.kind);
    const half = (kind === "penumbral" ? e.sd_penum : e.sd_partial) * MS_PER_MINUTE;
    const total = e.sd_total > 0 ? e.sd_total * MS_PER_MINUTE : 0;
    const g = build(
      place,
      "lunar",
      kind,
      kind,
      {
        sparsam: peak - half,
        madhyam: peak,
        moksham: peak + half,
        ...(total ? { totalBegin: peak - total, totalEnd: peak + total } : {}),
      },
      peak
    );
    if (g) found.push(g);
  }
  return found;
}

function solarEclipses(place: PanchangamPlace, fromMs: number, toMs: number): Grahanam[] {
  const found: Grahanam[] = [];
  const observer = observerOf(place);
  for (
    let e = Astronomy.SearchLocalSolarEclipse(new Date(fromMs), observer);
    e.peak.time.date.getTime() < toMs;
    e = Astronomy.NextLocalSolarEclipse(e.peak.time, observer)
  ) {
    const local = e.peak.time.date.getTime();
    // The eclipse as a whole: its own classification and greatest moment.
    const global = Astronomy.SearchGlobalSolarEclipse(new Date(local - 2 * MS_PER_DAY));
    const g = build(
      place,
      "solar",
      kindOf(e.kind),
      kindOf(global.kind),
      {
        sparsam: e.partial_begin.time.date.getTime(),
        madhyam: local,
        moksham: e.partial_end.time.date.getTime(),
        ...(e.total_begin && e.total_end
          ? { totalBegin: e.total_begin.time.date.getTime(), totalEnd: e.total_end.time.date.getTime() }
          : {}),
      },
      global.peak.date.getTime()
    );
    if (g) found.push(g);
  }
  return found;
}

const cache = new Map<string, Grahanam[]>();

/** The eclipses that can be seen from `place`, listed on civil days `fromDay`..`toDay`, in order. */
export function grahanamsBetween(place: PanchangamPlace, fromDay: number, toDay: number): Grahanam[] {
  const key = `${place.latitude},${place.longitude},${place.timeZone},${fromDay},${toDay}`;
  let list = cache.get(key);
  if (!list) {
    // A day either side, so an eclipse first seen on `fromDay` or `toDay` in any time zone is searched.
    const fromMs = (fromDay - 2) * MS_PER_DAY;
    const toMs = (toDay + 2) * MS_PER_DAY;
    list = [...lunarEclipses(place, fromMs, toMs), ...solarEclipses(place, fromMs, toMs)]
      .filter((g) => g.dayNumber >= fromDay && g.dayNumber <= toDay)
      .sort((a, b) => a.visibleFrom - b.visibleFrom);
    if (cache.size > 50) cache.clear();
    cache.set(key, list);
  }
  return list;
}

/** The eclipse listed on civil day `dayNumber` at `place`, or null. Searches the day's whole year once. */
export function grahanamOnDay(place: PanchangamPlace, dayNumber: number): Grahanam | null {
  const yearStart = dayNumber - (((dayNumber % 365) + 365) % 365);
  return grahanamsBetween(place, yearStart - 1, yearStart + 366).find((g) => g.dayNumber === dayNumber) ?? null;
}

/** What the calendar shows for a day's eclipse: plain values, so it can sit in cached Panchangam data. */
export interface GrahanamSummary {
  body: GrahanamBody;
  kind: GrahanamKind;
  globalKind: GrahanamKind;
  /** English names (NAKSHATRA_NAMES / RASI_NAMES), localized by the labels modules. */
  nakshatram: string;
  rasi: string;
  underwayAtRise: boolean;
  setsDuring: boolean;
  labels: Grahanam["labels"];
}

export function grahanamSummary(g: Grahanam): GrahanamSummary {
  return {
    body: g.body,
    kind: g.kind,
    globalKind: g.globalKind,
    nakshatram: NAKSHATRA_NAMES[g.nakshatra],
    rasi: RASI_NAMES[g.rasi],
    underwayAtRise: g.underwayAtRise,
    setsDuring: g.setsDuring,
    labels: g.labels,
  };
}
