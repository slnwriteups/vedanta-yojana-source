/**
 * Builds docs/PANCHANGAM-VALIDATION.md's worldwide matrix: the engine
 * against Sri Ahobila Mutt's published calendar for 18 places
 * (tests/content/fixtures/ahobila-worldwide-2026-27.json).
 *
 *   node scripts/panchangam-validation.ts
 *
 * Every published end is turned into a UTC instant with the place's own
 * zone and compared with the engine's boundary for the same named
 * element -- never by clock text. Observances are compared by what they
 * decide (the day of an Ekadasi or Pradosham, a Paranai window, a
 * sankramanam's minute), not by matching names. Chennai is reported
 * apart: the model's constants were fitted to its 2026-27 times, so it
 * is calibration, not validation.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  NAKSHATRA_NAMES,
  computePanchangam,
  dayNumberOf,
  karanaAt,
  karanaName,
  nakshatraAt,
  tithiAt,
  tithiName,
  utcOffsetMinutes,
  type PanchangamPlace,
} from "../content-lib/panchangam-engine.ts";

interface PublishedDay {
  date: string;
  why: string;
  sunrise: string;
  sunset: string;
  tithis: Array<{ paksha: string; tithi: string; ends: string | null }>;
  nakshatrams: Array<{ nakshatram: string; ends: string | null }>;
  karanas: Array<{ karana: string; ends: string | null }>;
  observances: string;
}

interface PublishedPlace extends PanchangamPlace {
  name: string;
  group: string;
  days: PublishedDay[];
}

export const FIXTURE = "tests/content/fixtures/ahobila-worldwide-2026-27.json";

/** Local clock "HH:MM" (or "HH:MM (+1)") on `iso` at `timeZone` → UTC epoch ms. */
export function localToUtc(iso: string, clock: string, timeZone: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const [h, min] = clock.slice(0, 5).split(":").map(Number);
  const nominal = Date.UTC(y, m - 1, d + (clock.endsWith("(+1)") ? 1 : 0), h, min);
  let guess = nominal - utcOffsetMinutes(nominal, timeZone) * 60_000;
  guess = nominal - utcOffsetMinutes(guess, timeZone) * 60_000;
  return guess;
}

/** Tithi index (0-29) of a published paksha and tithi name. */
function tithiIndex(paksha: string, tithi: string): number {
  for (let i = 0; i < 30; i += 1) if (tithiName(i) === tithi && (i < 15) === (paksha === "Shukla Paksha")) return i;
  return -1;
}

/**
 * The engine's end of the element `index` nearest a published end: the
 * segment containing that instant is either the element itself (its end)
 * or the one after it (its start). NaN when they are further apart.
 */
function engineEnd(at: (ms: number) => { index: number; start: number; end: number }, published: number, matches: (index: number) => boolean, next: (index: number) => boolean): number {
  const segment = at(published);
  if (matches(segment.index)) return segment.end;
  if (next(segment.index)) return segment.start;
  return NaN;
}

/** Minutes between the engine's and the published instant, engine minus published. */
const minutes = (engine: number, published: number) => (engine - published) / 60_000;

/** "HH:MM" local clock as minutes of the day, "(+1)" adding a day. */
function clockMinutes(clock: string): number {
  const [h, m] = clock.slice(0, 5).split(":").map(Number);
  return h * 60 + m + (clock.includes("(+1)") || clock.includes("*") ? 1440 : 0);
}

interface Mismatch {
  place: string;
  date: string;
  what: string;
  detail: string;
}

export interface PlaceResult {
  place: PublishedPlace;
  days: number;
  sunrise: number[];
  sunset: number[];
  tithi: number[];
  nakshatram: number[];
  karana: number[];
  paranai: number[];
  sankranti: number[];
  unmatched: number;
  mismatches: Mismatch[];
}

export function validatePlace(place: PublishedPlace): PlaceResult {
  const result: PlaceResult = {
    place,
    days: place.days.length,
    sunrise: [],
    sunset: [],
    tithi: [],
    nakshatram: [],
    karana: [],
    paranai: [],
    sankranti: [],
    unmatched: 0,
    mismatches: [],
  };
  const byDate = new Map(place.days.map((d) => [d.date, d]));
  const add = (date: string, what: string, detail: string) => result.mismatches.push({ place: place.name, date, what, detail });
  const record = (list: number[], value: number) => {
    if (Number.isNaN(value)) result.unmatched += 1;
    else list.push(value);
  };

  for (const pub of place.days) {
    const [y, m, d] = pub.date.split("-").map(Number);
    const p = computePanchangam(dayNumberOf(y, m, d), place, { placeName: place.name });
    const nextDay = byDate.get(new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10));

    // Sunrise and sunset, local clock minutes (both on the place's clock).
    if (p.sunrise && /^\d\d:\d\d/.test(pub.sunrise)) result.sunrise.push(clockMinutes(p.sunrise) - clockMinutes(pub.sunrise));
    else if (Boolean(p.sunrise) !== /^\d\d:\d\d/.test(pub.sunrise)) add(pub.date, "sunrise", `engine "${p.sunrise}" vs published "${pub.sunrise}"`);
    if (p.sunset && /^\d\d:\d\d/.test(pub.sunset)) result.sunset.push(clockMinutes(p.sunset) - clockMinutes(pub.sunset));

    // The elements at sunrise.
    const sunriseMs = /^\d\d:\d\d/.test(pub.sunrise) ? localToUtc(pub.date, pub.sunrise, place.timeZone) : NaN;
    const near = (instant: number) => (Number.isNaN(sunriseMs) ? "" : ` (published change ${minutes(instant, sunriseMs).toFixed(0)} min from sunrise)`);
    const firstTithi = pub.tithis[0];
    if (firstTithi && (firstTithi.tithi !== p.tithi || firstTithi.paksha !== p.paksha)) {
      add(pub.date, "tithi at sunrise", `engine ${p.paksha} ${p.tithi} vs published ${firstTithi.paksha} ${firstTithi.tithi}${firstTithi.ends ? near(localToUtc(pub.date, firstTithi.ends, place.timeZone)) : ""}`);
    }
    const firstStar = pub.nakshatrams[0];
    if (firstStar && firstStar.nakshatram !== p.nakshatram) {
      add(pub.date, "nakshatram at sunrise", `engine ${p.nakshatram} vs published ${firstStar.nakshatram}${firstStar.ends ? near(localToUtc(pub.date, firstStar.ends, place.timeZone)) : ""}`);
    }

    // Transition instants, UTC. The daily view caps an element still running at the
    // next sunrise to that sunrise; when the next day continues it, that is no end.
    pub.tithis.forEach((t, i) => {
      if (!t.ends) return;
      const capped = i === pub.tithis.length - 1 && nextDay?.tithis[0]?.tithi === t.tithi && nextDay.tithis[0].paksha === t.paksha;
      if (capped) return;
      const k = tithiIndex(t.paksha, t.tithi);
      const at = localToUtc(pub.date, t.ends, place.timeZone);
      record(result.tithi, minutes(engineEnd(tithiAt, at, (x) => x === k, (x) => x === (k + 1) % 30), at));
    });
    pub.nakshatrams.forEach((n, i) => {
      if (!n.ends) return;
      const capped = i === pub.nakshatrams.length - 1 && nextDay?.nakshatrams[0]?.nakshatram === n.nakshatram;
      if (capped) return;
      const k = NAKSHATRA_NAMES.indexOf(n.nakshatram);
      const at = localToUtc(pub.date, n.ends, place.timeZone);
      record(result.nakshatram, minutes(engineEnd(nakshatraAt, at, (x) => x === k, (x) => x === (k + 1) % 27), at));
    });
    for (const k of pub.karanas) {
      if (!k.ends) continue;
      const at = localToUtc(pub.date, k.ends, place.timeZone);
      const segment = karanaAt(at);
      const end =
        karanaName(segment.index) === k.karana ? segment.end : karanaName((segment.index + 59) % 60) === k.karana ? segment.start : NaN;
      record(result.karana, minutes(end, at));
    }

    // Observances by what they decide.
    const isEkadasi = (text: string) => text.split(/,\s*|\s{2,}/).some((o) => /Ekadasi/.test(o) && !/Paranai|Dvadasi/.test(o));
    const pubEkadasi = /Ekadasi/.test(pub.observances.replace(/Dvadasi Paranai[^A-Z]*/g, ""));
    if (pubEkadasi !== isEkadasi(p.festival)) add(pub.date, "Ekadasi day", `engine ${isEkadasi(p.festival) ? "keeps" : "doesn't keep"} Ekadasi; published "${pub.observances}"`);
    const pubPradosham = /Pradosham/.test(pub.observances);
    if (pubPradosham !== /Pradosham/.test(p.festival)) add(pub.date, "Pradosham day", `engine "${p.festival}" vs published "${pub.observances}"`);
    const pubParanai = pub.observances.match(/Dvadasi Paranai (?:after )?(\d\d:\d\d)(?:-(\d\d:\d\d))?/);
    const engParanai = p.festival.match(/Dvadasi Paranai (?:after )?(\d\d:\d\d)(?:-(\d\d:\d\d))?/);
    if (Boolean(pubParanai) !== Boolean(engParanai)) add(pub.date, "Paranai day", `engine "${engParanai?.[0] ?? "none"}" vs published "${pubParanai?.[0] ?? "none"}"`);
    else if (pubParanai && engParanai) {
      result.paranai.push(clockMinutes(engParanai[1]) - clockMinutes(pubParanai[1]));
      if (pubParanai[2] && engParanai[2]) result.paranai.push(clockMinutes(engParanai[2]) - clockMinutes(pubParanai[2]));
    }
    const pubRavi = pub.observances.match(/(\w+) Ravi (\d\d:\d\d\*?)/);
    const engRavi = p.festival.match(/(\w+) Ravi (\d\d:\d\d(?: \(\+1\))?)/);
    if (Boolean(pubRavi) !== Boolean(engRavi)) add(pub.date, "sankramanam day", `engine "${engRavi?.[0] ?? "none"}" vs published "${pubRavi?.[0] ?? "none"}"`);
    else if (pubRavi && engRavi) result.sankranti.push(clockMinutes(engRavi[2]) - clockMinutes(pubRavi[2]));
  }
  return result;
}

/** "n | exact | ≤1 | ≤2 | ≤5 | max" of signed minute differences. */
export function distribution(values: number[]): { n: number; exact: number; within1: number; within2: number; within5: number; max: number } {
  const abs = values.map((v) => Math.abs(Math.round(v)));
  return {
    n: abs.length,
    exact: abs.filter((v) => v === 0).length,
    within1: abs.filter((v) => v <= 1).length,
    within2: abs.filter((v) => v <= 2).length,
    within5: abs.filter((v) => v <= 5).length,
    max: abs.length ? Math.max(...abs) : 0,
  };
}

function cell(values: number[]): string {
  const d = distribution(values);
  if (!d.n) return "–";
  return `${d.n}: ${Math.round((100 * d.within1) / d.n)}% ≤1, ${Math.round((100 * d.within2) / d.n)}% ≤2, max ${d.max}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as { source: string; places: PublishedPlace[] };
  const results = fixture.places.map(validatePlace);
  const row = (r: PlaceResult) =>
    `| ${r.place.name} | ${r.place.group} | ${r.days} | ${cell(r.sunrise)} | ${cell(r.tithi)} | ${cell(r.nakshatram)} | ${cell(r.karana)} | ${cell(r.paranai)} | ${cell(r.sankranti)} | ${r.unmatched} | ${r.mismatches.length} |`;
  const pool = (pick: (r: PlaceResult) => number[], filter: (r: PlaceResult) => boolean) => results.filter(filter).flatMap(pick);
  const validation = (r: PlaceResult) => r.place.group !== "calibration";
  const summary = (name: string, pick: (r: PlaceResult) => number[]) => {
    const d = distribution(pool(pick, validation));
    return `| ${name} | ${d.n} | ${d.exact} | ${d.within1} | ${d.within2} | ${d.within5} | ${d.max} |`;
  };
  const mismatches = results.flatMap((r) => r.mismatches);
  const doc = `## Worldwide matrix

GENERATED by \`scripts/panchangam-validation.ts\` from \`${FIXTURE}\`
(${fixture.source}); re-run it rather than editing these tables.

${results.length} places, ${results.reduce((n, r) => n + r.days, 0)} place-days. Times are compared as UTC instants;
differences are the engine's minus the published, in whole minutes.

### Independent places (all but the calibration place)

| Element | Compared | Exact | ≤ 1 min | ≤ 2 min | ≤ 5 min | Largest |
|---|---|---|---|---|---|---|
${summary("Sunrise", (r) => r.sunrise)}
${summary("Sunset", (r) => r.sunset)}
${summary("Tithi end", (r) => r.tithi)}
${summary("Nakshatram end", (r) => r.nakshatram)}
${summary("Karana end", (r) => r.karana)}
${summary("Dvadasi Paranai bounds", (r) => r.paranai)}
${summary("Sankramanam time", (r) => r.sankranti)}

### By place

Each cell: how many were compared, the share within 1 and 2 minutes, and the largest difference.

| Place | Group | Days | Sunrise | Tithi end | Nakshatram end | Karana end | Paranai | Sankramanam | Unmatched | Disagreements |
|---|---|---|---|---|---|---|---|---|---|---|
${results.map(row).join("\n")}

### Every disagreement

Where the element or observance on a day differs (an engine end that is
not even the same element counts as unmatched above).

| Place | Date | What | Detail |
|---|---|---|---|
${mismatches.map((m) => `| ${m.place} | ${m.date} | ${m.what} | ${m.detail.replace(/\|/g, "/")} |`).join("\n") || "| – | – | – | none |"}
`;
  writeFileSync("docs/PANCHANGAM-VALIDATION-MATRIX.md", doc);
  console.log(`wrote docs/PANCHANGAM-VALIDATION-MATRIX.md: ${results.length} places, ${mismatches.length} disagreements`);
}
