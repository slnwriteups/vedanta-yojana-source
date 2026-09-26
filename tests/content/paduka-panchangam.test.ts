import test from "node:test";
import assert from "node:assert/strict";
import {
  PADUKA_PANCHANGAM_ISSUES,
  padukaDateKey,
  padukaPanchangamFor,
} from "../../content-lib/paduka-panchangam.ts";

test("padukaPanchangamFor returns the journal's day entry for a covered date", () => {
  const entry = padukaPanchangamFor(new Date(2026, 8, 22));
  assert.ok(entry?.day);
  assert.equal(entry.samvatsara, "Parābhava");
  assert.equal(entry.day.tamilMonth, "Puraṭṭāsi");
  assert.equal(entry.day.tamilDay, 5);
  assert.match(entry.day.details, /Svāmī Deśikan Tirunakṣatram/);
  assert.equal(entry.tarpanam, null);
});

test("padukaPanchangamFor returns both the day and its tarpanam when a date has both", () => {
  const entry = padukaPanchangamFor(new Date(2026, 9, 10));
  assert.ok(entry?.day && entry.tarpanam);
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

test("every issue lists consecutive dates with consecutive Tamil days, and no mangled PDF glyphs", () => {
  for (const issue of PADUKA_PANCHANGAM_ISSUES) {
    for (let i = 1; i < issue.days.length; i++) {
      const prev = issue.days[i - 1];
      const cur = issue.days[i];
      const [y, m, d] = prev.date.split("-").map(Number);
      assert.equal(cur.date, padukaDateKey(new Date(y, m - 1, d + 1)), `gap after ${prev.date}`);
      if (cur.tamilMonth === prev.tamilMonth) assert.equal(cur.tamilDay, prev.tamilDay + 1, cur.date);
      else assert.equal(cur.tamilDay, 1, cur.date);
    }
    for (const text of [...issue.days.map((d) => d.details), ...issue.tarpanams.map((t) => t.sankalpam)]) {
      assert.ok(!/ġ|Tiruvṇam/.test(text), text);
    }
  }
});
