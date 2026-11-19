import test from "node:test";
import assert from "node:assert/strict";
import { daysSinceEpoch, isKaisikaEkadasi, isKaisikaSpotlightDay, msUntilNextLocalMidnight, pickSpotlightForDay, pickSpotlightRecord, seededShuffle } from "../../content-lib/divya-desam-spotlight.ts";

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

test("msUntilNextLocalMidnight: counts down to the next local calendar day", () => {
  assert.equal(msUntilNextLocalMidnight(new Date(2026, 10, 10, 23, 59, 0)), 60_000);
  assert.equal(msUntilNextLocalMidnight(new Date(2026, 10, 10, 0, 0, 0)), new Date(2026, 10, 11).getTime() - new Date(2026, 10, 10).getTime());
});

test("msUntilNextLocalMidnight: waking after it fires lands on a new spotlight day", () => {
  const now = new Date(2026, 10, 10, 18, 30);
  const wake = new Date(now.getTime() + msUntilNextLocalMidnight(now));
  assert.equal(daysSinceEpoch(wake), daysSinceEpoch(now) + 1);
});

test("isKaisikaEkadasi: true on the Ashramam's published Kaisika Ekadasi (20 Nov 2026), false the day before and after", () => {
  assert.equal(isKaisikaEkadasi(new Date(2026, 10, 20)), true);
  assert.equal(isKaisikaEkadasi(new Date(2026, 10, 19)), false);
  assert.equal(isKaisikaEkadasi(new Date(2026, 10, 21)), false);
});

test("isKaisikaEkadasi: falls back to the calendar engine for a year the journal does not cover", () => {
  assert.equal(isKaisikaEkadasi(new Date(2027, 11, 9)), true);
  assert.equal(isKaisikaEkadasi(new Date(2027, 11, 8)), false);
});

test("pickSpotlightForDay: Tirukurungudi on Kaisika Ekadasi and the Dvadasi after it, the normal rotation on other days", () => {
  const entries = ["tirumala", "tirukurungudi", "srirangam", "kanchi"].map((slug) => ({ slug }));
  const slugOf = (e: { slug: string }) => e.slug;
  for (let i = 0; i < 3; i++) assert.equal(pickSpotlightForDay(entries, new Date(2026, 10, 20, 6 + i * 6), slugOf)?.slug, "tirukurungudi");
  assert.equal(pickSpotlightForDay(entries, new Date(2026, 10, 21), slugOf)?.slug, "tirukurungudi");
  assert.equal(isKaisikaSpotlightDay(new Date(2026, 10, 19)), false);
  assert.equal(isKaisikaSpotlightDay(new Date(2026, 10, 22)), false);
  const ordinary = new Date(2026, 10, 25);
  assert.equal(pickSpotlightForDay(entries, ordinary, slugOf), pickSpotlightRecord(entries, ordinary));
});

test("pickSpotlightForDay: when the rotation lands on Tirukurungudi the day before Kaisika Ekadasi, that day shows the temple tomorrow's Kaisika spotlight displaces", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { sourcePageNumber } = await import("../../content-lib/ordering.ts");
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "../../content/divya-desams");
  const records = fs.readdirSync(dir).filter((f: string) => f.endsWith(".json"))
    .map((f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .sort((a: any, b: any) => sourcePageNumber(a.migration.sourcePageId) - sourcePageNumber(b.migration.sourcePageId));
  const slugOf = (r: { slug: string }) => r.slug;
  const eve = new Date(2026, 10, 19, 9);
  assert.equal(pickSpotlightRecord(records, eve)?.slug, "tirukurungudi", "the plain rotation lands on Tirukurungudi on 19 Nov 2026");
  assert.equal(pickSpotlightForDay(records, eve, slugOf)?.slug, pickSpotlightRecord(records, new Date(2026, 10, 20, 9))?.slug);
  assert.notEqual(pickSpotlightForDay(records, eve, slugOf)?.slug, "tirukurungudi");
  assert.equal(pickSpotlightForDay(records, new Date(2026, 10, 20, 9), slugOf)?.slug, "tirukurungudi");
  assert.equal(pickSpotlightForDay(records, new Date(2026, 10, 21, 9), slugOf)?.slug, "tirukurungudi");
});
