import test from "node:test";
import assert from "node:assert/strict";
import { dayNumberOf, NAKSHATRA_NAMES, RASI_NAMES, type PanchangamPlace } from "../../content-lib/panchangam-engine.ts";
import { grahanamOnDay, grahanamsBetween } from "../../content-lib/panchangam-eclipses.ts";

const SRIRANGAM: PanchangamPlace = { latitude: 10.8625, longitude: 78.6896, timeZone: "Asia/Kolkata" };
const NEW_YORK: PanchangamPlace = { latitude: 40.71, longitude: -74.01, timeZone: "America/New_York" };

/** Minutes between a computed instant and a printed IST clock time on a given date. */
function minutesFrom(ms: number, iso: string): number {
  return Math.abs(ms - Date.parse(`${iso}+05:30`)) / 60_000;
}

test("3 March 2026 lunar eclipse matches the Pādukā's Srirangam times", () => {
  const g = grahanamOnDay(SRIRANGAM, dayNumberOf(2026, 3, 3));
  assert.ok(g, "listed on 3 March");
  assert.equal(g.body, "lunar");
  assert.equal(g.kind, "total");
  // Pādukā Feb 2026, printed p. 20: sparśam 3:20, madhyam 5:05, mokṣam 6:47 PM.
  assert.ok(minutesFrom(g.sparsam, "2026-03-03T15:20") <= 3);
  assert.ok(minutesFrom(g.madhyam, "2026-03-03T17:05") <= 3);
  assert.ok(minutesFrom(g.moksham, "2026-03-03T18:47") <= 3);
  // Already underway at moonrise (about 6:24 PM): only its end is seen.
  assert.equal(g.underwayAtRise, true);
  assert.equal(g.peakVisible, false);
  assert.ok(g.visibleFrom > Date.parse("2026-03-03T18:15+05:30") && g.visibleFrom < Date.parse("2026-03-03T18:35+05:30"));
  assert.equal(g.visibleTo, g.moksham);
  // Pādukā p. 22 names Pūrva Phalgunī in the saṅkalpam.
  assert.equal(NAKSHATRA_NAMES[g.nakshatra], "Purva Phalguni");
  assert.equal(RASI_NAMES[g.rasi], "Simha");
});

test("7–8 September 2025 lunar eclipse matches the Pādukā and crosses midnight", () => {
  const g = grahanamOnDay(SRIRANGAM, dayNumberOf(2025, 9, 7));
  assert.ok(g);
  assert.equal(g.kind, "total");
  // Pādukā Aug 2025, printed p. 11: 9:57 PM, total 11:01, max 11:43, total ends 12:23, mokṣam 1:26 AM.
  assert.ok(minutesFrom(g.sparsam, "2025-09-07T21:57") <= 3);
  assert.ok(minutesFrom(g.totalBegin!, "2025-09-07T23:01") <= 3);
  assert.ok(minutesFrom(g.madhyam, "2025-09-07T23:43") <= 3);
  assert.ok(minutesFrom(g.totalEnd!, "2025-09-08T00:23") <= 3);
  assert.ok(minutesFrom(g.moksham, "2025-09-08T01:26") <= 3);
  assert.equal(g.labels.moksham.endsWith("(+1)"), true);
  assert.equal(g.underwayAtRise, false);
  assert.equal(g.peakVisible, true);
  // Listed once, on the 7th.
  assert.equal(grahanamOnDay(SRIRANGAM, dayNumberOf(2025, 9, 8)), null);
});

test("an eclipse that can't be seen from the place is not listed", () => {
  // The 7–8 Sep 2025 eclipse happened in New York's daytime, Moon below the horizon.
  const list = grahanamsBetween(NEW_YORK, dayNumberOf(2025, 9, 6), dayNumberOf(2025, 9, 9));
  assert.equal(list.length, 0);
});

test("a solar eclipse keeps its global kind apart from what the place sees", () => {
  // 12 Aug 2026: total in Spain, partial in London.
  const LONDON: PanchangamPlace = { latitude: 51.5, longitude: -0.13, timeZone: "Europe/London" };
  const g = grahanamOnDay(LONDON, dayNumberOf(2026, 8, 12));
  assert.ok(g);
  assert.equal(g.body, "solar");
  assert.equal(g.globalKind, "total");
  assert.equal(g.kind, "partial");
});
