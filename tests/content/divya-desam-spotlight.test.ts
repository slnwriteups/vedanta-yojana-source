import test from "node:test";
import assert from "node:assert/strict";
import { daysSinceEpoch, pickSpotlightRecord, seededShuffle } from "../../content-lib/divya-desam-spotlight.ts";

// Constructed via the local-time Date constructor (year, month, day, ...),
// matching daysSinceEpoch()'s own documented semantics ("local device
// date") -- an ISO "Z" string would be reinterpreted through local
// getters and could land on a different calendar day depending on the
// machine's timezone.

test("pickSpotlightRecord: is generic -- works over plain entry objects, not just DivyaDesam", () => {
  const entries = [{ slug: "a" }, { slug: "b" }, { slug: "c" }];
  const picked = pickSpotlightRecord(entries, new Date(2026, 0, 1));
  assert.ok(picked && entries.includes(picked));
});

test("pickSpotlightRecord: returns null for an empty list, never throws", () => {
  assert.equal(pickSpotlightRecord([], new Date()), null);
});

test("pickSpotlightRecord: is a pure function of (list, date) -- same inputs always pick the same entry", () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({ id: i }));
  const date = new Date(2026, 2, 14);
  const first = pickSpotlightRecord(entries, date);
  const second = pickSpotlightRecord(entries, date);
  assert.equal(first, second);
});

test("pickSpotlightRecord: advances to a different entry on the next calendar day (for a list long enough to guarantee it)", () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({ id: i }));
  const day1 = new Date(2026, 2, 14, 12);
  const day2 = new Date(2026, 2, 15, 12);
  assert.notEqual(pickSpotlightRecord(entries, day1), pickSpotlightRecord(entries, day2));
});

test("pickSpotlightRecord: two different times on the same calendar day pick the same entry", () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({ id: i }));
  const morning = new Date(2026, 2, 14, 2);
  const night = new Date(2026, 2, 14, 23);
  assert.equal(pickSpotlightRecord(entries, morning), pickSpotlightRecord(entries, night));
});

test("daysSinceEpoch: advances by exactly 1 for consecutive calendar days", () => {
  const day1 = daysSinceEpoch(new Date(2026, 2, 14, 23, 59));
  const day2 = daysSinceEpoch(new Date(2026, 2, 15, 0, 1));
  assert.equal(day2, day1 + 1);
});

test("seededShuffle: a fixed-length, fixed-seed shuffle is a permutation of [0, length) with no repeats", () => {
  const shuffled = seededShuffle(107, 0x5d1f4a);
  assert.equal(shuffled.length, 107);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), Array.from({ length: 107 }, (_, i) => i));
});
