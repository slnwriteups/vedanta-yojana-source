/**
 * The monthly "Pañcāṅga Saṅgraham" printed in Sri Ranganātha Pādukā
 * (English e-Edition), the journal of Srirangam Srimad Andavan Ashramam
 * -- transcribed day by day so the Home calendar can show the Ashramam's
 * own Pañcāṅgam entry for the selected date alongside the location-based
 * Ahobila Mutt figures.
 *
 * Unlike lib/panchangam-service.ts this is bundled, static data: it
 * needs no network or location access, and dates outside the transcribed
 * issues simply have no entry (lookups return null) rather than a
 * computed or guessed one. Each `details` string is the journal's own
 * text, verbatim apart from glyphs the PDF's font had mangled (Kēṭṭai,
 * Rēvatī, Tiruvōṇam, Pēyāzhvār, Tiruttuṟaippūṇḍi), restored from the
 * printed page. Times are as printed: nāḻigai (ghaṭikā) after sunrise,
 * 60.00 meaning the tithi/nakṣatram lasts the whole day.
 *
 * Add a new month by appending its issue to PADUKA_PANCHANGAM_ISSUES.
 */

export interface PadukaPanchangamDay {
  /** Gregorian civil date, YYYY-MM-DD. */
  date: string;
  /** Tamil solar month the date falls in ("Puraṭṭāsi"). */
  tamilMonth: string;
  /** Day of that Tamil month. */
  tamilDay: number;
  /** The journal's "Details" column, verbatim. */
  details: string;
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
  /** "Volume 64 Issue 6 (2026 September)". */
  issue: string;
  /** Tamil year (samvatsara) the issue's days fall in. */
  samvatsara: string;
  days: PadukaPanchangamDay[];
  tarpanams: PadukaTarpanam[];
}

export interface PadukaPanchangamEntry {
  samvatsara: string;
  issue: string;
  day: PadukaPanchangamDay | null;
  tarpanam: PadukaTarpanam | null;
}

export const PADUKA_PANCHANGAM_SOURCE = "Sri Ranganātha Pādukā (English), Srirangam Srimad Andavan Ashramam";

export const PADUKA_PANCHANGAM_ISSUES: PadukaPanchangamIssue[] = [
  {
    issue: "Volume 64 Issue 6 (2026 September)",
    samvatsara: "Parābhava",
    days: [
      { date: "2026-09-18", tamilMonth: "Puraṭṭāsi", tamilDay: 1, details: "Saptamī 19.41, Kēṭṭai 45.40, atithī." },
      { date: "2026-09-19", tamilMonth: "Puraṭṭāsi", tamilDay: 2, details: "Aṣṭamī 24.40, Mūlam 52.07, aṣṭamī tithī, kanya śukla aṣṭamī." },
      { date: "2026-09-20", tamilMonth: "Puraṭṭāsi", tamilDay: 3, details: "Navamī 29.36, Pūrāḍam 58.19, navamī tithī." },
      { date: "2026-09-21", tamilMonth: "Puraṭṭāsi", tamilDay: 4, details: "Daśamī 34.10, Uttirādam 60.00, daśamī tithī." },
      {
        date: "2026-09-22",
        tamilMonth: "Puraṭṭāsi",
        tamilDay: 5,
        details:
          "Ekādaśī 38.02, Uttirādam 03.59, Ekādaśī tithī, Svāmī Deśikan Tirunakṣatram, sarva Ekādaśī, śravaṇa vratam.",
      },
      { date: "2026-09-23", tamilMonth: "Puraṭṭāsi", tamilDay: 6, details: "Dvādaśī 40.52, Tiruvōṇam 08.48, dvādaśī tithī, śravaṇa dvādaśī." },
      { date: "2026-09-24", tamilMonth: "Puraṭṭāsi", tamilDay: 7, details: "Trayodaśī 42.28, Aviṭṭam 12.32, trayodaśī tithī, mahāpradoṣam." },
      { date: "2026-09-25", tamilMonth: "Puraṭṭāsi", tamilDay: 8, details: "Caturdaśī 42.46, Sadayam 15.01, caturdaśī tithī." },
      { date: "2026-09-26", tamilMonth: "Puraṭṭāsi", tamilDay: 9, details: "Paurṇamī 41.50, Pūraṭṭādhi 16.17, paurṇamī tithī." },
      {
        date: "2026-09-27",
        tamilMonth: "Puraṭṭāsi",
        tamilDay: 10,
        details:
          "Prathamai 39.44, Uttaraṭṭādhi 16.23, prathamai tithī, Commencement of mahāḻaya pakṣam, Śrīmad Ākkūr Āṇḍavan Śrī Śrīnivāsa Mahādeśikan Tirunakṣatram.",
      },
      { date: "2026-09-28", tamilMonth: "Puraṭṭāsi", tamilDay: 11, details: "Dvitīyai 36.29, Rēvatī 15.22, dvitīyai tithī." },
      { date: "2026-09-29", tamilMonth: "Puraṭṭāsi", tamilDay: 12, details: "Tṛtīyai 32.23, Aśvinī 13.21, tṛtīyai tithī, Mahābharaṇī." },
      { date: "2026-09-30", tamilMonth: "Puraṭṭāsi", tamilDay: 13, details: "Caturthī 27.31, Bharaṇī 10.36, caturthī tithī." },
      { date: "2026-10-01", tamilMonth: "Puraṭṭāsi", tamilDay: 14, details: "Pañcamī 22.06, Kārttikai 07.10, pañcamī ṣaṣṭi tithī dvayam." },
      {
        date: "2026-10-02",
        tamilMonth: "Puraṭṭāsi",
        tamilDay: 15,
        details: "Ṣaṣṭi 16.22, Rohiṇī 03.22, Mṛgaśīrṣam 55.57, saptamī tithī, Mahāvyatīpātam.",
      },
      { date: "2026-10-03", tamilMonth: "Puraṭṭāsi", tamilDay: 16, details: "Saptamī 10.25, Tiruvādirai 55.10, aṣṭamī tithī, Madhyāṣṭamī." },
      { date: "2026-10-04", tamilMonth: "Puraṭṭāsi", tamilDay: 17, details: "Aṣṭamī 04.26, Navamī 54.09, Punarvasu 51.10, navamī tithī." },
      { date: "2026-10-05", tamilMonth: "Puraṭṭāsi", tamilDay: 18, details: "Daśamī 53.14, Puṣyam 47.36, daśamī tithī." },
      { date: "2026-10-06", tamilMonth: "Puraṭṭāsi", tamilDay: 19, details: "Ekādaśī 48.32, Āyilyam 44.38, Ekādaśī tithī, sarva Ekādaśī." },
      { date: "2026-10-07", tamilMonth: "Puraṭṭāsi", tamilDay: 20, details: "Dvādaśī 44.33, Magham 42.24, dvādaśī tithī, sanyastha mahāḻayam." },
      { date: "2026-10-08", tamilMonth: "Puraṭṭāsi", tamilDay: 21, details: "Trayodaśī 41.27, Pūram 41.01, trayodaśī tithī, mahāpradoṣam." },
      {
        date: "2026-10-09",
        tamilMonth: "Puraṭṭāsi",
        tamilDay: 22,
        details: "Caturdaśī 39.28, Uttiram 40.44, caturdaśī tithī, śastrahata mahāḻayam.",
      },
      {
        date: "2026-10-10",
        tamilMonth: "Puraṭṭāsi",
        tamilDay: 23,
        details: "Amāvāsyai 38.43, Hastam 41.39, amāvāsyai tithī, sarva mahāḻaya amāvāsyai.",
      },
      {
        date: "2026-10-11",
        tamilMonth: "Puraṭṭāsi",
        tamilDay: 24,
        details: "Prathamai 39.11, Cittirai 43.45, prathamai tithī, commencement of Navarātri pūjā.",
      },
      { date: "2026-10-12", tamilMonth: "Puraṭṭāsi", tamilDay: 25, details: "Dvitīyai 40.58, Svātī 47.05, dvitīyai tithī, Candra darśana." },
      { date: "2026-10-13", tamilMonth: "Puraṭṭāsi", tamilDay: 26, details: "Tṛtīyai 43.59, Viśākham 51.38, tṛtīyai tithī." },
      { date: "2026-10-14", tamilMonth: "Puraṭṭāsi", tamilDay: 27, details: "Caturthī 47.59, Anuṣam 57.04, caturthī tithī." },
      { date: "2026-10-15", tamilMonth: "Puraṭṭāsi", tamilDay: 28, details: "Pañcamī 52.43, Kēṭṭai 60.00, pañcamī tithī." },
      { date: "2026-10-16", tamilMonth: "Puraṭṭāsi", tamilDay: 29, details: "Ṣaṣṭi 57.49, Kēṭṭai 03.12, ṣaṣṭi tithī." },
      {
        date: "2026-10-17",
        tamilMonth: "Puraṭṭāsi",
        tamilDay: 30,
        details:
          "Saptamī 60.00, Mūlam 09.37, saptamī tithī, Kanyā śukla saptamī, Tirukkuḍantai Deśikan Śrīgopālārya Mahādeśikan Tirunakṣatram.",
      },
      {
        date: "2026-10-18",
        tamilMonth: "Aippasi",
        tamilDay: 1,
        details:
          "Saptamī 02.55, Pūrāḍam 15.55, aṣṭamī tithī, tulā ravi 0.33, viśuva puṇya kalam, Aippasi māsa praveśa tarpaṇam, tulā śukla aṣṭamī, commencement of tulā snānam.",
      },
      { date: "2026-10-19", tamilMonth: "Aippasi", tamilDay: 2, details: "Aṣṭamī 07.35, Uttirādam 21.45, navamī tithī, śravaṇa vratam." },
      { date: "2026-10-20", tamilMonth: "Aippasi", tamilDay: 3, details: "Navamī 11.29, Tiruvōṇam 26.49, daśamī tithī, Mahā navamī." },
      {
        date: "2026-10-21",
        tamilMonth: "Aippasi",
        tamilDay: 4,
        details: "Daśamī 14.24, Aviṭṭam 30.51, Ekādaśī tithī, Vijaya daśamī, Bhūdattāzhvār Tirunakṣatram.",
      },
      {
        date: "2026-10-22",
        tamilMonth: "Aippasi",
        tamilDay: 5,
        details: "Ekādaśī 16.04, Sadayam 33.38, dvādaśī tithī, Pēyāzhvār Tirunakṣatram.",
      },
      { date: "2026-10-23", tamilMonth: "Aippasi", tamilDay: 6, details: "Dvādaśī 16.26, Pūraṭṭādhi 35.12, trayodaśī tithī, mahāpradoṣam." },
      {
        date: "2026-10-24",
        tamilMonth: "Aippasi",
        tamilDay: 7,
        details:
          "Trayodaśī 15.37, Uttaraṭṭādhi 35.34, caturdaśī tithī, Śrīmad Tiruttuṟaippūṇḍi Āṇḍavan Śrīnivāsa Rāmānuja Mahādeśikan Tirunakṣatram.",
      },
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
      return { samvatsara: issue.samvatsara, issue: issue.issue, day, tarpanam };
    }
  }
  return null;
}
