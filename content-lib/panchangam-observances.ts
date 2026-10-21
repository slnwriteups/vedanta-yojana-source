/**
 * The day's observances as the Home calendar shows them: the
 * institutional layer between the engine's rule-based list
 * (panchangam-engine.ts `festival`, computed from the astronomy) and the
 * observances Srirangam Srimad Andavan Ashramam publishes in its
 * Sri Ranganātha Pādukā Panchangam (paduka-panchangam.ts), which is the
 * calendar's primary authority for religious observances.
 *
 * Every observance keeps where it came from:
 *
 *  - An observance both list -- under their own names ("Sarva Ekadasi"
 *    in the Pādukā, "Ekadasi Vratam" in the engine) -- is shown once,
 *    under the Ashramam's name, with both sources. EQUIVALENTS pairs
 *    the names; a detail only the engine has (a sankramanam's time) is
 *    kept.
 *  - Every other published observance is shown on its published date,
 *    and only on dates a transcribed issue covers: nothing is carried to
 *    years the Ashramam hasn't published.
 *  - For the observances in PUBLISHED_DATE_GOVERNS, the Ashramam's date
 *    replaces the engine's on covered dates: where the engine keeps one
 *    on a day the Pādukā doesn't, it is left out. Everything else the
 *    engine computes stays, with its own source -- including an Ekadasi
 *    the transcribed Pādukā doesn't list (22 Oct 2026), kept until the
 *    printed page settles it.
 *
 * The Pādukā's dates are Srirangam's (Indian Standard Time); the
 * Ashramam publishes the one calendar for India, so places on Indian time
 * take its dates as their own. For a place on another clock, the engine
 * -- computing for that place's own sunrise -- decides the observances
 * both carry, and the Ashramam's own observances are added on their
 * published dates marked as Srirangam's (`referencePlace`): whether they
 * fall on the same local date there is not known.
 */

import type { LanguageCode } from "./schemas/language.ts";
import { FESTIVAL_NAMES } from "./panchangam-engine.ts";
import { localizePadukaFestival, type PadukaPanchangamDay } from "./paduka-panchangam.ts";

export type ObservanceSource = "paduka" | "calculated";

/**
 * Why an observance falls on its day:
 *  - "published": printed in the Pādukā for that date;
 *  - "ashramam-rule": calculated by a rule the Ashramam has stated;
 *  - "provisional-rule": calculated by a documented rule inferred from
 *    the Ashramam's published dates but not yet established;
 *  - "general-rule": calculated by the engine's general Sri Vaishnava
 *    rules (verified against Sri Ahobila Mutt's calendar).
 * No observance is "ashramam-rule" or "provisional-rule" yet: the
 * Pādukā publishes dates, not rules, and the one candidate rule found
 * (Sravana Vratam at sunset) fits too few published days to adopt.
 */
export type ObservanceBasis = "published" | "ashramam-rule" | "provisional-rule" | "general-rule";

export interface Observance {
  /** The name shown: the Pādukā's for a published observance, else the engine's. */
  name: string;
  /** A detail the engine adds to a published name ("06:21" after "Tula Ravi"). */
  detail?: string;
  sources: ObservanceSource[];
  basis: ObservanceBasis;
  /**
   * Set when the day shown is another place's: a Pādukā date (Srirangam,
   * Indian time) shown for a place on another clock, where the engine
   * can't say whether the observance falls on the same local date.
   */
  referencePlace?: "Srirangam";
}

/**
 * The engine's name for an observance → the Pādukā's name for the same
 * one. A name both use alike needs no entry. The engine's sankramanam
 * names carry the time ("Thula Ravi 06:21"); they are matched on the name
 * before it.
 */
const EQUIVALENTS: Record<string, string> = {
  "Ekadasi Vratam": "Sarva Ekadasi",
  Pradosham: "Mahapradosham",
  Sravanam: "Sravana Vratam",
  "Mahalaya Paksham Begins": "Commencement of Mahalaya Paksham",
  "Maha Bharani": "Mahabharani",
  "Mahalaya Amavasya": "Sarva Mahalaya Amavasya",
  "Amavasya Tarpanam": "Sarva Amavasya",
  "Navaratri Pooja Begins": "Commencement of Navaratri Puja",
  "Karthigai Deepam": "Vaikhanasa - Sri Pancharatra Deepam",
  "Sri Vedanta Desikan": "Svami Desikan Tirunakshatram",
  "Sri Vishwaksenar": "Sri Senai Mudaliyar Tirunakshatram",
  Bhoothathazhvar: "Bhudattazhvar Tirunakshatram",
  Peyazhvar: "Peyazhvar Tirunakshatram",
  "Poigai Azhvar": "Poigai Azhvar Tirunakshatram",
  "Thirumangai Azhvar": "Tirumangai Azhvar Tirunakshatram",
  "Thula Ravi": "Tula Ravi",
  "Vruschika Ravi": "Vrischika Ravi",
  "Vruschika Masa Punyakalam": "Vishnupati Punya Kalam",
};

/**
 * Engine names that match a published name only on the same day as a
 * given sankramanam: the engine's plain "Punyakalam" is the Tula
 * sankramanam's Visuva Punya Kalam on the day of Tula Ravi.
 */
const SAME_DAY_EQUIVALENTS: Array<{ name: string; published: string; when: string }> = [
  { name: "Punyakalam", published: "Visuva Punya Kalam", when: "Tula Ravi" },
];

/**
 * Published observances whose date the Ashramam decides: on dates a
 * Pādukā issue covers, the engine's own day for them is not shown.
 * Decided for 2026 from the Pādukā (Navaratri from 11 Oct, not 12; the
 * Sravana Vratam days); the Ashramam's general rule for either is not yet
 * established, so years it hasn't published keep the engine's rule.
 */
export const PUBLISHED_DATE_GOVERNS: ReadonlySet<string> = new Set(["Commencement of Navaratri Puja", "Sravana Vratam"]);

/**
 * Published observances the engine doesn't compute, so nothing to pair
 * them with: the Ashramam's acharyas and its own observances. A test
 * requires every published name to be here or a value of EQUIVALENTS,
 * so a new issue's names are always classified.
 */
export const ASHRAMAM_ONLY_OBSERVANCES: ReadonlySet<string> = new Set([
  "Kanya Sukla Ashtami",
  "Kanya Sukla Saptami",
  "Tula Sukla Ashtami",
  "Tula Sukla Saptami",
  "Vrischika Sukla Ashtami",
  "Bhanu Saptami",
  "Sravana Dvadasi",
  "Mahavyatipatam",
  "Sanyastha Mahalayam",
  "Sastrahata Mahalayam",
  "Chandra Darsanam",
  "Aippasi Masa Pravesa Tarpanam",
  "Karthikai Masa Pravesa Tarpanam",
  "Commencement of Tula Snanam",
  "Conclusion of Tula Snanam",
  "Kadai Mugam",
  "Mudavan Muzhukku",
  "Naraka Chaturdasi Snanam",
  "Srimad Akkur Andavan Sri Srinivasa Mahadesikan Tirunakshatram",
  "Tirukkudantai Desikan Srigopalarya Mahadesikan Tirunakshatram",
  "Srimad Tirutturaippundi Andavan Srinivasa Ramanuja Mahadesikan Tirunakshatram",
]);

/**
 * Whether the observance layer knows how to place a published name: the
 * Ashramam's own, or the same observance as one the engine computes
 * (paired in EQUIVALENTS, or spelled alike).
 */
export function isClassifiedPadukaObservance(name: string): boolean {
  return (
    ASHRAMAM_ONLY_OBSERVANCES.has(name) ||
    Object.values(EQUIVALENTS).includes(name) ||
    SAME_DAY_EQUIVALENTS.some((e) => e.published === name) ||
    FESTIVAL_NAMES.includes(name)
  );
}

/** "Thula Ravi 06:21" → name "Thula Ravi", detail "06:21"; other names unchanged. */
function splitTime(name: string): { name: string; detail?: string } {
  const match = name.match(/^(.*?) (\d\d:\d\d(?: \(\+1\))?)$/);
  return match ? { name: match[1], detail: match[2] } : { name };
}

/** Whether a time zone keeps Srirangam's clock, so the Pādukā's dates are the place's dates. */
export function keepsIndianTime(timeZone: string | undefined): boolean {
  return timeZone === "Asia/Kolkata" || timeZone === "Asia/Calcutta";
}

/**
 * The day's observances, from the engine's `computedFestival` and the
 * Pādukā's day (null when no issue covers the date), for a place on
 * `timeZone`'s clock. Published observances first, in the Pādukā's
 * order, then the engine's own.
 */
export function dayObservances(
  computedFestival: string,
  paduka: PadukaPanchangamDay | null,
  timeZone: string | undefined
): Observance[] {
  const computed = computedFestival ? computedFestival.split(", ").map(splitTime) : [];
  const published = paduka?.festival ? paduka.festival.split(", ") : [];
  // Away from Indian time, the Pādukā's dates aren't the place's: only its own observances are added.
  const sameClock = keepsIndianTime(timeZone);
  const shown: Observance[] = published
    .filter((name) => sameClock || ASHRAMAM_ONLY_OBSERVANCES.has(name))
    .map((name): Observance => ({
      name,
      sources: ["paduka"],
      basis: "published",
      ...(sameClock ? {} : { referencePlace: "Srirangam" as const }),
    }));

  const publishedNameOf = (name: string): string => {
    const sameDay = SAME_DAY_EQUIVALENTS.find((e) => e.name === name && published.includes(e.when));
    return sameDay?.published ?? EQUIVALENTS[name] ?? name;
  };
  for (const { name, detail } of computed) {
    const publishedName = publishedNameOf(name);
    const match = sameClock ? shown.find((o) => o.name === publishedName) : undefined;
    if (match) {
      match.sources.push("calculated");
      if (detail) match.detail = detail;
      continue;
    }
    // On a covered date, the Ashramam decides these observances' day.
    if (sameClock && paduka && PUBLISHED_DATE_GOVERNS.has(publishedName)) continue;
    shown.push({ name: detail ? `${name} ${detail}` : name, sources: ["calculated"], basis: "general-rule" });
  }
  return shown;
}

/** One observance's name in `language` (published names are localized; the engine's stay in English). */
export function observanceLabel(observance: Observance, language: LanguageCode | null): string {
  const name = observance.sources.includes("paduka") ? localizePadukaFestival(observance.name, language) : observance.name;
  return observance.detail ? `${name} ${observance.detail}` : name;
}

/**
 * The observance line as the calendar shows it: the names alone. Where
 * each comes from stays on the Observance (`sources`, `basis`,
 * `referencePlace`) for the code that needs it; the calendar shows no
 * source label and no "*" marker -- tests/app/panchangam-consistency.test.ts
 * keeps them from coming back.
 */
export function observanceLine(observances: Observance[], language: LanguageCode | null): string {
  return observances.map((o) => observanceLabel(o, language)).join(", ");
}
