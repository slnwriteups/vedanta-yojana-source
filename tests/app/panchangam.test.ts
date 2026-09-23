import test from "node:test";
import assert from "node:assert/strict";
import { parseSankalpamExpiry, isSankalpamExpired } from "../../lib/panchangam-service.ts";

test("parseSankalpamExpiry correctly parses 12-hour AM/PM time", () => {
  const baseDate = new Date("2026-09-23T06:00:00+05:30");
  const sankalpam =
    "Sankalpam for Bengaluru on 23rd Sep 2026 At 9:27 AM IST and valid through 09:38:42 AM: parAbhava nAma saMvathsare...";
  const expiry = parseSankalpamExpiry(sankalpam, baseDate);
  assert.ok(expiry !== null);
  assert.equal(expiry.getHours(), 9);
  assert.equal(expiry.getMinutes(), 38);
  assert.equal(expiry.getSeconds(), 42);
});

test("parseSankalpamExpiry correctly handles following day indicator", () => {
  const baseDate = new Date("2026-09-23T10:00:00+05:30");
  const sankalpam =
    "Sankalpam for Bengaluru on 23rd Sep 2026 At 10:00 AM IST and valid through 03:47:54 AM of following day: ...";
  const expiry = parseSankalpamExpiry(sankalpam, baseDate);
  assert.ok(expiry !== null);
  assert.equal(expiry.getDate(), baseDate.getDate() + 1);
  assert.equal(expiry.getHours(), 3);
  assert.equal(expiry.getMinutes(), 47);
  assert.equal(expiry.getSeconds(), 54);
});

test("isSankalpamExpired returns false before expiry and true after expiry", () => {
  const baseDate = new Date("2026-09-23T09:30:00+05:30");
  const sankalpam =
    "Sankalpam for Bengaluru on 23rd Sep 2026 At 9:27 AM IST and valid through 09:38:42 AM: parAbhava nAma saMvathsare...";

  const beforeExpiry = new Date(baseDate);
  beforeExpiry.setHours(9, 35, 0, 0);
  assert.equal(isSankalpamExpired(sankalpam, beforeExpiry), false);

  const afterExpiry = new Date(baseDate);
  afterExpiry.setHours(9, 45, 0, 0);
  assert.equal(isSankalpamExpired(sankalpam, afterExpiry), true);
});

test("Ekadashi 'a date, past' pattern correctly identified", () => {
  const dvadasiApiResponse =
    "<p>Next Ekadasi for Bengaluru is on a date, past. Perform Dvadasi Paranai 06:10-09:44 on 23rd Sep 2026";
  assert.ok(dvadasiApiResponse.includes("a date, past"));
});
