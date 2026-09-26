/**
 * The monthly "Pañcāṅga Saṅgraham" printed in Sri Ranganātha Pādukā
 * (English e-Edition), the journal of Srirangam Srimad Andavan Ashramam,
 * transcribed day by day so the Home calendar can show the Ashramam's
 * own Panchangam for the selected date alongside the location-based
 * Ahobila Mutt figures.
 *
 * Each day is stored in the same shape the Ahobila rows use
 * (lib/panchangam-service.ts PanchangamData): `paksha`, `tithi` and
 * `nakshatram` are the tithi/nakshatram prevailing at sunrise (the first
 * one the journal lists), spelled exactly as that service spells them so
 * lib/panchangam-labels.ts localizes both calendars identically, and
 * `festival` is the day's observances. The journal's end times
 * (nāḻigai after sunrise) and śrāddha tithi are not carried.
 *
 * Unlike lib/panchangam-service.ts this is bundled, static data: it
 * needs no network or location access, and dates outside the transcribed
 * issues simply have no entry (lookups return null) rather than a
 * computed or guessed one.
 *
 * Add a new month by appending its issue to PADUKA_PANCHANGAM_ISSUES.
 */

export interface PadukaPanchangamDay {
  /** Gregorian civil date, YYYY-MM-DD. */
  date: string;
  /** "Shukla Paksha" | "Krishna Paksha". */
  paksha: string;
  /** Tithi at sunrise, spelled as lib/panchangam-labels.ts keys it ("Pournami"). */
  tithi: string;
  /** Nakshatram at sunrise, spelled as lib/panchangam-labels.ts keys it ("Purva Badra"). */
  nakshatram: string;
  /** The day's observances, comma-separated, or "" on an ordinary day. */
  festival: string;
}

export interface PadukaTarpanam {
  /** Gregorian civil date, YYYY-MM-DD. */
  date: string;
  /** The journal's heading for the tarpaṇam ("Parābhava Puraṭṭāsi 23, Saturday, amāvāsyā puṇya kālam"). */
  title: string;
  /** The Tarpaṇa Saṅkalpam text, verbatim. */
  sankalpam: string;
}

export interface PadukaPanchangamIssue {
  /** The journal issue the days were transcribed from -- provenance only, not displayed. */
  issue: string;
  days: PadukaPanchangamDay[];
  tarpanams: PadukaTarpanam[];
}

export interface PadukaPanchangamEntry {
  day: PadukaPanchangamDay | null;
  tarpanam: PadukaTarpanam | null;
}

export const PADUKA_PANCHANGAM_ISSUES: PadukaPanchangamIssue[] = [
  {
    issue: "Sri Ranganātha Pādukā (English), Volume 64 Issue 6 (2026 September)",
    days: [
      { date: "2026-09-18", paksha: "Shukla Paksha", tithi: "Saptami", nakshatram: "Jyeshta", festival: "" },
      { date: "2026-09-19", paksha: "Shukla Paksha", tithi: "Ashtami", nakshatram: "Moola", festival: "Kanya Sukla Ashtami" },
      { date: "2026-09-20", paksha: "Shukla Paksha", tithi: "Navami", nakshatram: "Purva Ashadha", festival: "" },
      { date: "2026-09-21", paksha: "Shukla Paksha", tithi: "Dasami", nakshatram: "Uttara Ashadha", festival: "" },
      { date: "2026-09-22", paksha: "Shukla Paksha", tithi: "Ekadasi", nakshatram: "Uttara Ashadha", festival: "Svami Desikan Tirunakshatram, Sarva Ekadasi, Sravana Vratam" },
      { date: "2026-09-23", paksha: "Shukla Paksha", tithi: "Dvadasi", nakshatram: "Shravana", festival: "Sravana Dvadasi" },
      { date: "2026-09-24", paksha: "Shukla Paksha", tithi: "Trayodasi", nakshatram: "Dhanishta", festival: "Mahapradosham" },
      { date: "2026-09-25", paksha: "Shukla Paksha", tithi: "Chaturdasi", nakshatram: "Satabhisha", festival: "" },
      { date: "2026-09-26", paksha: "Shukla Paksha", tithi: "Pournami", nakshatram: "Purva Badra", festival: "" },
      { date: "2026-09-27", paksha: "Krishna Paksha", tithi: "Prathama", nakshatram: "Uttara Badra", festival: "Commencement of Mahalaya Paksham, Srimad Akkur Andavan Sri Srinivasa Mahadesikan Tirunakshatram" },
      { date: "2026-09-28", paksha: "Krishna Paksha", tithi: "Dvithiya", nakshatram: "Revathi", festival: "" },
      { date: "2026-09-29", paksha: "Krishna Paksha", tithi: "Trithiya", nakshatram: "Aswini", festival: "Mahabharani" },
      { date: "2026-09-30", paksha: "Krishna Paksha", tithi: "Chaturthi", nakshatram: "Bharani", festival: "" },
      { date: "2026-10-01", paksha: "Krishna Paksha", tithi: "Panchami", nakshatram: "Krittika", festival: "" },
      { date: "2026-10-02", paksha: "Krishna Paksha", tithi: "Shashthi", nakshatram: "Rohini", festival: "Mahavyatipatam" },
      { date: "2026-10-03", paksha: "Krishna Paksha", tithi: "Saptami", nakshatram: "Ardra", festival: "Madhyashtami" },
      { date: "2026-10-04", paksha: "Krishna Paksha", tithi: "Ashtami", nakshatram: "Punarvasu", festival: "" },
      { date: "2026-10-05", paksha: "Krishna Paksha", tithi: "Dasami", nakshatram: "Pushyami", festival: "" },
      { date: "2026-10-06", paksha: "Krishna Paksha", tithi: "Ekadasi", nakshatram: "Aslesha", festival: "Sarva Ekadasi" },
      { date: "2026-10-07", paksha: "Krishna Paksha", tithi: "Dvadasi", nakshatram: "Makha", festival: "Sanyastha Mahalayam" },
      { date: "2026-10-08", paksha: "Krishna Paksha", tithi: "Trayodasi", nakshatram: "Purva Phalguni", festival: "Mahapradosham" },
      { date: "2026-10-09", paksha: "Krishna Paksha", tithi: "Chaturdasi", nakshatram: "Uttara Phalguni", festival: "Sastrahata Mahalayam" },
      { date: "2026-10-10", paksha: "Krishna Paksha", tithi: "Amavasya", nakshatram: "Hasta", festival: "Sarva Mahalaya Amavasya" },
      { date: "2026-10-11", paksha: "Shukla Paksha", tithi: "Prathama", nakshatram: "Chitra", festival: "Commencement of Navaratri Puja" },
      { date: "2026-10-12", paksha: "Shukla Paksha", tithi: "Dvithiya", nakshatram: "Swathi", festival: "Chandra Darsanam" },
      { date: "2026-10-13", paksha: "Shukla Paksha", tithi: "Trithiya", nakshatram: "Visakha", festival: "" },
      { date: "2026-10-14", paksha: "Shukla Paksha", tithi: "Chaturthi", nakshatram: "Anuradha", festival: "" },
      { date: "2026-10-15", paksha: "Shukla Paksha", tithi: "Panchami", nakshatram: "Jyeshta", festival: "" },
      { date: "2026-10-16", paksha: "Shukla Paksha", tithi: "Shashthi", nakshatram: "Jyeshta", festival: "" },
      { date: "2026-10-17", paksha: "Shukla Paksha", tithi: "Saptami", nakshatram: "Moola", festival: "Kanya Sukla Saptami, Tirukkudantai Desikan Srigopalarya Mahadesikan Tirunakshatram" },
      { date: "2026-10-18", paksha: "Shukla Paksha", tithi: "Saptami", nakshatram: "Purva Ashadha", festival: "Tula Ravi, Visuva Punya Kalam, Aippasi Masa Pravesa Tarpanam, Tula Sukla Ashtami, Commencement of Tula Snanam" },
      { date: "2026-10-19", paksha: "Shukla Paksha", tithi: "Ashtami", nakshatram: "Uttara Ashadha", festival: "Sravana Vratam" },
      { date: "2026-10-20", paksha: "Shukla Paksha", tithi: "Navami", nakshatram: "Shravana", festival: "Maha Navami" },
      { date: "2026-10-21", paksha: "Shukla Paksha", tithi: "Dasami", nakshatram: "Dhanishta", festival: "Vijaya Dasami, Bhudattazhvar Tirunakshatram" },
      { date: "2026-10-22", paksha: "Shukla Paksha", tithi: "Ekadasi", nakshatram: "Satabhisha", festival: "Peyazhvar Tirunakshatram" },
      { date: "2026-10-23", paksha: "Shukla Paksha", tithi: "Dvadasi", nakshatram: "Purva Badra", festival: "Mahapradosham" },
      { date: "2026-10-24", paksha: "Shukla Paksha", tithi: "Trayodasi", nakshatram: "Uttara Badra", festival: "Srimad Tirutturaippundi Andavan Srinivasa Ramanuja Mahadesikan Tirunakshatram" },
    ],
    tarpanams: [
      {
        date: "2026-09-17",
        title: "Parābhava Puraṭṭāsi 1, Thursday, Śatacīti puṇyakālam Puraṭṭāsi māsa praveśa tarpaṇam",
        sankalpam:
          "Parābhava nāma samvatsare, dakṣiṇāyane, varṣa ṛtau, siṁha māse, śukla pakṣe, ṣaṣṭhyām puṇya tithau, guru vāsara yuktāyām, anurādhā nakṣatra yuktāyām, viṣkambha yoga, taitula karaṇa, śatacīti puṇyakale, kanyā saṅkramaṇa śrāddham, tila tarpaṇa rūpeṇa.",
      },
      {
        // Printed as "10-10-2025" in the issue; 10 October 2026 is the
        // Saturday that the day table itself lists as Puraṭṭāsi 23 amāvāsyai.
        date: "2026-10-10",
        title: "Parābhava Puraṭṭāsi 23, Saturday, amāvāsyā puṇya kālam",
        sankalpam:
          "Parābhava nāma samvatsare, dakṣiṇāyane, varṣa ṛtau, kanyā māse, kṛṣṇa pakṣe, amāvāsyāyām puṇya tithau, sthira vāsara yuktāyām, hasta nakṣatra yuktāyām, māhendra yoga, nāgava (catuṣpāda till 09.05) karaṇa, amāvāsyā puṇya kāla darśa śrāddham, tila tarpaṇa rūpeṇa.",
      },
      {
        date: "2026-10-18",
        title: "Parābhava Aippasi 1, Sunday, Aippasi māsa praveśa tarpaṇam, viśuva puṇya kālam",
        sankalpam:
          "Parābhava nāma samvatsare, dakṣiṇāyane, śarad ṛtau, tulā māse, śukla pakṣe, aṣṭamyām puṇya tithau, bhānu vāsara yuktāyām, pūrvāṣāḍhā nakṣatra yuktāyām, sukarma yoga, bhadra (vaṇija till 2.55) karaṇa, viśuva puṇya kale, tulā saṅkramaṇa śrāddham, tila tarpaṇa rūpeṇa.",
      },
    ],
  },
];

/** Local-calendar YYYY-MM-DD for `date` -- the device's own day, matching how the calendar strip picks days. */
export function padukaDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The journal's Pañcāṅgam day and/or Tarpaṇa Saṅkalpam for `date`, or null when no transcribed issue covers it. */
export function padukaPanchangamFor(
  date: Date,
  issues: PadukaPanchangamIssue[] = PADUKA_PANCHANGAM_ISSUES
): PadukaPanchangamEntry | null {
  const key = padukaDateKey(date);
  for (const issue of issues) {
    const day = issue.days.find((d) => d.date === key) ?? null;
    const tarpanam = issue.tarpanams.find((t) => t.date === key) ?? null;
    if (day || tarpanam) {
      return { day, tarpanam };
    }
  }
  return null;
}
