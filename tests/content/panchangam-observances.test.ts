import test from "node:test";
import assert from "node:assert/strict";
import { computePanchangam, dayNumberOf, type PanchangamPlace } from "../../content-lib/panchangam-engine.ts";
import { PADUKA_PANCHANGAM_ISSUES, padukaPanchangamFor } from "../../content-lib/paduka-panchangam.ts";
import {
  dayObservances,
  isClassifiedPadukaObservance,
  observanceLine,
  type Observance,
} from "../../content-lib/panchangam-observances.ts";

const SRIRANGAM: PanchangamPlace = { latitude: 10.8625, longitude: 78.6896, timeZone: "Asia/Kolkata" };
const NEW_YORK: PanchangamPlace = { latitude: 40.71, longitude: -74.0, timeZone: "America/New_York" };

/** The day's observances as the calendar shows them at `place`: "name [P]" published, "[C]" calculated, "[PC]" both. */
function shown(place: PanchangamPlace, iso: string): string[] {
  const [y, m, d] = iso.split("-").map(Number);
  const p = computePanchangam(dayNumberOf(y, m, d), place, { placeName: "x" });
  const paduka = padukaPanchangamFor(new Date(y, m - 1, d))?.day ?? null;
  const tag = (o: Observance) => o.sources.map((s) => (s === "paduka" ? "P" : "C")).join("");
  return dayObservances(p.festival, paduka, place.timeZone).map((o) => `${o.name}${o.detail ? ` ${o.detail}` : ""} [${tag(o)}]`);
}

const DAYS = PADUKA_PANCHANGAM_ISSUES.flatMap((issue) => issue.days);

test("every observance the Pādukā publishes is shown on its date, attributed to it", () => {
  for (const day of DAYS) {
    const names = shown(SRIRANGAM, day.date);
    for (const name of day.festival ? day.festival.split(", ") : []) {
      assert.ok(
        names.some((n) => n.startsWith(`${name} `) && /\[P/.test(n)),
        `${day.date}: ${name} missing from ${names.join(" | ")}`
      );
    }
  }
});

test("every published observance name is classified: the Ashramam's own, or paired with the engine's", () => {
  for (const day of DAYS) {
    for (const name of day.festival ? day.festival.split(", ") : []) {
      assert.ok(isClassifiedPadukaObservance(name), `${day.date}: classify "${name}" in panchangam-observances.ts`);
    }
  }
});

test("an observance both carry is shown once, under the Ashramam's name, with both sources", () => {
  assert.deepEqual(shown(SRIRANGAM, "2026-09-24"), ["Mahapradosham [PC]"]);
  assert.deepEqual(shown(SRIRANGAM, "2026-10-10"), ["Sarva Mahalaya Amavasya [PC]"]);
  // The engine's sankramanam time is kept on the published name.
  assert.ok(shown(SRIRANGAM, "2026-10-18").includes("Tula Ravi 06:21 [PC]"));
  assert.ok(shown(SRIRANGAM, "2026-10-18").includes("Visuva Punya Kalam [PC]"));
  assert.ok(shown(SRIRANGAM, "2026-11-16").includes("Vrischika Ravi 04:07 (+1) [PC]"));
  // No observance appears twice under two names.
  for (const day of DAYS) {
    const names = shown(SRIRANGAM, day.date).map((n) => n.replace(/ \[.*$/, ""));
    assert.equal(new Set(names).size, names.length, day.date);
  }
});

test("Navaratri begins and Sravana Vratam fall on the Ashramam's published days, not the engine's", () => {
  // Navaratri: the Ashramam from 11 Oct (Prathama); the engine, as Sri Ahobila Mutt, from 12 Oct.
  assert.ok(shown(SRIRANGAM, "2026-10-11").includes("Commencement of Navaratri Puja [P]"));
  assert.ok(!shown(SRIRANGAM, "2026-10-12").some((n) => /Navaratri/.test(n)));
  // Sravana Vratam: 22 Sep, 19 Oct, 16 Nov -- not the engine's 23 Sep and 20 Oct.
  assert.ok(shown(SRIRANGAM, "2026-09-22").includes("Sravana Vratam [P]"));
  assert.ok(shown(SRIRANGAM, "2026-10-19").includes("Sravana Vratam [P]"));
  assert.ok(shown(SRIRANGAM, "2026-11-16").includes("Sravana Vratam [PC]"));
  assert.ok(!shown(SRIRANGAM, "2026-09-23").some((n) => /^Sravanam/.test(n)));
  assert.ok(!shown(SRIRANGAM, "2026-10-20").some((n) => /^Sravanam/.test(n)));
});

test("the calculated Ekadasi on 22 Oct 2026 stays, attributed to the calculation", () => {
  // The transcribed Pādukā lists no Ekadasi that day; kept until the printed page settles it.
  assert.ok(shown(SRIRANGAM, "2026-10-22").includes("Ekadasi Vratam [C]"));
  assert.ok(shown(SRIRANGAM, "2026-10-22").includes("Peyazhvar Tirunakshatram [PC]"));
});

test("the Ashramam's own observances appear only on published dates", () => {
  assert.deepEqual(shown(SRIRANGAM, "2026-10-02"), ["Mahavyatipatam [P]"]);
  assert.ok(shown(SRIRANGAM, "2026-10-12").includes("Chandra Darsanam [P]"));
  assert.ok(shown(SRIRANGAM, "2026-10-07").includes("Sanyastha Mahalayam [P]"));
  assert.ok(shown(SRIRANGAM, "2026-10-09").includes("Sastrahata Mahalayam [P]"));
  // No issue covers 2027: nothing published is carried to it, and the engine's rules alone apply.
  for (const iso of ["2027-10-01", "2027-10-30", "2027-11-15"]) {
    assert.ok(shown(SRIRANGAM, iso).every((n) => n.endsWith("[C]")), iso);
  }
});

test("away from Indian time, the engine decides shared observances; the Ashramam's own are still added", () => {
  // New York's Ekadasi and Navaratri follow its own sunrise; the Pādukā's Indian dates don't move them.
  const navaratri = ["2026-10-11", "2026-10-12"].map((iso) => shown(NEW_YORK, iso).filter((n) => /Navaratri/.test(n)));
  assert.ok(navaratri.flat().every((n) => n.endsWith("[C]")), JSON.stringify(navaratri));
  assert.ok(shown(NEW_YORK, "2026-10-02").includes("Mahavyatipatam [P]"));
  assert.ok(!shown(NEW_YORK, "2026-09-22").some((n) => /Sarva Ekadasi/.test(n)));
});

test("the observance line marks calculated ones only when sources mix", () => {
  const p = (name: string): Observance => ({ name, sources: ["paduka"], basis: "published" });
  const c = (name: string): Observance => ({ name, sources: ["calculated"], basis: "general-rule" });
  assert.deepEqual(observanceLine([], null), { text: "", source: null, srirangamDates: false });
  assert.deepEqual(observanceLine([p("Mahavyatipatam")], null), { text: "Mahavyatipatam", source: "paduka", srirangamDates: false });
  assert.deepEqual(observanceLine([c("Rohini")], null), { text: "Rohini", source: "calculated", srirangamDates: false });
  assert.deepEqual(
    observanceLine([{ name: "Mahapradosham", sources: ["paduka", "calculated"], basis: "published" }, c("Rohini")], null),
    { text: "Mahapradosham, Rohini *", source: "both", srirangamDates: false }
  );
  // A Srirangam date shown for a place on another clock is said to be one.
  assert.equal(observanceLine([{ ...p("Mahavyatipatam"), referencePlace: "Srirangam" }], null).srirangamDates, true);
  // Published names are localized; the engine's stay in English.
  assert.match(observanceLine([p("Chandra Darsanam"), c("Rohini")], "ta").text, /^சந்த்ர தர்சனம், Rohini \*$/);
});

test("each observance says why it falls on its day, and whose date it is", () => {
  const [y, m, d] = [2026, 10, 2];
  const at = (place: PanchangamPlace) =>
    dayObservances(
      computePanchangam(dayNumberOf(y, m, d), place, { placeName: "x" }).festival,
      padukaPanchangamFor(new Date(y, m - 1, d))?.day ?? null,
      place.timeZone
    );
  // In India the Pādukā's date is the place's own.
  assert.deepEqual(at(SRIRANGAM), [{ name: "Mahavyatipatam", sources: ["paduka"], basis: "published" }]);
  // In New York the same published observance is marked as Srirangam's date, not New York's.
  assert.deepEqual(at(NEW_YORK), [{ name: "Mahavyatipatam", sources: ["paduka"], basis: "published", referencePlace: "Srirangam" }]);
  // Every observance on every covered day is published or calculated by the general rules;
  // none is attributed to an Ashramam rule, since the Pādukā states none.
  for (const day of DAYS) {
    const [yy, mm, dd] = day.date.split("-").map(Number);
    const p = computePanchangam(dayNumberOf(yy, mm, dd), SRIRANGAM, { placeName: "x" });
    for (const o of dayObservances(p.festival, day, SRIRANGAM.timeZone)) {
      assert.equal(o.basis, o.sources.includes("paduka") ? "published" : "general-rule", `${day.date} ${o.name}`);
      assert.equal(o.referencePlace, undefined, `${day.date} ${o.name}`);
    }
  }
});
