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
import { sunLongitude } from "../../content-lib/panchangam-astronomy.ts";
import { PADUKA_PANCHANGAM_ISSUES } from "../../content-lib/paduka-panchangam.ts";
import { localizeSankalpamText, nakshatramLabel, tithiLabel } from "../../lib/panchangam-labels.ts";

/**
 * The reference values below are the published ones, never this engine's
 * own output: Sri Ahobila Mutt's Parābhava (2026–27) calendar for each
 * place (tithi/nakshatram end times, sunrise, kaalams, observances), the
 * Paduka journal bundled in content-lib/paduka-panchangam.ts, and Swiss
 * Ephemeris 2.10 for the observed Sun.
 */

const CHENNAI: PanchangamPlace = { latitude: 13.08, longitude: 80.27, timeZone: "Asia/Kolkata" };
const SRIRANGAM: PanchangamPlace = { latitude: 10.8625, longitude: 78.6896, timeZone: "Asia/Kolkata" };
const NEW_YORK: PanchangamPlace = { latitude: 40.71, longitude: -74.0, timeZone: "America/New_York" };
const LONDON: PanchangamPlace = { latitude: 51.5, longitude: -0.12, timeZone: "Europe/London" };
const SYDNEY: PanchangamPlace = { latitude: -33.87, longitude: 151.21, timeZone: "Australia/Sydney" };
const SINGAPORE: PanchangamPlace = { latitude: 1.35, longitude: 103.82, timeZone: "Asia/Singapore" };

function day(place: PanchangamPlace, iso: string, sankalpamAt?: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return computePanchangam(dayNumberOf(y, m, d), place, { placeName: "Chennai", sankalpamAt });
}

function minutes(clock: string): number {
  const [h, m] = clock.replace(" (+1)", "").split(":").map(Number);
  return h * 60 + m + (clock.includes("(+1)") ? 1440 : 0);
}

function observances(place: PanchangamPlace, iso: string): string[] {
  return day(place, iso).festival.split(", ");
}

test("the observed Sun agrees with Swiss Ephemeris", () => {
  // [epoch ms, apparent tropical longitude from swe.calc_ut]
  for (const [ms, sun] of [
    [Date.UTC(2026, 9, 8, 4, 30), 194.9182],
    [Date.UTC(2000, 0, 1, 12, 0), 280.3689],
    [Date.UTC(2040, 5, 15, 0, 0), 84.5197],
  ]) {
    assert.ok(Math.abs(sunLongitude(ms) - sun) < 0.01, `Sun at ${new Date(ms).toISOString()}`);
  }
});

test("a day matches the traditional calendar: tithi, nakshatram, their ends, sunrise, sunset and kaalams", () => {
  // Published for Chennai, 8 Oct 2026: k.trayodasi 22:41, p.phalguni 22:31,
  // Sunrise 06:02, Sunset 17:51, RK 13:22-14:50, YG 06:02-07:30, Gulikan 08:58-10:26.
  const p = day(CHENNAI, "2026-10-08");
  assert.equal(p.paksha, "Krishna Paksha");
  assert.equal(p.tithi, "Trayodasi");
  assert.equal(p.nakshatram, "Purva Phalguni");
  assert.ok(Math.abs(minutes(p.tithiEnds) - minutes("22:41")) <= 2, p.tithiEnds);
  assert.ok(Math.abs(minutes(p.nakshatramEnds) - minutes("22:31")) <= 2, p.nakshatramEnds);
  assert.equal(p.sunrise, "06:02");
  assert.equal(p.sunset, "17:51");
  assert.equal(p.rahuKaalam, "13:22-14:50");
  assert.equal(p.yamagandam, "06:02-07:30");
  assert.equal(p.gulikaKaalam, "08:58-10:26");
  // The Paduka journal dates 10 Oct 2026 "Parābhava Puraṭṭāsi 23".
  assert.equal(p.tamilDate, "Purattasi 21");
  assert.equal(day(CHENNAI, "2026-10-10").tamilDate, "Purattasi 23");
});

test("traditional tithi and nakshatram ends hold across the year", () => {
  // [date, published tithi end, published nakshatram end] -- Chennai.
  const published: Array<[string, string, string]> = [
    ["2026-03-27", "12:54", "17:52"],
    ["2026-08-10", "06:42", "12:02"],
    ["2026-10-18", "07:17", "12:29"],
    ["2026-11-21", "02:10 (+1)", "04:00 (+1)"],
    ["2027-02-01", "12:32", "10:15"],
  ];
  for (const [date, tithiEnd, nakshatramEnd] of published) {
    const p = day(CHENNAI, date);
    assert.ok(Math.abs(minutes(p.tithiEnds) - minutes(tithiEnd)) <= 4, `${date} tithi ${p.tithiEnds} vs ${tithiEnd}`);
    assert.ok(
      Math.abs(minutes(p.nakshatramEnds) - minutes(nakshatramEnd)) <= 4,
      `${date} nakshatram ${p.nakshatramEnds} vs ${nakshatramEnd}`
    );
  }
});

test("agrees with every day of the Paduka journal's printed panchangam", () => {
  for (const d of PADUKA_PANCHANGAM_ISSUES.flatMap((issue) => issue.days)) {
    const p = day(SRIRANGAM, d.date);
    assert.deepEqual([p.paksha, p.tithi, p.nakshatram], [d.paksha, d.tithi, d.nakshatram], d.date);
  }
});

test("observances fall on the traditional calendar's dates in Chennai", () => {
  const expected: Array<[string, string]> = [
    ["2026-03-19", "Ugadi"],
    ["2026-03-19", "Chaitram"],
    ["2026-03-27", "Sri Rama Navami"],
    ["2026-04-22", "Sri Bhagavad Ramanuja"],
    ["2026-04-30", "Sri Nrsimha Jayanthi"],
    ["2026-05-01", "Chitra Pournami"],
    ["2026-05-17", "Adhika Jyeshtham"],
    ["2026-06-16", "Nija Jyeshtham"],
    ["2026-08-24", "Ekadasi Vratam"],
    ["2026-08-26", "Rig Upakarma"],
    ["2026-08-27", "Yajur Upakarma"],
    ["2026-08-28", "Gayatri Japam"],
    ["2026-09-04", "Sri Jayanthi"],
    ["2026-09-22", "Sri Vedanta Desikan"],
    ["2026-09-25", "17th Azhagiyasingar Tirunakshatram"],
    ["2026-09-29", "Maha Bharani"],
    ["2026-10-03", "Madhyashtami"],
    ["2026-10-08", "Pradosham"],
    ["2026-10-10", "Mahalaya Amavasya"],
    ["2026-10-12", "Navaratri Pooja Begins"],
    ["2026-10-21", "Vijaya Dasami"],
    ["2026-11-08", "Deepavali"],
    ["2026-11-08", "Swathi"],
    ["2026-11-16", "Poigai Azhvar"],
    ["2026-11-20", "Kaisika Ekadasi"],
    ["2026-11-24", "Karthigai Deepam"],
    ["2026-11-25", "AnadhyAyana Kalam Begins"],
    ["2026-12-16", "Margazhi Thingal"],
    ["2026-12-20", "Vaikunta Ekadasi"],
    ["2027-01-11", "Koodarai Vellum"],
    ["2027-01-14", "Bhogi"],
    ["2027-01-15", "Uttarayana Punyakalam"],
    ["2027-01-16", "Kanu Pandigai"],
    ["2027-01-21", "Embar"],
    ["2027-02-04", "Pradosham"],
    ["2027-02-17", "Bhishma Ekadasi"],
    ["2027-02-28", "Ashtaka"],
  ];
  for (const [date, name] of expected) {
    assert.ok(observances(CHENNAI, date).includes(name), `${name} on ${date}: ${day(CHENNAI, date).festival}`);
  }
});

test("worldwide, each observance is kept by the reader's own sunrise and clock", () => {
  const expected: Array<[PanchangamPlace, string, string]> = [
    // New York keeps Periyazhvar a day before Chennai: Swathi holds New
    // York's 25 June sunrise for under 12 nazhigai.
    [NEW_YORK, "2026-06-24", "Sri Periyazhvar"],
    [NEW_YORK, "2026-10-09", "Mahalaya Amavasya"],
    [NEW_YORK, "2026-10-11", "Navaratri Pooja Begins"],
    [NEW_YORK, "2027-01-14", "Uttarayana Punyakalam"],
    [LONDON, "2026-07-16", "Dakshinayana Punyakalam"],
    [LONDON, "2026-10-19", "Poigai Azhvar"],
    [LONDON, "2027-01-15", "Uttarayana Punyakalam"],
    [SYDNEY, "2026-03-20", "Ugadi"],
    [SYDNEY, "2026-11-25", "Karthigai Deepam"],
    [SYDNEY, "2027-02-28", "Ashtaka"],
    [SYDNEY, "2027-04-20", "Chitra Pournami"],
    [SINGAPORE, "2026-03-19", "Ugadi"],
    [SINGAPORE, "2026-08-28", "Yajur Upakarma"],
    [SINGAPORE, "2026-12-17", "Margazhi Thingal"],
    [SINGAPORE, "2027-01-15", "Vanga Kadal"],
  ];
  for (const [place, date, name] of expected) {
    assert.ok(observances(place, date).includes(name), `${name} on ${date} in ${place.timeZone}: ${day(place, date).festival}`);
  }
});

test("sankrantis are listed with their time, and their punyakalam on the right day", () => {
  assert.match(day(CHENNAI, "2026-10-18").festival, /Thula Ravi 06:2\d, Punyakalam/);
  // After midnight: listed on the Hindu day, punyakalam the next morning.
  assert.match(day(CHENNAI, "2026-11-16").festival, /Vruschika Ravi 04:0\d \(\+1\)/);
  assert.ok(observances(CHENNAI, "2026-11-17").includes("Vruschika Masa Punyakalam"));
});

test("Ekadasi follows the Vaishnava rules, and Paranai waits out Hari Vasara", () => {
  // Dvadasi holds two sunrises after the 23 Aug Ekadasi: the fast moves to the 24th.
  assert.ok(!observances(CHENNAI, "2026-08-23").includes("Ekadasi Vratam"));
  assert.ok(observances(CHENNAI, "2026-08-24").includes("Ekadasi Vratam"));
  // Published: "Alpa Dvadasi Paranai 05:59-06:42" and "Dvadasi Paranai after 08:47".
  assert.match(day(CHENNAI, "2026-08-10").festival, /Alpa Dvadasi Paranai 05:59-06:4\d/);
  assert.match(day(CHENNAI, "2026-11-21").festival, /Dvadasi Paranai after 08:4\d/);
  assert.equal(day(CHENNAI, "2026-10-08").upcomingEkadashiText, "Next Ekadasi: Thursday, 22nd Oct 2026.");
  assert.equal(day(CHENNAI, "2026-10-22").upcomingEkadashiText, "Next Ekadasi: Thursday, 22nd Oct 2026.");
});

test("every observance over a year, anywhere, is in the closed vocabulary", () => {
  for (const place of [CHENNAI, LONDON]) {
    const start = dayNumberOf(2026, 1, 1);
    for (let offset = 0; offset < 366; offset += 1) {
      const p = computePanchangam(start + offset, place, { placeName: "x" });
      for (const name of p.festival.split(", ").filter(Boolean)) {
        if (/^(Alpa )?Dvadasi Paranai /.test(name) || / Ravi \d\d:\d\d/.test(name)) continue;
        assert.ok(FESTIVAL_NAMES.includes(name), `unexpected festival "${name}"`);
      }
    }
  }
});

test("every tithi and nakshatram name localizes", () => {
  for (let i = 0; i < 30; i += 1) assert.notEqual(tithiLabel(tithiName(i), "ta"), tithiName(i));
  for (const name of NAKSHATRA_NAMES) assert.notEqual(nakshatramLabel(name, "ta"), name);
});

test("the Sankalpam names the moment, the place and how long it holds", () => {
  // Published: "...At 10:00 AM IST and valid through 10:31:24 PM: parAbhava nAma saMvathsare..."
  const p = day(CHENNAI, "2026-10-08", Date.UTC(2026, 9, 8, 4, 30));
  assert.match(
    p.sankalpamText,
    /^Sankalpam for Chennai on 8th Oct 2026 At 10:00 AM IST and valid through 10:3[0-3]:\d\d PM: Parābhava nāma saṁvatsare, dakṣiṇāyane, varṣa ṛtau, kanyā māse, kṛṣṇa pakṣe, trayodaśyām śubha tithau, guru vāsara yuktāyām, pūrvaphalgunī nakṣatra yuktāyām, /
  );
  assert.match(localizeSankalpamText(p.sankalpamText, "ta"), /^Chennai க்கான சங்கல்பம் — 8th Oct 2026, 10:00 AM IST முதல் 10:/);
});

test("the Sankalpam reads on the reader's own clock outside India", () => {
  const p = computePanchangam(dayNumberOf(2026, 7, 4), NEW_YORK, {
    placeName: "New York",
    sankalpamAt: Date.UTC(2026, 6, 4, 14, 0),
  });
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
