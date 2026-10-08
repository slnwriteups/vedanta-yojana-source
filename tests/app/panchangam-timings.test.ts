import test from "node:test";
import assert from "node:assert/strict";
import { formatPanchangamTime } from "../../lib/panchangam-timings.ts";

test("formats 24-hour ranges and single times in the reader's locale", () => {
  assert.equal(formatPanchangamTime("12:08-13:37", "en-US"), "12:08 PM – 1:37 PM");
  assert.equal(formatPanchangamTime("06:12", "en-US"), "6:12 AM");
});

test("anything not in HH:MM shape is shown exactly as received", () => {
  assert.equal(formatPanchangamTime("", "en-US"), "");
  assert.equal(formatPanchangamTime("around noon", "en-US"), "around noon");
  assert.equal(formatPanchangamTime("25:00-26:00", "en-US"), "25:00-26:00");
});
