/**
 * Builds docs/PANCHANGAM-COMPARISON.md: day by day for Srirangam, the
 * Ashramam's Sri Ranganātha Pādukā Panchangam (content-lib/paduka-panchangam.ts),
 * Sri Ahobila Mutt's published calendar (tests/content/fixtures/ahobila-srirangam-*.json)
 * and this app's own engine side by side, with the numerical differences.
 *
 *   node scripts/panchangam-comparison.ts
 *
 * Re-run it after transcribing a new Pādukā issue or adding published values.
 * The observance notes at the end of the document are written by hand
 * (OBSERVANCE_FINDINGS below), since judging them needs the sources.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  computePanchangam,
  dayNumberOf,
  karanaAt,
  karanaName,
  nakshatraAt,
  tithiAt,
  type PanchangamPlace,
} from "../content-lib/panchangam-engine.ts";
import { PADUKA_PANCHANGAM_ISSUES } from "../content-lib/paduka-panchangam.ts";
import { dayObservances, type Observance } from "../content-lib/panchangam-observances.ts";
import { traditionalElongation } from "../content-lib/panchangam-siddhanta.ts";

interface PublishedDay {
  date: string;
  sunrise: string;
  sunset: string;
  tithis: Array<{ paksha: string; tithi: string; ends: string | null }>;
  nakshatrams: Array<{ nakshatram: string; ends: string | null }>;
  karanas: Array<{ karana: string; ends: string | null }>;
  observances: string;
}

const FIXTURE = "tests/content/fixtures/ahobila-srirangam-2026-09-18_11-24.json";
const ahobila = JSON.parse(readFileSync(FIXTURE, "utf8")) as { source: string; place: PanchangamPlace & { name: string }; days: PublishedDay[] };
const place: PanchangamPlace = ahobila.place;
const IST_MINUTES = 330;

/** "07:17" / "02:10 (+1)" on day `iso` → epoch ms (the fixture is for an IST place). */
function clockMs(iso: string, clock: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const [h, min] = clock.slice(0, 5).split(":").map(Number);
  return Date.UTC(y, m - 1, d + (clock.endsWith("(+1)") ? 1 : 0), h, min) - IST_MINUTES * 60_000;
}

/** Engine minus published, whole minutes, signed. */
function delta(engineMs: number, publishedMs: number): number {
  return Math.round((engineMs - publishedMs) / 60_000);
}

const fmtDelta = (n: number) => (n === 0 ? "0" : n > 0 ? `+${n}` : `${n}`);

const padukaDays = new Map(PADUKA_PANCHANGAM_ISSUES.flatMap((issue) => issue.days).map((d) => [d.date, d]));

const rows: string[] = [];
const deltas = { tithi: [] as number[], nakshatram: [] as number[], karana: [] as number[], sunrise: [] as number[] };
let sunriseElementsAgree = 0;

for (const pub of ahobila.days) {
  const [y, m, d] = pub.date.split("-").map(Number);
  const p = computePanchangam(dayNumberOf(y, m, d), place, { placeName: "Srirangam" });
  const sunriseMs = clockMs(pub.date, p.sunrise);
  deltas.sunrise.push(delta(sunriseMs, clockMs(pub.date, pub.sunrise)));

  // Each published end is checked against the engine's end of the same element. The
  // daily view caps an element still running at the next sunrise to that sunrise
  // (21 Sep: Uttara Ashadha "06:07*", which the next day shows running to 07:43), so
  // an end the next day continues is no end at all.
  const next = ahobila.days[ahobila.days.indexOf(pub) + 1];
  const tithiDeltas = pub.tithis
    .filter((t, i) => t.ends && !(i === pub.tithis.length - 1 && next?.tithis[0].tithi === t.tithi && next.tithis[0].paksha === t.paksha))
    .map((t) => delta(tithiAt(clockMs(pub.date, t.ends!) - 30 * 60_000).end, clockMs(pub.date, t.ends!)));
  const nakDeltas = pub.nakshatrams
    .filter((n, i) => n.ends && !(i === pub.nakshatrams.length - 1 && next?.nakshatrams[0].nakshatram === n.nakshatram))
    .map((n) => delta(nakshatraAt(clockMs(pub.date, n.ends!) - 30 * 60_000).end, clockMs(pub.date, n.ends!)));
  const karanaDeltas = pub.karanas
    .filter((k) => k.ends)
    .map((k) => {
      const at = karanaAt(clockMs(pub.date, k.ends!) - 30 * 60_000);
      return karanaName(at.index) === k.karana ? delta(at.end, clockMs(pub.date, k.ends!)) : NaN;
    });
  deltas.tithi.push(...tithiDeltas);
  deltas.nakshatram.push(...nakDeltas);
  deltas.karana.push(...karanaDeltas);

  const paduka = padukaDays.get(pub.date);
  const sunriseTriple = (x: { paksha: string; tithi: string; nakshatram: string }) => `${x.paksha.split(" ")[0]} ${x.tithi}, ${x.nakshatram}`;
  const engineTriple = sunriseTriple(p);
  const ahobilaTriple = `${pub.tithis[0].paksha.split(" ")[0]} ${pub.tithis[0].tithi}, ${pub.nakshatrams[0].nakshatram}`;
  const padukaTriple = paduka ? sunriseTriple(paduka) : "–";
  const agree = engineTriple === ahobilaTriple && (!paduka || padukaTriple === engineTriple);
  if (agree) sunriseElementsAgree += 1;

  // What the app shows: the observance layer's merge, P = published in the Pādukā, C = calculated.
  const tag = (o: Observance) => o.sources.map((x) => (x === "paduka" ? "P" : "C")).join("");
  const app = dayObservances(p.festival, paduka ?? null, place.timeZone)
    .map((o) => `${o.name}${o.detail ? ` ${o.detail}` : ""} (${tag(o)})`)
    .join(", ");
  const worst = (xs: number[]) => (xs.length ? fmtDelta(xs.reduce((a, b) => (Math.abs(b) > Math.abs(a) || Number.isNaN(b) ? b : a), 0)) : "–");
  rows.push(
    `| ${pub.date} | ${padukaTriple} | ${agree ? "same" : ahobilaTriple} | ${agree ? "same" : engineTriple} | ` +
      `${worst(tithiDeltas)} | ${worst(nakDeltas)} | ${worst(karanaDeltas)} | ` +
      `${paduka?.festival || "–"} | ${pub.observances || "–"} | ${p.festival || "–"} | ${app || "–"} |`
  );
}

function summary(name: string, xs: number[]): string {
  const valid = xs.filter((x) => !Number.isNaN(x));
  const abs = valid.map(Math.abs).sort((a, b) => a - b);
  const within = (n: number) => abs.filter((x) => x <= n).length;
  return (
    `| ${name} | ${xs.length} | ${within(0)} | ${within(1)} | ${within(2)} | ${abs.at(-1) ?? "–"} | ` +
    `${xs.length - valid.length} |`
  );
}

/**
 * Whether the Mutt halves a tithi in time: each mid-tithi karana end it
 * prints against the midpoint in time of its own printed tithi (start =
 * the previous printed end), and against the elongation's 6° midpoint.
 * Uses the Mutt's own numbers; the engine only names the tithi.
 */
function karanaMidpointEvidence(): { n: number; timeMax: number; angleMax: number; angleWithin1: number } {
  const ends: number[] = [];
  ahobila.days.forEach((day, i) => {
    const next = ahobila.days[i + 1];
    day.tithis.forEach((t, j) => {
      const capped = j === day.tithis.length - 1 && next?.tithis[0].tithi === t.tithi;
      if (t.ends && !capped) ends.push(clockMs(day.date, t.ends));
    });
  });
  const bounds = [...new Set(ends)].sort((a, b) => a - b);
  const byTime: number[] = [];
  const byAngle: number[] = [];
  for (const day of ahobila.days) {
    for (const k of day.karanas) {
      if (!k.ends) continue;
      const end = clockMs(day.date, k.ends);
      if (bounds.some((b) => Math.abs(b - end) < 90_000)) continue; // a second-half karana: ends with its tithi
      const i = bounds.findIndex((b) => b > end);
      if (i < 1 || bounds[i] - bounds[i - 1] > 30 * 3_600_000) continue;
      const [start, stop] = [bounds[i - 1], bounds[i]];
      const target = tithiAt((start + stop) / 2).index * 12 + 6;
      let lo = start;
      let hi = stop;
      for (let pass = 0; pass < 50; pass += 1) {
        const mid = (lo + hi) / 2;
        if (((traditionalElongation(mid) - target + 540) % 360) - 180 < 0) lo = mid;
        else hi = mid;
      }
      byTime.push(Math.abs((start + stop) / 2 - end) / 60_000);
      byAngle.push(Math.abs((lo + hi) / 2 - end) / 60_000);
    }
  }
  return {
    n: byTime.length,
    timeMax: Math.max(...byTime),
    angleMax: Math.max(...byAngle),
    angleWithin1: byAngle.filter((x) => x <= 1).length,
  };
}
const karanaEvidence = karanaMidpointEvidence();

/**
 * Observance differences, judged by hand against the two sources. Each:
 * what differs, its kind (astronomical, geographic, notation, observance),
 * the explanation, its status, and the decision taken.
 */
const OBSERVANCE_FINDINGS = `
| Observance | Ashramam (Pādukā) | Ahobila Mutt | Engine | Kind | Explanation | Status | Decision |
|---|---|---|---|---|---|---|---|
| Ekadasi | 22 Sep, 6 Oct, 5 Nov, 20 Nov (Kaisika) | same, and 22 Oct | same as Ahobila Mutt | – | Four agree. On **22 Oct** (Shukla Ekadasi at sunrise, no Dasami at arunodaya) Ahobila Mutt and the engine keep Ekadasi; the transcribed Pādukā lists only Peyazhvar's tirunakshatram. The printed page could not be inspected (the e-Edition is by subscription), so whether this is a transcription slip, an editorial omission or a real distinction is not known. | **Unresolved** | Calculated Ekadasi kept, shown as calculated |
| Pradosham (5) | 24 Sep, 8 Oct, 23 Oct, 6 Nov, 22 Nov ("Mahapradosham") | same | same | – | Trayodasi at sunset. | Verified | Keep |
| Mahalaya Paksham, Mahabharani, Madhyashtami, Mahalaya Amavasya | 27 Sep, 29 Sep, 3 Oct, 10 Oct | same | same | – | Aparahna (sraddha) rules. | Verified | Keep |
| Maha Navami, Vijaya Dasami | 20, 21 Oct | same | same | – | Sunrise tithi. | Verified | Keep |
| Deepavali, Amavasya | 8 Nov | same | same | – | Last arunodaya in Chaturdasi; Amavasya by aparahna. | Verified | Keep |
| Tula, Vrischika sankramanam and punyakalam | 18 Oct; 16-17 Nov | same | same | – | | Verified | Keep |
| Tirunakshatrams (Desikan, Bhutattazhvar, Peyazhvar, Vishvaksenar, Poigai Azhvar, Tirumangai Azhvar) | 22 Sep, 21 Oct, 22 Oct, 14 Nov, 16 Nov, 24 Nov | same | same | – | Nazhigai rule. | Verified | Keep |
| **Navaratri begins** | **11 Oct** | 12 Oct ("Navaratri Pooja Begins") | 12 Oct | Observance | Ahobila Mutt (and the engine) begin on the first evening in Dvitiya. 11 Oct holds Ashvina Shukla Prathama at both sunrise and sunset, so a Prathama-at-sunrise and a Prathama-at-sunset rule both fit; one year cannot tell them apart. | Published date verified; the Ashramam's general rule unknown | **The Ashramam's 11 Oct shown**; later years keep the engine's rule until the Ashramam's is established |
| **Sravana Vratam** | **22 Sep, 19 Oct**, 16 Nov | 23 Sep, 20 Oct, 16 Nov ("Sravana") | 23 Sep, 20 Oct, 16 Nov | Observance | Ahobila Mutt (and the engine): Sravanam at sunrise for 6 nazhigai. Of the rules tested on the Ashramam's three days, only "Sravanam at sunset" fits all three; "at sunrise" fits 1, "most of the daylight" fits 2 (19 Oct has 3.0 h against 10.8 h on 20 Oct). Three days, one season, and no stated rule. | Published dates verified; sunset rule a hypothesis (3/3) | **The Ashramam's dates shown**; later years keep the engine's rule until more published months test the hypothesis |
| Chandra Darsanam | 12 Oct, 10 Nov | – | – | Observance (Ashramam only) | The day's rule is not printed. | Published dates verified; rule unknown | **Shown on the published dates only** |
| Mahavyatipatam | 2 Oct | – | – | Observance (Ashramam only) | Possibly Vyatipata yoga in Mahalaya Paksham; not confirmed. | Published date verified; rule unknown | **Shown on the published date only** |
| Kanya/Tula/Vrischika Sukla Ashtami/Saptami, Bhanu Saptami | 19 Sep, 17-18 Oct, 16-17 Nov, 1 Nov | – | – | Observance (Ashramam only) | Named punya days of the solar month; rules not printed. | Published dates verified; rules unknown | **Shown on the published dates only** |
| Sanyastha Mahalayam, Sastrahata Mahalayam | 7 Oct, 9 Oct | – | – | Observance (Ashramam only) | Mahalaya sraddhas; rules not printed. | Published dates verified | **Shown on the published dates only** |
| Tula Snanam begins/ends, Kadai Mugam, Mudavan Muzhukku, Masa Pravesa Tarpanams, Naraka Chaturdasi Snanam, Sravana Dvadasi | 18 Oct; 16-17 Nov; 8 Nov; 23 Sep | – | – | Observance (Ashramam only) | Rules not printed. | Published dates verified | **Shown on the published dates only** |
| Karthigai Deepam | 24 Nov ("Vaikhanasa - Sri Pancharatra Deepam") | 24 Nov ("Karthigai Pandigai") | 24 Nov ("Karthigai Deepam") | Observance (naming) | Same day; different names. | Day verified | Keep |
| Dvadasi Paranai | 23 Sep, 7 Oct, 23 Oct, 6 Nov, 21 Nov (not printed with times) | windows | windows | Astronomical | Windows agree to the minute except 21 Nov, "after 08:47" vs the engine's 08:44: the end of Hari Vasara, a quarter of the Dvadasi, follows the 3-4 min tithi-end differences of 18-19 Nov. | Within tolerance | Keep |
| Andavan and Mahadesikan tirunakshatrams | 27 Sep, 17 Oct, 24 Oct | – | – | Observance (Ashramam only) | Taken from the journal as printed. | Verified (published) | Shown on the published dates |
| Azhagiyasingar tirunakshatrams ("HH n") | – | several | several | Observance (Ahobila only) | Sri Ahobila Mutt's own acharyas. | – | Keep (as in the engine) |
`;

const doc = `# Panchangam comparison: Srirangam, 18 Sep – 24 Nov 2026

GENERATED by \`scripts/panchangam-comparison.ts\` from the sources below;
re-run it rather than editing the tables by hand.

- **Ashramam:** Srirangam Srimad Andavan Ashramam's Sri Ranganātha Pādukā
  Panchangam, Sep and Oct 2026 issues (\`content-lib/paduka-panchangam.ts\`):
  the tithi and nakshatram at sunrise and the day's observances; end
  times appear only in its Tarpana Sankalpams (see below).
- **Ahobila Mutt:** ${ahobila.source}, for ${ahobila.place.name}
  (\`${FIXTURE}\`).
- **Engine:** this app's \`content-lib/panchangam-engine.ts\`, for the same
  coordinates.

Differences are the engine's time minus the published time, in minutes
(positive: the engine's is later). Each day's figure is its largest.

## Summary

Sunrise tithi, paksha and nakshatram agree on ${sunriseElementsAgree} of ${ahobila.days.length} days across
all three where the Ashramam has the day.

| Element | Published ends | Exact | Within 1 min | Within 2 min | Largest (min) | Named differently |
|---|---|---|---|---|---|---|
${summary("Sunrise", deltas.sunrise)}
${summary("Tithi end", deltas.tithi)}
${summary("Nakshatram end", deltas.nakshatram)}
${summary("Karana end", deltas.karana)}

### Against the Ashramam's own times

The Pādukā prints end times only inside its Tarpana Sankalpams, as
nāzhigai.vināzhigai after sunrise ("catuṣpāda till 09.05"): read as clock
times they cannot be right ("vaṇija till 2.55" on a day the karana runs
to 07:17).

| Date | Pādukā | As a time | Ahobila Mutt | Engine | Modern ephemeris (Lahiri) |
|---|---|---|---|---|---|
| 10 Oct | catuṣpāda till 09.05 | 09:45 | 09:45 | 09:45 | 09:24 |
| 18 Oct | vaṇija till 2.55 | 07:17 | 07:17 | 07:17 | 08:28 |

Both maṭhas, and the engine, use the traditional (siddhantic) reckoning;
a modern ephemeris with the Lahiri ayanāṃśa is 20 to 71 minutes away from
the Ashramam's figures. The yoga and karana named in all three Tarpana
Sankalpams (17 Sep, 10 Oct, 18 Oct) agree with the engine.

## How the app combines the sources

\`content-lib/panchangam-observances.ts\` merges the engine's observances
(its rules, computed from the astronomy) with the Pādukā's (the Ashramam's
published calendar). The "App shows" column below is its output: (P)
published in the Pādukā, (C) calculated, (PC) both, shown once under the
Ashramam's name. Published observances appear only on the dates a
transcribed issue covers; Navaratri begins and Sravana Vratam take the
Ashramam's date there; everything else the engine computes stays, with its
source.

## Two questions of method

### Is the traditional (siddhantic) method documented by either maṭha?

**Not found.** Neither maṭha's calendar states how it is computed in any
source available here: Sri Ahobila Mutt's online calendar page carries no
method statement that could be retrieved, and the Pādukā e-Edition is by
subscription; web searches turned up no statement from either. The engine's
model -- Surya Siddhanta mean motions with one manda correction -- was
fitted to Sri Ahobila Mutt's published times (1,115 endings), so its
identification as "the maṭha's method" is **inferred from numerical
agreement, not documented**. What the numbers do show:

- Both calendars use a traditional reckoning, not a modern ephemeris: the
  Ashramam's two printed karana ends are 1 and 3 minutes from the engine
  and 20 and 71 minutes from a modern ephemeris with the Lahiri ayanāṃśa.
- Which traditional system (a siddhanta, a vākya table, a particular
  karaṇa text) cannot be told from agreement alone: different traditional
  systems built on the same mean motions can agree to the minute over a
  few months. Two printed Ashramam times are also a small sample.

### Is the karana's midpoint in time a convention of the published calendars?

**For Sri Ahobila Mutt, demonstrated from its own figures.** In all ${karanaEvidence.n}
mid-tithi karana ends it prints for these days, the end is the midpoint
in time of its own printed tithi start and end, within ${karanaEvidence.timeMax.toFixed(1)} minutes
(rounding); the midpoint by elongation (6°) misses by up to ${karanaEvidence.angleMax.toFixed(0)} minutes and
is within a minute only ${karanaEvidence.angleWithin1} times. This test uses only the Mutt's printed
numbers (the engine only names each tithi).

**For the Ashramam, consistent but not established.** Of its two printed
karana ends, only one can tell the methods apart (10 Oct: 09.05 nāzhigai,
09:45), and it agrees with the midpoint in time (the elongation midpoint is
09:41). One data point.

## Observances

${OBSERVANCE_FINDINGS.trim()}

## Day by day

Sunrise elements are paksha, tithi and nakshatram at sunrise ("same" when
all three sources agree).

| Date | Ashramam at sunrise | Ahobila Mutt | Engine | Tithi end Δ | Nakshatram end Δ | Karana end Δ | Ashramam observances | Ahobila Mutt observances | Engine observances | App shows |
|---|---|---|---|---|---|---|---|---|---|---|
${rows.join("\n")}
`;

writeFileSync("docs/PANCHANGAM-COMPARISON.md", doc);
console.log(`wrote docs/PANCHANGAM-COMPARISON.md (${ahobila.days.length} days)`);
