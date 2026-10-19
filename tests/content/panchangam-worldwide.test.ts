import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePlace, distribution, type PlaceResult } from "../../scripts/panchangam-validation.ts";

/**
 * The engine against Sri Ahobila Mutt's published calendar for 18 places
 * (tests/content/fixtures/ahobila-worldwide-2026-27.json; see
 * docs/PANCHANGAM-VALIDATION.md). Transition instants are compared in UTC,
 * observances by the day or minute they decide. Every disagreement and
 * every difference over 5 minutes the fixture holds is listed below with
 * its explanation; any other fails, and so does one that goes away.
 */

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/ahobila-worldwide-2026-27.json", import.meta.url), "utf8")
) as { places: Parameters<typeof validatePlace>[0][] };
const results: PlaceResult[] = fixture.places.map(validatePlace);

const RANGE_START =
  "The Mutt's data begins on 15 Mar 2026: its decision for that day can't see 14 Mar, so its Ekadasi and Paranai there differ.";
const NEAR_SUNRISE = "A transition within a few minutes of sunrise, inside the engine's agreement with the Mutt's times.";

/** Day-level disagreements, keyed "place date what". */
const EXPLAINED: Record<string, string> = {
  "Bengaluru 2027-01-10 tithi at sunrise": `${NEAR_SUNRISE} (0 min)`,
  "Kathmandu 2026-03-17 nakshatram at sunrise": `${NEAR_SUNRISE} (1 min)`,
  "Tokyo 2026-11-21 tithi at sunrise": `${NEAR_SUNRISE} (3 min)`,
  "Tromso 2026-07-11 Ekadasi day": `${NEAR_SUNRISE} Dasami ends a minute after the midnight-sun "sunrise", 00:49.`,
  "Tromso 2026-07-11 Paranai day": "Follows from the Ekadasi day.",
  "Tromso 2026-07-12 Paranai day": "Follows from the Ekadasi day.",
  "Auckland 2026-09-23 Paranai day":
    "Sravana Dvadasi: the Mutt keeps \"Sravana Dvadasi Vratam\" without a Paranai where Sravanam runs 24-48 nazhigai past sunrise, and a Paranai at 20-52 (Sydney); one case, its rule not established.",
  "Chennai 2026-03-15 Ekadasi day": RANGE_START,
  "Chennai 2026-03-16 Paranai day": RANGE_START,
  "Tokyo 2026-03-15 Ekadasi day": RANGE_START,
  "Tokyo 2026-03-16 Paranai day": RANGE_START,
  "London 2026-03-15 Paranai day": RANGE_START,
  "London 2026-03-16 Paranai day": RANGE_START,
  "New York 2026-03-15 Paranai day": RANGE_START,
  "Los Angeles 2026-03-15 Paranai day": RANGE_START,
  "Sydney 2026-03-15 Ekadasi day": RANGE_START,
  "Sydney 2026-03-16 Paranai day": RANGE_START,
};

/** Differences over 5 minutes, keyed "place date": each an artefact of the published calendar. */
const EXPLAINED_OUTLIERS: Record<string, string> = {
  "New York 2027-03-14":
    "US daylight saving begins: the Mutt's karana ends that day are an hour from its own tithi midpoints (wall-clock arithmetic across the change).",
  "Los Angeles 2027-03-14": "As New York.",
  "Anchorage 2027-03-14": "As New York.",
  "Tromso 2026-05-28":
    "Midnight sun: the Mutt prints a zero-length Paranai (00:41-00:41) though its own day is all daylight (sunset 60-0 nazhigai).",
  "Tromso 2026-06-12": "As 28 May.",
};

test("the matrix covers every place, each with every chosen date", () => {
  assert.equal(results.length, 18);
  for (const r of results) assert.ok(r.days >= 109, `${r.place.name}: ${r.days} days`);
});

test("sunrise and sunset agree within a minute at every place", () => {
  for (const r of results) {
    assert.ok(distribution(r.sunrise).max <= 1, `${r.place.name} sunrise ${distribution(r.sunrise).max}`);
    assert.ok(distribution(r.sunset).max <= 1, `${r.place.name} sunset ${distribution(r.sunset).max}`);
  }
});

test("every tithi, nakshatram, karana, Paranai and sankramanam is the same element, within 5 minutes", () => {
  for (const r of results) {
    assert.equal(r.unmatched, 0, `${r.place.name}: ${r.unmatched} published ends name another element`);
    for (const [name, values] of [["tithi", r.tithi], ["nakshatram", r.nakshatram]] as const) {
      assert.ok(distribution(values).max <= 5, `${r.place.name} ${name}: ${distribution(values).max} min`);
    }
    assert.ok(distribution(r.sankranti).max <= 2, `${r.place.name} sankramanam ${distribution(r.sankranti).max}`);
  }
  const outliers = results.flatMap((r) => r.outliers.map((o) => `${o.place} ${o.date}`));
  for (const key of outliers) assert.ok(key in EXPLAINED_OUTLIERS, `unexplained difference over 5 min: ${key}`);
  for (const key of Object.keys(EXPLAINED_OUTLIERS)) assert.ok(outliers.includes(key), `no longer differs, remove: ${key}`);
});

test("polar days: the engine shows no sunrise where the Mutt prints the Sun's transit", () => {
  const tromso = results.find((r) => r.place.name === "Tromso")!;
  assert.ok(tromso.noSunrise >= 25, `${tromso.noSunrise}`);
  for (const r of results.filter((x) => x.place.group !== "polar")) assert.equal(r.noSunrise, 0, r.place.name);
});

test("every day-level disagreement is one that is explained", () => {
  const found = results.flatMap((r) => r.mismatches.map((m) => `${m.place} ${m.date} ${m.what}`));
  for (const key of found) assert.ok(key in EXPLAINED, `unexplained: ${key}`);
  for (const key of Object.keys(EXPLAINED)) assert.ok(found.includes(key), `no longer differs, remove: ${key}`);
});
