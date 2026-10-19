import test from "node:test";
import assert from "node:assert/strict";

import { searchPlaces, normalizePlaceText, timeZoneAt } from "../../content-lib/panchangam-places.ts";
import { calendarDay, isChosenPlace, placeLabel, todayIn } from "../../content-lib/panchangam-place.ts";
import { PLACE_ROWS, PLACE_TIME_ZONES } from "../../content-lib/panchangam-places-data.ts";
import { computePanchangamForDate, timeZoneLabel } from "../../content-lib/panchangam-engine.ts";

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

test("today is the chosen city's date, which can differ from the device's", () => {
  // 01:51 UTC on 11 Oct 2026: already the 11th in India, still the 10th in New York.
  const now = new Date(Date.UTC(2026, 9, 11, 1, 51));
  const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  assert.deepEqual(ymd(todayIn("Asia/Kolkata", now)), [2026, 10, 11]);
  assert.deepEqual(ymd(todayIn("America/New_York", now)), [2026, 10, 10]);
  assert.deepEqual(ymd(todayIn("Pacific/Kiritimati", now)), [2026, 10, 11]);
  // A calendar day is noon, so a 24-hour day arrow lands on the next date even across a DST change.
  const day = calendarDay(2026, 2, 7);
  assert.equal(new Date(day.getTime() + 24 * 3600 * 1000).getDate(), 8);
});

test("the times' zone is named even where the phone has no abbreviation for it", () => {
  const ms = Date.UTC(2026, 9, 15, 6, 0);
  assert.equal(timeZoneLabel(ms, "Asia/Kolkata"), "IST");
  assert.equal(timeZoneLabel(ms, "Asia/Singapore"), "GMT+8");
  assert.equal(timeZoneLabel(ms, "Asia/Kathmandu"), "GMT+5:45");
  assert.equal(timeZoneLabel(ms, "Atlantic/Reykjavik"), "GMT");
  assert.equal(timeZoneLabel(ms, "America/New_York"), "EDT");
});

test("the time zone at a location fix: the device's own unless no place near it keeps that clock", () => {
  // At home, the device's own zone (an alias of it too).
  assert.equal(timeZoneAt(12.97, 77.59, "Asia/Kolkata"), "Asia/Kolkata");
  assert.equal(timeZoneAt(12.97, 77.59, "Asia/Calcutta"), "Asia/Calcutta");
  // Either side of the India-Nepal border, whose clocks differ by 15 minutes.
  assert.equal(timeZoneAt(27.01, 84.88, "Asia/Kathmandu"), "Asia/Kathmandu"); // Birgunj
  assert.equal(timeZoneAt(26.98, 84.85, "Asia/Kolkata"), "Asia/Kolkata"); // Raxaul
  // A traveller whose phone is still on home time.
  assert.equal(timeZoneAt(12.97, 77.59, "America/New_York"), "Asia/Kolkata");
  assert.equal(timeZoneAt(40.71, -74.0, "Asia/Kolkata"), "America/New_York");
  // Nowhere near a place: the device's zone.
  assert.equal(timeZoneAt(35, -40, "Europe/London"), "Europe/London");
});
