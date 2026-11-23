import test from "node:test";
import assert from "node:assert/strict";
import { dayNumberOf } from "../../content-lib/panchangam-engine.ts";
import {
  GRAHANAM_REMINDER_HOUR,
  GRAHANAM_REMINDER_ID_PREFIX,
  grahanamReminderChannelName,
  planGrahanamReminders,
} from "../services/grahanamReminderCore.ts";

const BENGALURU = { latitude: 12.97, longitude: 77.59, timeZone: "Asia/Kolkata" };
const IST_MINUTES = 330;

function ist(year: number, month: number, day: number, hour: number): number {
  return Date.UTC(year, month - 1, day, hour) - IST_MINUTES * 60_000;
}

test("a visible eclipse is reminded at 10 AM the day before, with the owner's guidance", () => {
  assert.equal(GRAHANAM_REMINDER_HOUR, 10);
  const [first] = planGrahanamReminders(BENGALURU, ist(2026, 2, 1, 12), null);
  // 3 Mar 2026 total lunar eclipse: reminded on 2 Mar at 10 AM IST.
  assert.equal(first.fireAt, ist(2026, 3, 2, 10));
  assert.equal(first.id, `${GRAHANAM_REMINDER_ID_PREFIX}${dayNumberOf(2026, 3, 3)}`);
  assert.equal(first.title, "Grahaṇam tomorrow");
  assert.match(first.body, /^Lunar eclipse, visible here 6:2\d PM – 6:47 PM\./);
  assert.match(first.body, /Vishnu Sahasranamam/);
  assert.match(first.body, /darbha grass in the fridge/);
});

test("penumbral eclipses get no reminder; past reminder times are skipped", () => {
  // 21 Feb 2027 is penumbral only; the next reminded one in Bengaluru is the 2 Aug 2027 solar eclipse.
  const reminders = planGrahanamReminders(BENGALURU, ist(2027, 1, 1, 12), null);
  assert.equal(reminders[0].fireAt, ist(2027, 8, 1, 10));
  assert.match(reminders[0].body, /^Solar eclipse/);
  // After 10 AM on 2 Mar 2026, that eclipse's reminder has passed.
  const after = planGrahanamReminders(BENGALURU, ist(2026, 3, 2, 11), null);
  assert.ok(after.every((r) => r.id !== `${GRAHANAM_REMINDER_ID_PREFIX}${dayNumberOf(2026, 3, 3)}`));
});

test("reminders are written in the reader's language", () => {
  const [first] = planGrahanamReminders(BENGALURU, ist(2026, 2, 1, 12), "ta");
  assert.equal(first.title, "நாளை கிரகணம்");
  assert.match(first.body, /^சந்திர கிரகணம்/);
  for (const language of ["ta", "kn", "hi", "te"] as const) {
    assert.notEqual(grahanamReminderChannelName(language), grahanamReminderChannelName(null));
  }
});
