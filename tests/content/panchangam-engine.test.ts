import test from "node:test";
import assert from "node:assert/strict";
import {
  FESTIVAL_NAMES,
  NAKSHATRA_NAMES,
  computePanchangam,
  computePanchangamForDate,
  dayNumberOf,
  tithiName,
  type PanchangamPlace,
} from "../../content-lib/panchangam-engine.ts";
import { moonLongitude, sunLongitude } from "../../content-lib/panchangam-astronomy.ts";
import { PADUKA_PANCHANGAM_ISSUES } from "../../content-lib/paduka-panchangam.ts";
import { localizeSankalpamText, nakshatramLabel, tithiLabel } from "../../lib/panchangam-labels.ts";

/**
 * The reference values below come from two independent sources, never
 * from this engine's own output:
 *
 *  - Swiss Ephemeris 2.10 (pyswisseph, Lahiri ayanamsa) for positions
 *    and tithi/nakshatram transition instants;
 *  - the Paduka journal's printed Panchangam already bundled in
 *    content-lib/paduka-panchangam.ts, and widely published festival
 *    dates, for the calendar rules.
 */

const CHENNAI: PanchangamPlace = { latitude: 13.08, longitude: 80.27, timeZone: "Asia/Kolkata" };
const SRIRANGAM: PanchangamPlace = { latitude: 10.8625, longitude: 78.6896, timeZone: "Asia/Kolkata" };

function day(place: PanchangamPlace, iso: string, sankalpamAt?: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return computePanchangam(dayNumberOf(y, m, d), place, { placeName: "Chennai", sankalpamAt });
}

function angularError(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

test("Sun and Moon longitudes agree with Swiss Ephemeris", () => {
  // [epoch ms, Sun, Moon] -- apparent tropical longitudes from swe.calc_ut.
  const reference: Array<[number, number, number]> = [
    [Date.UTC(2026, 9, 8, 4, 30), 194.9182, 164.5316],
    [Date.UTC(2000, 0, 1, 12, 0), 280.3689, 223.3238],
    [Date.UTC(2040, 5, 15, 0, 0), 84.5197, 141.8239],
  ];
  for (const [ms, sun, moon] of reference) {
    assert.ok(angularError(sunLongitude(ms), sun) < 0.01, `Sun at ${new Date(ms).toISOString()}`);
    assert.ok(angularError(moonLongitude(ms), moon) < 0.005, `Moon at ${new Date(ms).toISOString()}`);
  }
});

test("a day's tithi, nakshatram and their end times match Swiss Ephemeris", () => {
  const p = day(CHENNAI, "2026-10-08");
  assert.equal(p.tithi, "Trayodasi");
  assert.equal(p.paksha, "Krishna Paksha");
  assert.equal(p.nakshatram, "Purva Phalguni");
  // Swiss Ephemeris: Krishna Trayodasi ends 22:16 IST, Purva Phalguni 21:20 IST.
  assert.match(p.tithiEnds, /^22:1[56]$/);
  assert.match(p.nakshatramEnds, /^21:(19|20)$/);
  assert.equal(p.tamilDate, "Purattasi 22");
});

test("sunrise, sunset and the kaalams follow the disc-centre convention", () => {
  const p = day(CHENNAI, "2026-10-08");
  // Swiss Ephemeris, disc centre without refraction: 06:02:xx and 17:50:xx IST.
  assert.equal(p.sunrise, "06:02");
  assert.equal(p.sunset, "17:50");
  // Thursday: Rahu the 6th eighth of daylight, Yamagandam the 1st, Gulikai the 3rd.
  assert.equal(p.rahuKaalam, "13:25-14:53");
  assert.equal(p.yamagandam, "06:02-07:30");
  assert.equal(p.gulikaKaalam, "08:59-10:27");
});

test("agrees with the Paduka journal's printed tithi and nakshatram on nearly every day", () => {
  const days = PADUKA_PANCHANGAM_ISSUES.flatMap((issue) => issue.days);
  const matching = days.filter((d) => {
    const p = day(SRIRANGAM, d.date);
    return p.tithi === d.tithi && p.paksha === d.paksha && p.nakshatram === d.nakshatram;
  });
  // The rest differ only where a tithi or nakshatram turns within minutes of sunrise.
  assert.ok(matching.length >= days.length - 3, `${matching.length}/${days.length} days agree`);
});

test("festivals land on their published 2026 dates", () => {
  const expected: Array<[string, string]> = [
    ["2026-03-19", "Yugadi"],
    ["2026-03-27", "Sri Rama Navami"],
    ["2026-04-14", "Tamil New Year"],
    ["2026-04-22", "Sri Ramanuja Jayanthi"],
    ["2026-08-24", "Ekadasi"],
    ["2026-08-27", "Yajur Upakarma"],
    ["2026-08-28", "Gayatri Japam"],
    ["2026-09-04", "Sri Jayanthi"],
    ["2026-09-22", "Swami Desikan Tirunakshatram"],
    ["2026-09-27", "Mahalaya Paksham begins"],
    ["2026-10-08", "Pradosham"],
    ["2026-10-10", "Mahalaya Amavasya"],
    ["2026-10-11", "Navaratri begins"],
    ["2026-10-18", "Aippasi Masa Pravesam"],
    ["2026-10-21", "Vijaya Dasami"],
    ["2026-10-21", "Bhoothathazhvar Tirunakshatram"],
    ["2026-11-08", "Deepavali"],
    ["2026-11-16", "Poigai Azhvar Tirunakshatram"],
    ["2026-11-24", "Karthigai Deepam"],
    ["2026-12-20", "Vaikunta Ekadasi"],
    ["2027-01-14", "Bhogi"],
    ["2027-01-15", "Makara Sankranti"],
  ];
  for (const [date, festival] of expected) {
    assert.ok(day(CHENNAI, date).festival.split(", ").includes(festival), `${festival} on ${date}`);
  }
});

test("Ekadasi follows the Vaishnava rules", () => {
  // Ekadasi at sunrise on 23 Aug, but the Dvadasi after it holds two sunrises: kept on the 24th.
  assert.doesNotMatch(day(CHENNAI, "2026-08-23").festival, /\bEkadasi\b/);
  assert.match(day(CHENNAI, "2026-08-24").festival, /\bEkadasi\b/);
  // The fast is broken the next morning, in the first fifth of the day.
  assert.match(day(CHENNAI, "2026-09-08").festival, /Dvadasi Paranai 06:0\d-08:2\d/);
  assert.equal(day(CHENNAI, "2026-10-08").upcomingEkadashiText, "Next Ekadasi: Thursday, 22nd Oct 2026.");
  // On an Ekadasi itself, that day is the next one.
  assert.equal(day(CHENNAI, "2026-10-22").upcomingEkadashiText, "Next Ekadasi: Thursday, 22nd Oct 2026.");
});

test("every festival over a year is in the closed vocabulary", () => {
  const start = dayNumberOf(2026, 1, 1);
  for (let offset = 0; offset < 366; offset += 1) {
    const p = computePanchangam(start + offset, CHENNAI, { placeName: "Chennai" });
    for (const name of p.festival.split(", ").filter(Boolean)) {
      if (name.startsWith("Dvadasi Paranai ")) continue;
      assert.ok(FESTIVAL_NAMES.includes(name), `unexpected festival "${name}"`);
    }
  }
});

test("every tithi and nakshatram name localizes", () => {
  for (let i = 0; i < 30; i += 1) assert.notEqual(tithiLabel(tithiName(i), "ta"), tithiName(i));
  for (const name of NAKSHATRA_NAMES) assert.notEqual(nakshatramLabel(name, "ta"), name);
});

test("the Sankalpam names the moment, the place and how long it holds", () => {
  const p = day(CHENNAI, "2026-10-08", Date.UTC(2026, 9, 8, 4, 30));
  assert.match(
    p.sankalpamText,
    /^Sankalpam for Chennai on 8th Oct 2026 At 10:00 AM IST and valid through 09:(19|20):\d\d PM: Parābhava nāma saṁvatsare, dakṣiṇāyane, varṣa ṛtau, kanyā māse, kṛṣṇa pakṣe, trayodaśyām śubha tithau, guru vāsara yuktāyām, pūrvaphalgunī nakṣatra yuktāyām, /
  );
  // The localized wrapper still recognizes it.
  assert.match(localizeSankalpamText(p.sankalpamText, "ta"), /^Chennai க்கான சங்கல்பம் — 8th Oct 2026, 10:00 AM IST முதல் 09:/);
});

test("the Sankalpam reads on the reader's own clock outside India", () => {
  const p = computePanchangam(
    dayNumberOf(2026, 7, 4),
    { latitude: 40.71, longitude: -74.0, timeZone: "America/New_York" },
    { placeName: "New York", sankalpamAt: Date.UTC(2026, 6, 4, 14, 0) }
  );
  assert.match(p.sankalpamText, /^Sankalpam for New York on 4th Jul 2026 At 10:00 AM EDT and valid through .* of following day: /);
  assert.match(p.sankalpamText, /uttarāyaṇe, grīṣma ṛtau, mithuna māse/);
  assert.match(localizeSankalpamText(p.sankalpamText, "hi"), /^New York के लिए संकल्प — 4th Jul 2026, 10:00 AM EDT से अगले दिन /);
});

test("today's Sankalpam is for now; another day's is for its sunrise", () => {
  const now = new Date(Date.UTC(2026, 9, 8, 4, 30));
  assert.match(computePanchangamForDate(now, CHENNAI, "Chennai", now).sankalpamText, / At 10:00 AM IST /);
  const tomorrow = new Date(Date.UTC(2026, 9, 9, 4, 30));
  assert.match(computePanchangamForDate(tomorrow, CHENNAI, "Chennai", now).sankalpamText, / At 6:02 AM IST /);
});

test("a polar day with no sunrise still computes, with no sun times rather than invented ones", () => {
  const p = computePanchangam(
    dayNumberOf(2026, 6, 21),
    { latitude: 78.22, longitude: 15.65, timeZone: "Arctic/Longyearbyen" },
    { placeName: "Longyearbyen" }
  );
  assert.ok(p.tithi && p.nakshatram);
  assert.equal(p.sunrise, "");
  assert.equal(p.rahuKaalam, "");
});
