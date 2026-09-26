import test from "node:test";
import assert from "node:assert/strict";
import {
  PADUKA_PANCHANGAM_ISSUES,
  isKnownPadukaObservance,
  localizePadukaFestival,
  localizePadukaTarpanam,
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

const LANGUAGES = ["ta", "kn", "hi", "te"] as const;
/** Each language's own Unicode block, so "translated" means actually written in that script. */
const SCRIPT: Record<(typeof LANGUAGES)[number], RegExp> = {
  ta: /[\u0B80-\u0BFF]/,
  kn: /[\u0C80-\u0CFF]/,
  hi: /[\u0900-\u097F]/,
  te: /[\u0C00-\u0C7F]/,
};

test("every observance name has a translation in all four languages", () => {
  for (const issue of PADUKA_PANCHANGAM_ISSUES) {
    for (const day of issue.days) {
      if (!day.festival) continue;
      for (const name of day.festival.split(", ")) {
        assert.ok(isKnownPadukaObservance(name), `${day.date}: no translations for "${name}"`);
      }
      for (const lang of LANGUAGES) {
        const localized = localizePadukaFestival(day.festival, lang);
        assert.ok(!/[A-Za-z]/.test(localized) && SCRIPT[lang].test(localized), `${day.date} ${lang}: ${localized}`);
      }
    }
  }
});

test("localizePadukaFestival leaves English untouched", () => {
  assert.equal(localizePadukaFestival("Vijaya Dasami, Bhudattazhvar Tirunakshatram", null), "Vijaya Dasami, Bhudattazhvar Tirunakshatram");
  assert.equal(localizePadukaFestival("Vijaya Dasami, Bhudattazhvar Tirunakshatram", "ta"), "விஜய தசமி, பூதத்தாழ்வார் திருநக்ஷத்திரம்");
});

test("every tarpana sankalpam is written in each language's own script", () => {
  for (const issue of PADUKA_PANCHANGAM_ISSUES) {
    for (const tarpanam of issue.tarpanams) {
      assert.equal(localizePadukaTarpanam(tarpanam, null), `${tarpanam.title}: ${tarpanam.sankalpam}`);
      for (const lang of LANGUAGES) {
        const text = localizePadukaTarpanam(tarpanam, lang);
        assert.ok(!/[A-Za-z]/.test(text) && SCRIPT[lang].test(text), `${tarpanam.date} ${lang}: ${text}`);
      }
    }
  }
});
