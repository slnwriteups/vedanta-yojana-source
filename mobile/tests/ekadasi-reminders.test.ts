import test from "node:test";
import assert from "node:assert/strict";
import { dayNumberOf, upcomingEkadasis } from "../../content-lib/panchangam-engine.ts";
import { SUPPORTED_LANGUAGES } from "../content-lib/preferences.ts";
import {
  EKADASI_REMINDER_HOUR,
  EKADASI_REMINDER_ID_PREFIX,
  EKADASI_REMINDER_NAMES,
  ekadasiReminderBody,
  ekadasiReminderChannelName,
  ekadasiReminderTitle,
  planEkadasiReminders,
} from "../services/ekadasiReminderCore.ts";

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

/** Each language's own script (Unicode block), so a reminder left in English or the wrong script is caught. */
const SCRIPTS: Record<string, RegExp> = {
  ta: /[\u0B80-\u0BFF]/,
  kn: /[\u0C80-\u0CFF]/,
  hi: /[\u0900-\u097F]/,
  te: /[\u0C00-\u0C7F]/,
};

test("every app language has a script to check against", () => {
  assert.deepEqual(Object.keys(SCRIPTS).sort(), SUPPORTED_LANGUAGES.map((l) => l.code).sort());
});

test("every Ekadasi the engine keeps over two years has reminder wording", () => {
  const names = new Set(upcomingEkadasis(SRIRANGAM, dayNumberOf(2026, 1, 1), 730).map((e) => e.name));
  for (const name of names) assert.ok(EKADASI_REMINDER_NAMES.includes(name), `no reminder wording for ${name}`);
  // All four names occur, so each is actually exercised below.
  assert.equal(names.size, EKADASI_REMINDER_NAMES.length);
});

// A date in every month and on every weekday, as the engine writes them.
const DATES = [
  "Thursday, 1st Jan 2026", "Sunday, 1st Feb 2026", "Sunday, 1st Mar 2026", "Wednesday, 1st Apr 2026",
  "Friday, 1st May 2026", "Monday, 1st Jun 2026", "Wednesday, 1st Jul 2026", "Saturday, 1st Aug 2026",
  "Tuesday, 1st Sep 2026", "Thursday, 1st Oct 2026", "Sunday, 1st Nov 2026", "Tuesday, 1st Dec 2026",
];

for (const { code, label } of SUPPORTED_LANGUAGES) {
  test(`${label}: every reminder title, body and channel name is in its own script, with no English left`, () => {
    for (const name of EKADASI_REMINDER_NAMES) {
      const title = ekadasiReminderTitle(name, code);
      assert.match(title, SCRIPTS[code], title);
      assert.doesNotMatch(title, /[A-Za-z]/, title);
    }
    for (const date of DATES) {
      const body = ekadasiReminderBody(date, code);
      assert.match(body, SCRIPTS[code], body);
      assert.doesNotMatch(body, /[A-Za-z]/, body);
      assert.match(body, /\b1 .+ 2026$/u, body);
    }
    const channel = ekadasiReminderChannelName(code);
    assert.match(channel, SCRIPTS[code]);
    assert.doesNotMatch(channel, /[A-Za-z]/);
  });

  test(`${label}: the scheduled reminders themselves are computed in it`, () => {
    const reminders = planEkadasiReminders(SRIRANGAM, ist(2026, 10, 24, 12), code);
    assert.ok(reminders.length > 0);
    for (const r of reminders) {
      assert.doesNotMatch(r.title + r.body, /[A-Za-z]/, `${r.title} / ${r.body}`);
      assert.match(r.title, SCRIPTS[code]);
    }
    // Same days and times whatever the language: only the words change.
    const english = planEkadasiReminders(SRIRANGAM, ist(2026, 10, 24, 12), null);
    assert.deepEqual(reminders.map((r) => [r.id, r.fireAt]), english.map((r) => [r.id, r.fireAt]));
  });
}

test("English names each Ekadasi in English", () => {
  for (const name of EKADASI_REMINDER_NAMES) assert.match(ekadasiReminderTitle(name, null), /^Tomorrow is [A-Za-z ]+$/);
  assert.equal(ekadasiReminderChannelName(null), "Ekadasi reminders");
});
