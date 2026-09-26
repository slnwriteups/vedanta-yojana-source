import test from "node:test";
import assert from "node:assert/strict";
import {
  PADUKA_PANCHANGAM_ISSUES,
  padukaDateKey,
  padukaPanchangamFor,
} from "../../content-lib/paduka-panchangam.ts";
import { nakshatramLabel, pakshaLabel, tithiLabel } from "../../lib/panchangam-labels.ts";

test("padukaPanchangamFor returns the day's tithi, nakshatram and observances for a covered date", () => {
  const entry = padukaPanchangamFor(new Date(2026, 8, 22));
  assert.ok(entry?.day);
  assert.equal(entry.day.paksha, "Shukla Paksha");
  assert.equal(entry.day.tithi, "Ekadasi");
  assert.equal(entry.day.nakshatram, "Uttara Ashadha");
  assert.match(entry.day.festival, /Svami Desikan Tirunakshatram/);
  assert.equal(entry.tarpanam, null);
});

test("padukaPanchangamFor returns both the day and its tarpanam when a date has both", () => {
  const entry = padukaPanchangamFor(new Date(2026, 9, 10));
  assert.ok(entry?.day && entry.tarpanam);
  assert.equal(entry.day.tithi, "Amavasya");
  assert.match(entry.tarpanam.sankalpam, /amāvāsyāyām/);
});

test("padukaPanchangamFor returns a tarpanam-only entry for the day before the table starts", () => {
  const entry = padukaPanchangamFor(new Date(2026, 8, 17));
  assert.ok(entry);
  assert.equal(entry.day, null);
  assert.match(entry.tarpanam?.title ?? "", /Puraṭṭāsi māsa praveśa/);
});

test("padukaPanchangamFor returns null for dates no transcribed issue covers", () => {
  assert.equal(padukaPanchangamFor(new Date(2026, 8, 16)), null);
  assert.equal(padukaPanchangamFor(new Date(2026, 9, 25)), null);
});

test("every day uses the Ahobila calendar's own paksha/tithi/nakshatram vocabulary, so it localizes identically", () => {
  for (const issue of PADUKA_PANCHANGAM_ISSUES) {
    for (const day of issue.days) {
      assert.notEqual(pakshaLabel(day.paksha, "ta"), day.paksha, `${day.date} paksha ${day.paksha}`);
      assert.notEqual(tithiLabel(day.tithi, "ta"), day.tithi, `${day.date} tithi ${day.tithi}`);
      assert.notEqual(nakshatramLabel(day.nakshatram, "ta"), day.nakshatram, `${day.date} nakshatram ${day.nakshatram}`);
    }
  }
});

test("every issue lists consecutive dates, with paksha turning only after Pournami/Amavasya", () => {
  for (const issue of PADUKA_PANCHANGAM_ISSUES) {
    for (let i = 1; i < issue.days.length; i++) {
      const prev = issue.days[i - 1];
      const cur = issue.days[i];
      const [y, m, d] = prev.date.split("-").map(Number);
      assert.equal(cur.date, padukaDateKey(new Date(y, m - 1, d + 1)), `gap after ${prev.date}`);
      const turns = prev.tithi === "Pournami" || prev.tithi === "Amavasya";
      assert.equal(cur.paksha !== prev.paksha, turns, cur.date);
    }
  }
});
