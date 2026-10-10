import test from "node:test";
import assert from "node:assert/strict";

import { searchPlaces, normalizePlaceText } from "../../content-lib/panchangam-places.ts";
import { isChosenPlace, placeLabel } from "../../content-lib/panchangam-place.ts";
import { PLACE_ROWS, PLACE_TIME_ZONES } from "../../content-lib/panchangam-places-data.ts";
import { computePanchangamForDate } from "../../content-lib/panchangam-engine.ts";

function first(query: string) {
  const [place] = searchPlaces(query, 1);
  assert.ok(place, `no place for "${query}"`);
  return place;
}

test("every bundled place is usable: coordinates in range and a time zone the device knows", () => {
  const rows = PLACE_ROWS.split("\n");
  assert.ok(rows.length > 15000, `${rows.length} places`);
  for (const zone of PLACE_TIME_ZONES) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en-US", { timeZone: zone }), zone);
  }
  for (const row of rows) {
    const [name, , , , latitude, longitude, zone] = row.split("|");
    assert.ok(name, row);
    assert.ok(Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180, row);
    assert.ok(PLACE_TIME_ZONES[Number(zone)], row);
  }
});

test("a reader finds their city by today's name, a former name, or without diacritics", () => {
  assert.equal(placeLabel(first("Bengaluru")), "Bengaluru, Karnataka, India");
  assert.equal(first("Bangalore").name, "Bengaluru");
  assert.equal(first("Madras").name, "Chennai");
  assert.equal(first("Trichy").name, "Tiruchirappalli");
  assert.equal(first("Bombay").name, "Mumbai");
  assert.equal(normalizePlaceText(first("Sriperumbudur").name), "sriperumbudur");
});

test("Sri Vaishnava pilgrimage towns too small for the city lists can still be chosen", () => {
  for (const [query, region] of [
    ["Srirangam", "Tamil Nadu"],
    ["Melkote", "Karnataka"],
    ["Ahobilam", "Andhra Pradesh"],
    ["Thirukoshtiyur", "Tamil Nadu"],
  ]) {
    const place = first(query);
    assert.equal(place.region, region, query);
    assert.equal(place.timeZone, "Asia/Kolkata", query);
  }
});

test("Indian places come first among equally good matches; a region after a comma narrows abroad", () => {
  assert.equal(first("chen").name, "Chennai");
  const springfield = first("Springfield, Illinois");
  assert.equal(springfield.region, "Illinois");
  assert.equal(springfield.timeZone, "America/Chicago");
  assert.equal(first("Edison").region, "New Jersey");
  assert.equal(first("Singapore").timeZone, "Asia/Singapore");
  assert.deepEqual(searchPlaces("x"), []);
  assert.deepEqual(searchPlaces("zzqqxx"), []);
});

test("a saved choice is only restored when it is a real place", () => {
  assert.ok(isChosenPlace(first("Chennai")));
  assert.equal(isChosenPlace(null), false);
  assert.equal(isChosenPlace({ name: "Chennai" }), false);
  assert.equal(isChosenPlace({ ...first("Chennai"), latitude: 123 }), false);
  assert.equal(isChosenPlace({ ...first("Chennai"), timeZone: "Not/AZone" }), false);
});

test("choosing Chennai gives the traditional calendar's Chennai day, on Chennai's clock", () => {
  // Published for Chennai, 8 Oct 2026: k.trayodasi, p.phalguni, Sunrise 06:02, Sunset 17:51.
  const chennai = first("Chennai");
  // 8 Oct 2026, 10:00 in London: still 8 Oct in Chennai, so the same day.
  const p = computePanchangamForDate(
    new Date(Date.UTC(2026, 9, 8, 9, 0)),
    { latitude: chennai.latitude, longitude: chennai.longitude, timeZone: chennai.timeZone },
    chennai.name,
    new Date(Date.UTC(2026, 9, 8, 9, 0))
  );
  assert.equal(p.tithi, "Trayodasi");
  assert.equal(p.nakshatram, "Purva Phalguni");
  assert.ok(["06:01", "06:02"].includes(p.sunrise), p.sunrise);
  assert.ok(["17:50", "17:51"].includes(p.sunset), p.sunset);
  assert.match(p.sankalpamText, /Chennai/);
});
