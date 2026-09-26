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
 * Translations follow lib/panchangam-labels.ts: calendar terms are
 * transliterated into each script, not replaced with different words.
 * Observance names come from the fixed OBSERVANCE_LABELS vocabulary
 * below; each Tarpaṇa Saṅkalpam carries its own per-language title and
 * text (the Sanskrit formula written in that script).
 *
 * Add a new month by appending its issue to PADUKA_PANCHANGAM_ISSUES,
 * and any new observance name to OBSERVANCE_LABELS (a test enforces it).
 */

import type { LanguageCode } from "./schemas/language.ts";

export interface PadukaPanchangamDay {
  /** Gregorian civil date, YYYY-MM-DD. */
  date: string;
  /** "Shukla Paksha" | "Krishna Paksha". */
  paksha: string;
  /** Tithi at sunrise, spelled as lib/panchangam-labels.ts keys it ("Pournami"). */
  tithi: string;
  /** Nakshatram at sunrise, spelled as lib/panchangam-labels.ts keys it ("Purva Badra"). */
  nakshatram: string;
  /** The day's observances, comma-separated, or "" on an ordinary day; each one is a key of OBSERVANCE_LABELS. */
  festival: string;
}

export interface PadukaTarpanam {
  /** Gregorian civil date, YYYY-MM-DD. */
  date: string;
  /** The journal's heading for the tarpaṇam ("Parābhava Puraṭṭāsi 23, Saturday, amāvāsyā puṇya kālam"). */
  title: string;
  /** The Tarpaṇa Saṅkalpam text, verbatim. */
  sankalpam: string;
  /** The same title and saṅkalpam in each non-English language's script. */
  translations: Record<LanguageCode, { title: string; sankalpam: string }>;
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
        translations: {
          ta: {
            title: "பராபவ புரட்டாசி 1, வியாழன், சதசீதி புண்யகாலம், புரட்டாசி மாஸ ப்ரவேச தர்ப்பணம்",
            sankalpam:
              "பராபவ நாம ஸம்வத்ஸரே, தக்ஷிணாயநே, வர்ஷ ருதௌ, ஸிம்ஹ மாஸே, சுக்ல பக்ஷே, ஷஷ்ட்யாம் புண்ய திதௌ, குரு வாஸர யுக்தாயாம், அநுராதா நக்ஷத்ர யுக்தாயாம், விஷ்கம்ப யோக, தைதுல கரண, சதசீதி புண்யகலே, கந்யா ஸங்க்ரமண ச்ராத்தம், தில தர்பண ரூபேண.",
          },
          kn: {
            title: "ಪರಾಭವ ಪುರಟ್ಟಾಸಿ 1, ಗುರುವಾರ, ಶತಚೀತಿ ಪುಣ್ಯಕಾಲಮ್, ಪುರಟ್ಟಾಸಿ ಮಾಸ ಪ್ರವೇಶ ತರ್ಪಣಮ್",
            sankalpam:
              "ಪರಾಭವ ನಾಮ ಸಮ್ವತ್ಸರೇ, ದಕ್ಷಿಣಾಯನೇ, ವರ್ಷ ಋತೌ, ಸಿಂಹ ಮಾಸೇ, ಶುಕ್ಲ ಪಕ್ಷೇ, ಷಷ್ಠ್ಯಾಮ್ ಪುಣ್ಯ ತಿಥೌ, ಗುರು ವಾಸರ ಯುಕ್ತಾಯಾಮ್, ಅನುರಾಧಾ ನಕ್ಷತ್ರ ಯುಕ್ತಾಯಾಮ್, ವಿಷ್ಕಮ್ಭ ಯೋಗ, ತೈತುಲ ಕರಣ, ಶತಚೀತಿ ಪುಣ್ಯಕಲೇ, ಕನ್ಯಾ ಸಙ್ಕ್ರಮಣ ಶ್ರಾದ್ಧಮ್, ತಿಲ ತರ್ಪಣ ರೂಪೇಣ.",
          },
          hi: {
            title: "पराभव पुरट्टासि 1, गुरुवार, शतचीति पुण्यकालम्, पुरट्टासि मास प्रवेश तर्पणम्",
            sankalpam:
              "पराभव नाम सम्वत्सरे, दक्षिणायने, वर्ष ऋतौ, सिंह मासे, शुक्ल पक्षे, षष्ठ्याम् पुण्य तिथौ, गुरु वासर युक्तायाम्, अनुराधा नक्षत्र युक्तायाम्, विष्कम्भ योग, तैतुल करण, शतचीति पुण्यकले, कन्या सङ्क्रमण श्राद्धम्, तिल तर्पण रूपेण.",
          },
          te: {
            title: "పరాభవ పురట్టాసి 1, గురువారం, శతచీతి పుణ్యకాలం, పురట్టాసి మాస ప్రవేశ తర్పణం",
            sankalpam:
              "పరాభవ నామ సమ్వత్సరే, దక్షిణాయనే, వర్ష ఋతౌ, సింహ మాసే, శుక్ల పక్షే, షష్ఠ్యామ్ పుణ్య తిథౌ, గురు వాసర యుక్తాయామ్, అనురాధా నక్షత్ర యుక్తాయామ్, విష్కమ్భ యోగ, తైతుల కరణ, శతచీతి పుణ్యకలే, కన్యా సఙ్క్రమణ శ్రాద్ధమ్, తిల తర్పణ రూపేణ.",
          },
        },
      },
      {
        // Printed as "10-10-2025" in the issue; 10 October 2026 is the
        // Saturday that the day table itself lists as Puraṭṭāsi 23 amāvāsyai.
        date: "2026-10-10",
        title: "Parābhava Puraṭṭāsi 23, Saturday, amāvāsyā puṇya kālam",
        sankalpam:
          "Parābhava nāma samvatsare, dakṣiṇāyane, varṣa ṛtau, kanyā māse, kṛṣṇa pakṣe, amāvāsyāyām puṇya tithau, sthira vāsara yuktāyām, hasta nakṣatra yuktāyām, māhendra yoga, nāgava (catuṣpāda till 09.05) karaṇa, amāvāsyā puṇya kāla darśa śrāddham, tila tarpaṇa rūpeṇa.",
        translations: {
          ta: {
            title: "பராபவ புரட்டாசி 23, சனி, அமாவாஸ்யா புண்ய காலம்",
            sankalpam:
              "பராபவ நாம ஸம்வத்ஸரே, தக்ஷிணாயநே, வர்ஷ ருதௌ, கந்யா மாஸே, க்ருஷ்ண பக்ஷே, அமாவாஸ்யாயாம் புண்ய திதௌ, ஸ்திர வாஸர யுக்தாயாம், ஹஸ்த நக்ஷத்ர யுக்தாயாம், மாஹேந்த்ர யோக, நாகவ (சதுஷ்பாத 09.05 வரை) கரண, அமாவாஸ்யா புண்ய கால தர்ச ச்ராத்தம், தில தர்பண ரூபேண.",
          },
          kn: {
            title: "ಪರಾಭವ ಪುರಟ್ಟಾಸಿ 23, ಶನಿವಾರ, ಅಮಾವಾಸ್ಯಾ ಪುಣ್ಯ ಕಾಲಮ್",
            sankalpam:
              "ಪರಾಭವ ನಾಮ ಸಮ್ವತ್ಸರೇ, ದಕ್ಷಿಣಾಯನೇ, ವರ್ಷ ಋತೌ, ಕನ್ಯಾ ಮಾಸೇ, ಕೃಷ್ಣ ಪಕ್ಷೇ, ಅಮಾವಾಸ್ಯಾಯಾಮ್ ಪುಣ್ಯ ತಿಥೌ, ಸ್ಥಿರ ವಾಸರ ಯುಕ್ತಾಯಾಮ್, ಹಸ್ತ ನಕ್ಷತ್ರ ಯುಕ್ತಾಯಾಮ್, ಮಾಹೇನ್ದ್ರ ಯೋಗ, ನಾಗವ (ಚತುಷ್ಪಾದ 09.05 ವರೆಗೆ) ಕರಣ, ಅಮಾವಾಸ್ಯಾ ಪುಣ್ಯ ಕಾಲ ದರ್ಶ ಶ್ರಾದ್ಧಮ್, ತಿಲ ತರ್ಪಣ ರೂಪೇಣ.",
          },
          hi: {
            title: "पराभव पुरट्टासि 23, शनिवार, अमावास्या पुण्य कालम्",
            sankalpam:
              "पराभव नाम सम्वत्सरे, दक्षिणायने, वर्ष ऋतौ, कन्या मासे, कृष्ण पक्षे, अमावास्यायाम् पुण्य तिथौ, स्थिर वासर युक्तायाम्, हस्त नक्षत्र युक्तायाम्, माहेन्द्र योग, नागव (चतुष्पाद 09.05 तक) करण, अमावास्या पुण्य काल दर्श श्राद्धम्, तिल तर्पण रूपेण.",
          },
          te: {
            title: "పరాభవ పురట్టాసి 23, శనివారం, అమావాస్యా పుణ్య కాలం",
            sankalpam:
              "పరాభవ నామ సమ్వత్సరే, దక్షిణాయనే, వర్ష ఋతౌ, కన్యా మాసే, కృష్ణ పక్షే, అమావాస్యాయామ్ పుణ్య తిథౌ, స్థిర వాసర యుక్తాయామ్, హస్త నక్షత్ర యుక్తాయామ్, మాహేన్ద్ర యోగ, నాగవ (చతుష్పాద 09.05 వరకు) కరణ, అమావాస్యా పుణ్య కాల దర్శ శ్రాద్ధమ్, తిల తర్పణ రూపేణ.",
          },
        },
      },
      {
        date: "2026-10-18",
        title: "Parābhava Aippasi 1, Sunday, Aippasi māsa praveśa tarpaṇam, viśuva puṇya kālam",
        sankalpam:
          "Parābhava nāma samvatsare, dakṣiṇāyane, śarad ṛtau, tulā māse, śukla pakṣe, aṣṭamyām puṇya tithau, bhānu vāsara yuktāyām, pūrvāṣāḍhā nakṣatra yuktāyām, sukarma yoga, bhadra (vaṇija till 2.55) karaṇa, viśuva puṇya kale, tulā saṅkramaṇa śrāddham, tila tarpaṇa rūpeṇa.",
        translations: {
          ta: {
            title: "பராபவ ஐப்பசி 1, ஞாயிறு, ஐப்பசி மாஸ ப்ரவேச தர்ப்பணம், விசுவ புண்ய காலம்",
            sankalpam:
              "பராபவ நாம ஸம்வத்ஸரே, தக்ஷிணாயநே, சரத் ருதௌ, துலா மாஸே, சுக்ல பக்ஷே, அஷ்டம்யாம் புண்ய திதௌ, பாநு வாஸர யுக்தாயாம், பூர்வாஷாடா நக்ஷத்ர யுக்தாயாம், ஸுகர்ம யோக, பத்ர (வணிஜ 2.55 வரை) கரண, விசுவ புண்ய கலே, துலா ஸங்க்ரமண ச்ராத்தம், தில தர்பண ரூபேண.",
          },
          kn: {
            title: "ಪರಾಭವ ಐಪ್ಪಸಿ 1, ಭಾನುವಾರ, ಐಪ್ಪಸಿ ಮಾಸ ಪ್ರವೇಶ ತರ್ಪಣಮ್, ವಿಶುವ ಪುಣ್ಯ ಕಾಲಮ್",
            sankalpam:
              "ಪರಾಭವ ನಾಮ ಸಮ್ವತ್ಸರೇ, ದಕ್ಷಿಣಾಯನೇ, ಶರದ್ ಋತೌ, ತುಲಾ ಮಾಸೇ, ಶುಕ್ಲ ಪಕ್ಷೇ, ಅಷ್ಟಮ್ಯಾಮ್ ಪುಣ್ಯ ತಿಥೌ, ಭಾನು ವಾಸರ ಯುಕ್ತಾಯಾಮ್, ಪೂರ್ವಾಷಾಢಾ ನಕ್ಷತ್ರ ಯುಕ್ತಾಯಾಮ್, ಸುಕರ್ಮ ಯೋಗ, ಭದ್ರ (ವಣಿಜ 2.55 ವರೆಗೆ) ಕರಣ, ವಿಶುವ ಪುಣ್ಯ ಕಲೇ, ತುಲಾ ಸಙ್ಕ್ರಮಣ ಶ್ರಾದ್ಧಮ್, ತಿಲ ತರ್ಪಣ ರೂಪೇಣ.",
          },
          hi: {
            title: "पराभव ऐप्पसि 1, रविवार, ऐप्पसि मास प्रवेश तर्पणम्, विशुव पुण्य कालम्",
            sankalpam:
              "पराभव नाम सम्वत्सरे, दक्षिणायने, शरद् ऋतौ, तुला मासे, शुक्ल पक्षे, अष्टम्याम् पुण्य तिथौ, भानु वासर युक्तायाम्, पूर्वाषाढा नक्षत्र युक्तायाम्, सुकर्म योग, भद्र (वणिज 2.55 तक) करण, विशुव पुण्य कले, तुला सङ्क्रमण श्राद्धम्, तिल तर्पण रूपेण.",
          },
          te: {
            title: "పరాభవ ఐప్పసి 1, ఆదివారం, ఐప్పసి మాస ప్రవేశ తర్పణం, విశువ పుణ్య కాలం",
            sankalpam:
              "పరాభవ నామ సమ్వత్సరే, దక్షిణాయనే, శరద్ ఋతౌ, తులా మాసే, శుక్ల పక్షే, అష్టమ్యామ్ పుణ్య తిథౌ, భాను వాసర యుక్తాయామ్, పూర్వాషాఢా నక్షత్ర యుక్తాయామ్, సుకర్మ యోగ, భద్ర (వణిజ 2.55 వరకు) కరణ, విశువ పుణ్య కలే, తులా సఙ్క్రమణ శ్రాద్ధమ్, తిల తర్పణ రూపేణ.",
          },
        },
      },
    ],
  },
];

/** Every observance name used in `festival`, in each non-English language's script. */
const OBSERVANCE_LABELS: Record<string, Record<LanguageCode, string>> = {
  "Kanya Sukla Ashtami": { ta: "கன்யா சுக்ல அஷ்டமி", kn: "ಕನ್ಯಾ ಶುಕ್ಲ ಅಷ್ಟಮಿ", hi: "कन्या शुक्ल अष्टमी", te: "కన్యా శుక్ల అష్టమి" },
  "Kanya Sukla Saptami": { ta: "கன்யா சுக்ல ஸப்தமி", kn: "ಕನ್ಯಾ ಶುಕ್ಲ ಸಪ್ತಮಿ", hi: "कन्या शुक्ल सप्तमी", te: "కన్యా శుక్ల సప్తమి" },
  "Tula Sukla Ashtami": { ta: "துலா சுக்ல அஷ்டமி", kn: "ತುಲಾ ಶುಕ್ಲ ಅಷ್ಟಮಿ", hi: "तुला शुक्ल अष्टमी", te: "తులా శుక్ల అష్టమి" },
  "Sarva Ekadasi": { ta: "ஸர்வ ஏகாதசி", kn: "ಸರ್ವ ಏಕಾದಶಿ", hi: "सर्व एकादशी", te: "సర్వ ఏకాదశి" },
  "Sravana Vratam": { ta: "ஸ்ரவண வ்ரதம்", kn: "ಶ್ರವಣ ವ್ರತಮ್", hi: "श्रवण व्रतम्", te: "శ్రవణ వ్రతం" },
  "Sravana Dvadasi": { ta: "ஸ்ரவண த்வாதசி", kn: "ಶ್ರವಣ ದ್ವಾದಶಿ", hi: "श्रवण द्वादशी", te: "శ్రవణ ద్వాదశి" },
  Mahapradosham: { ta: "மஹாப்ரதோஷம்", kn: "ಮಹಾಪ್ರದೋಷಮ್", hi: "महाप्रदोषम्", te: "మహాప్రదోషం" },
  Mahabharani: { ta: "மஹாபரணி", kn: "ಮಹಾಭರಣಿ", hi: "महाभरणी", te: "మహాభరణి" },
  Mahavyatipatam: { ta: "மஹாவ்யதீபாதம்", kn: "ಮಹಾವ್ಯತೀಪಾತಮ್", hi: "महाव्यतीपातम्", te: "మహావ్యతీపాతం" },
  Madhyashtami: { ta: "மத்யாஷ்டமி", kn: "ಮಧ್ಯಾಷ್ಟಮಿ", hi: "मध्याष्टमी", te: "మధ్యాష్టమి" },
  "Commencement of Mahalaya Paksham": {
    ta: "மஹாளய பக்ஷ ஆரம்பம்",
    kn: "ಮಹಾಲಯ ಪಕ್ಷ ಆರಂಭ",
    hi: "महालय पक्ष आरम्भ",
    te: "మహాలయ పక్ష ఆరంభం",
  },
  "Sanyastha Mahalayam": { ta: "ஸந்யஸ்த மஹாளயம்", kn: "ಸಂನ್ಯಸ್ತ ಮಹಾಲಯಮ್", hi: "संन्यस्त महालयम्", te: "సన్న్యస్త మహాలయం" },
  "Sastrahata Mahalayam": { ta: "சஸ்த்ரஹத மஹாளயம்", kn: "ಶಸ್ತ್ರಹತ ಮಹಾಲಯಮ್", hi: "शस्त्रहत महालयम्", te: "శస్త్రహత మహాలయం" },
  "Sarva Mahalaya Amavasya": {
    ta: "ஸர்வ மஹாளய அமாவாசை",
    kn: "ಸರ್ವ ಮಹಾಲಯ ಅಮಾವಾಸ್ಯೆ",
    hi: "सर्व महालय अमावस्या",
    te: "సర్వ మహాలయ అమావాస్య",
  },
  "Commencement of Navaratri Puja": {
    ta: "நவராத்ரி பூஜை ஆரம்பம்",
    kn: "ನವರಾತ್ರಿ ಪೂಜಾ ಆರಂಭ",
    hi: "नवरात्रि पूजा आरम्भ",
    te: "నవరాత్రి పూజా ఆరంభం",
  },
  "Chandra Darsanam": { ta: "சந்த்ர தர்சனம்", kn: "ಚಂದ್ರ ದರ್ಶನಮ್", hi: "चन्द्र दर्शनम्", te: "చంద్ర దర్శనం" },
  "Maha Navami": { ta: "மஹா நவமி", kn: "ಮಹಾ ನವಮಿ", hi: "महा नवमी", te: "మహా నవమి" },
  "Vijaya Dasami": { ta: "விஜய தசமி", kn: "ವಿಜಯ ದಶಮಿ", hi: "विजय दशमी", te: "విజయ దశమి" },
  "Tula Ravi": { ta: "துலா ரவி", kn: "ತುಲಾ ರವಿ", hi: "तुला रवि", te: "తులా రవి" },
  "Visuva Punya Kalam": { ta: "விசுவ புண்ய காலம்", kn: "ವಿಶುವ ಪುಣ್ಯ ಕಾಲಮ್", hi: "विशुव पुण्य कालम्", te: "విశువ పుణ్య కాలం" },
  "Aippasi Masa Pravesa Tarpanam": {
    ta: "ஐப்பசி மாஸ ப்ரவேச தர்ப்பணம்",
    kn: "ಐಪ್ಪಸಿ ಮಾಸ ಪ್ರವೇಶ ತರ್ಪಣಮ್",
    hi: "ऐप्पसि मास प्रवेश तर्पणम्",
    te: "ఐప్పసి మాస ప్రవేశ తర్పణం",
  },
  "Commencement of Tula Snanam": {
    ta: "துலா ஸ்நானம் ஆரம்பம்",
    kn: "ತುಲಾ ಸ್ನಾನ ಆರಂಭ",
    hi: "तुला स्नान आरम्भ",
    te: "తులా స్నాన ఆరంభం",
  },
  "Svami Desikan Tirunakshatram": {
    ta: "ஸ்வாமி தேசிகன் திருநக்ஷத்திரம்",
    kn: "ಸ್ವಾಮಿ ದೇಶಿಕನ್ ತಿರುನಕ್ಷತ್ರಮ್",
    hi: "स्वामी देशिकन् तिरुनक्षत्रम्",
    te: "స్వామి దేశికన్ తిరునక్షత్రం",
  },
  "Srimad Akkur Andavan Sri Srinivasa Mahadesikan Tirunakshatram": {
    ta: "ஸ்ரீமத் ஆக்கூர் ஆண்டவன் ஸ்ரீ ஸ்ரீநிவாஸ மஹாதேசிகன் திருநக்ஷத்திரம்",
    kn: "ಶ್ರೀಮದ್ ಆಕ್ಕೂರ್ ಆಂಡವನ್ ಶ್ರೀ ಶ್ರೀನಿವಾಸ ಮಹಾದೇಶಿಕನ್ ತಿರುನಕ್ಷತ್ರಮ್",
    hi: "श्रीमद् आक्कूर् आण्डवन् श्री श्रीनिवास महादेशिकन् तिरुनक्षत्रम्",
    te: "శ్రీమద్ ఆక్కూర్ ఆండవన్ శ్రీ శ్రీనివాస మహాదేశికన్ తిరునక్షత్రం",
  },
  "Tirukkudantai Desikan Srigopalarya Mahadesikan Tirunakshatram": {
    ta: "திருக்குடந்தை தேசிகன் ஸ்ரீகோபாலார்ய மஹாதேசிகன் திருநக்ஷத்திரம்",
    kn: "ತಿರುಕ್ಕುಡಂದೈ ದೇಶಿಕನ್ ಶ್ರೀಗೋಪಾಲಾರ್ಯ ಮಹಾದೇಶಿಕನ್ ತಿರುನಕ್ಷತ್ರಮ್",
    hi: "तिरुक्कुडन्दै देशिकन् श्रीगोपालार्य महादेशिकन् तिरुनक्षत्रम्",
    te: "తిరుక్కుడందై దేశికన్ శ్రీగోపాలార్య మహాదేశికన్ తిరునక్షత్రం",
  },
  "Bhudattazhvar Tirunakshatram": {
    ta: "பூதத்தாழ்வார் திருநக்ஷத்திரம்",
    kn: "ಭೂತತ್ತಾಳ್ವಾರ್ ತಿರುನಕ್ಷತ್ರಮ್",
    hi: "भूतत्ताऴ्वार् तिरुनक्षत्रम्",
    te: "భూతత్తాళ్వార్ తిరునక్షత్రం",
  },
  "Peyazhvar Tirunakshatram": {
    ta: "பேயாழ்வார் திருநக்ஷத்திரம்",
    kn: "ಪೇಯಾಳ್ವಾರ್ ತಿರುನಕ್ಷತ್ರಮ್",
    hi: "पेयाऴ्वार् तिरुनक्षत्रम्",
    te: "పేయాళ్వార్ తిరునక్షత్రం",
  },
  "Srimad Tirutturaippundi Andavan Srinivasa Ramanuja Mahadesikan Tirunakshatram": {
    ta: "ஸ்ரீமத் திருத்துறைப்பூண்டி ஆண்டவன் ஸ்ரீநிவாஸ ராமானுஜ மஹாதேசிகன் திருநக்ஷத்திரம்",
    kn: "ಶ್ರೀಮದ್ ತಿರುತ್ತುರೈಪ್ಪೂಂಡಿ ಆಂಡವನ್ ಶ್ರೀನಿವಾಸ ರಾಮಾನುಜ ಮಹಾದೇಶಿಕನ್ ತಿರುನಕ್ಷತ್ರಮ್",
    hi: "श्रीमद् तिरुत्तुरैप्पूण्डि आण्डवन् श्रीनिवास रामानुज महादेशिकन् तिरुनक्षत्रम्",
    te: "శ్రీమద్ తిరుత్తురైప్పూండి ఆండవన్ శ్రీనివాస రామానుజ మహాదేశికన్ తిరునక్షత్రం",
  },
};

/** Whether `name` has an entry in OBSERVANCE_LABELS -- lets tests enforce that every observance translates. */
export function isKnownPadukaObservance(name: string): boolean {
  return name in OBSERVANCE_LABELS;
}

/** A day's `festival` in `language`; English (null) is returned as stored, and an unmapped name degrades to English, never blank. */
export function localizePadukaFestival(festival: string, language: LanguageCode | null): string {
  if (!language || !festival) return festival;
  return festival
    .split(", ")
    .map((name) => OBSERVANCE_LABELS[name]?.[language] ?? name)
    .join(", ");
}

/** The tarpaṇam as the sankalpam box shows it ("title: sankalpam"), in `language`'s script. */
export function localizePadukaTarpanam(tarpanam: PadukaTarpanam, language: LanguageCode | null): string {
  const { title, sankalpam } = language ? tarpanam.translations[language] : tarpanam;
  return `${title}: ${sankalpam}`;
}

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
