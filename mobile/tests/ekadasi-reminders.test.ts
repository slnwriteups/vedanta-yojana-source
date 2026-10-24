import test from "node:test";
import assert from "node:assert/strict";
import { dayNumberOf } from "../../content-lib/panchangam-engine.ts";
import { EKADASI_REMINDER_HOUR, EKADASI_REMINDER_ID_PREFIX, planEkadasiReminders } from "../services/ekadasiReminderCore.ts";

const SRIRANGAM = { latitude: 10.8624, longitude: 78.6928, timeZone: "Asia/Kolkata" };
const IST_MINUTES = 330;

/** Epoch ms of `hour`:00 IST on the given date. */
function ist(year: number, month: number, day: number, hour: number): number {
  return Date.UTC(year, month - 1, day, hour) - IST_MINUTES * 60_000;
}

test("each reminder fires on the eve of the fast, at the reminder hour on the place's clock", () => {
  const reminders = planEkadasiReminders(SRIRANGAM, ist(2026, 10, 24, 12), null);
  // Krishna Ekadasi on Thursday 5 Nov 2026 (the Pādukā's Sarva Ekadasi): reminded on Wednesday 4 Nov.
  assert.equal(reminders[0].fireAt, ist(2026, 11, 4, EKADASI_REMINDER_HOUR));
  assert.equal(reminders[0].id, `${EKADASI_REMINDER_ID_PREFIX}${dayNumberOf(2026, 11, 5)}`);
  assert.equal(reminders[0].title, "Tomorrow is Ekadasi");
  assert.equal(reminders[0].body, "Fast on Thursday, 5th Nov 2026.");
});

test("a named Ekadasi is reminded under its own name", () => {
  const reminders = planEkadasiReminders(SRIRANGAM, ist(2026, 10, 24, 12), null);
  const kaisika = reminders.find((r) => r.fireAt === ist(2026, 11, 19, EKADASI_REMINDER_HOUR));
  assert.equal(kaisika?.title, "Tomorrow is Kaisika Ekadasi");
});

test("an eve whose reminder hour has passed is skipped, and today's fast has no eve left", () => {
  // 4 Nov after 07:00: the 5 Nov reminder is already past.
  const afterHour = planEkadasiReminders(SRIRANGAM, ist(2026, 11, 4, 9), null);
  assert.ok(afterHour.every((r) => r.fireAt > ist(2026, 11, 4, 9)));
  assert.notEqual(afterHour[0].id, `${EKADASI_REMINDER_ID_PREFIX}${dayNumberOf(2026, 11, 5)}`);
  // 4 Nov before 07:00: still to come.
  const beforeHour = planEkadasiReminders(SRIRANGAM, ist(2026, 11, 4, 5), null);
  assert.equal(beforeHour[0].id, `${EKADASI_REMINDER_ID_PREFIX}${dayNumberOf(2026, 11, 5)}`);
});

test("reminders are written in the reader's language, date included", () => {
  const [first] = planEkadasiReminders(SRIRANGAM, ist(2026, 10, 24, 12), "ta");
  assert.equal(first.title, "நாளை ஏகாதசி");
  assert.equal(first.body, "விரதம்: வியாழன், 5 நவம்பர் 2026");
});

test("about two Ekadasis a month are scheduled ahead", () => {
  const reminders = planEkadasiReminders(SRIRANGAM, ist(2026, 10, 24, 12), null);
  assert.ok(reminders.length >= 7 && reminders.length <= 9, `got ${reminders.length}`);
  assert.equal(new Set(reminders.map((r) => r.id)).size, reminders.length);
});
