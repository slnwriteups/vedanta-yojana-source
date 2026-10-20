# Panchangam

How the daily Panchangam on the Home screen (web and Android) is computed,
which tradition it follows, how it was verified, and how to keep it current.

## Summary

- **Computed on the device.** Tithi, nakshatram, yoga, karana, sunrise/sunset,
  Rahu Kaalam, Yamagandam, Gulika Kaalam, the day's observances, the next
  Ekadasi and the Sankalpam are all calculated in the browser or the app. No calendar service
  is called, so it works offline once the device knows where it is. The only
  network request is the optional place-name lookup (see
  [privacy-policy.html](privacy-policy.html)).
- **Traditional Sri Vaishnava reckoning.** It follows a traditional
  (siddhantic) model of the Sun and Moon, not modern positional astronomy;
  the two can differ by minutes to hours at a tithi or nakshatram ending.
  Neither maṭha documents its method in any source found: the model was
  fitted to Sri Ahobila Mutt's published times, and the Ashramam's own
  printed times agree with it and not with a modern ephemeris. That both
  use a traditional reckoning is shown by the numbers; which traditional
  system is inferred, not documented (see
  [PANCHANGAM-COMPARISON.md](PANCHANGAM-COMPARISON.md#two-questions-of-method)).
- **The Ashramam is the authority for observances.** Every observance
  Srirangam Srimad Andavan Ashramam publishes in its Sri Ranganātha Pādukā
  Panchangam is shown on its published date, merged with the engine's own
  list with each observance's source shown (see
  [Observances and their sources](#observances-and-their-sources)).
- **Worldwide.** Every rule is applied to the reader's own sunrise, location and
  clock, so the calendar is correct wherever the reader is, not only in India.
- **Any city.** Instead of their own location, a reader can choose a city
  ("Change" on the Panchangam card). The Panchangam is then computed for that
  city, on that city's clock, with a "Times are in IST" note when its clock
  differs from the device's. The choice is saved on the device; see
  [Choosing a city](#choosing-a-city).

## Code

| File | What it does |
|---|---|
| `content-lib/panchangam-siddhanta.ts` | The traditional Sun and Moon that tithi, nakshatram and the solar months are reckoned from |
| `content-lib/panchangam-astronomy.ts` | The observed Sun at the reader's place: sunrise and sunset |
| `content-lib/panchangam-engine.ts` | Days, tithi/nakshatram/yoga/karana and their end times, months, kaalams, Ekadasi, observances, the Sankalpam |
| `content-lib/panchangam-place.ts` | A chosen city: its type, label and the check on a saved value |
| `content-lib/panchangam-places.ts`, `content-lib/panchangam-places-data.ts` | The bundled city list (generated), the search over it, and the time zone at a location fix |
| `mobile/services/panchangamPlaceStore.ts`, `lib/panchangam-place-store.ts` | The saved choice, shared by the Home header and the calendar card |
| `content-lib/paduka-panchangam.ts` | The Sri Ranganātha Pādukā journal's monthly Pañcāṅgam, transcribed (see [Monthly update](#monthly-update-sri-ranganatha-paduka)) |
| `lib/panchangam-service.ts`, `mobile/services/panchangamService.ts` | Get the reader's location (web / Android) and call the engine |
| `lib/panchangam-labels.ts`, `mobile/panchangam-labels.ts` | Tamil, Kannada, Hindi and Telugu labels |
| `tests/content/panchangam-engine.test.ts` | Checks against the published calendars, and the worldwide checks |
| `scripts/panchangam-comparison.ts`, `tests/content/fixtures/ahobila-srirangam-*.json` | The three-way comparison for Srirangam ([PANCHANGAM-COMPARISON.md](PANCHANGAM-COMPARISON.md)) and the published values it uses |

## The reckoning

### Tithi, nakshatram and the solar months

These follow the classical (siddhantic) model:

- **Mean motions:** Surya Siddhanta mean motions for the Sun, the Moon and the
  lunar apogee.
- **Corrections:** one *manda* (equation-of-centre) correction each, with
  Aryabhatan-sized epicycles. There is no evection or variation, which are later
  lunar corrections.
- **Longitudes:** nirayana (sidereal), in the tradition's own frame. The Sun's
  signs and the Moon's nakshatrams share one zero point.
- **Clock times:** these leave out the *udayantara* (the obliquity part of the
  equation of time), as siddhantic practice does.

The constants were calibrated against Sri Ahobila Mutt's published Parābhava
(2026–27) calendar: 1,115 tithi/nakshatram endings read to the second, plus the
year's 13 sankrantis. The model's moon mean motion came out equal to the Surya
Siddhanta value, which confirms the system.

### Sunrise, sunset and kaalams

- **Sunrise and sunset:** taken when the centre of the Sun's disc is on the true
  horizon, with no allowance for refraction (the traditional convention). They
  are computed the classical way, from the Sun's declination at local noon.
- **Kaalams:** each is an eighth of the daylight in whole minutes, counted from
  sunrise, with the last eighth running to sunset.
- **Near the poles:** a sunset or kaalam that falls after midnight is shown with
  "(+1)". On days with no sunrise at all (polar day or night), these rows are
  left blank rather than guessed.

### Days and months

- **Yoga and karana:** the yoga is the Sun's and Moon's longitudes added,
  in 27 parts; the karana is half a tithi, halved in time (the midpoint
  between its start and end). Sri Ahobila Mutt's calendar demonstrably
  divides it so (all 68 of its karana ends checked); the Ashramam's one
  printed karana end that can tell the methods apart agrees. The names
  follow the Pādukā's spellings (Mahendra, Taitula, Bhadra, Nagava).
- **The day:** runs sunrise to sunrise. Its tithi and nakshatram are those in
  force at its sunrise. When the tithi or nakshatram changes before the next
  sunrise, it is shown with each change and its time ("Krishna Paksha
  Trayodasi till 10:41 PM, then Chaturdasi"); on a kshaya day, when one
  begins and ends between two sunrises, both changes are shown.
- **Lunar months:** amanta, named from the Sun's sign at the new moon that opens
  them. A month with no sankranti is *adhika*, and the month that follows it is
  *nija*.
- **Tamil months:** begin on the day whose sunset follows the sankranti. The
  samvatsara changes at Mesha sankranti.

### Ekadasi

The fast follows the Vaishnava rules:

- An Ekadasi touched by Dasami at arunodaya (96 minutes before sunrise) moves to
  the next day.
- So does an Ekadasi that holds two sunrises.
- When Dvadasi holds two sunrises (*vyañjulī mahādvādaśī*), the fast moves to
  that Dvadasi.
- An Ekadasi that sees no sunrise is fasted on Dvadasi.

Dvadasi Paranai runs from sunrise, or from the end of Ekadasi or of Hari Vasara
(the first quarter of Dvadasi), whichever is later, to the end of the first
fifth of the day. It is marked *Alpa* when Dvadasi ends sooner.

### Observances and their day rules

Each observance is kept by its own traditional rule. All rules use the reader's
local sunrise, sunset and clock.

| Rule | Used for |
|---|---|
| Tithi at sunrise (if the tithi sees no sunrise, the day it begins) | most tithi festivals, lunar month starts |
| Tithi at sunset (the later day if two, if it runs half a nāzhigai past it; else the evening it begins) | Pradosham |
| Tithi at arunodaya (the later day if two) | Deepavali |
| Tithi covering the most of aparahna (the 4th fifth of the day) | Amavasya Tarpanam, Mahalaya Paksham/Amavasya, Madhyashtami, Gayatri Japam, Ashtaka, Anvashtaka, Aradhanams |
| Holds sunrise for 12 *nazhigai* (4h48m), else the day before | tirunakshatrams, Yajur Upakarma, Chitra Pournami |
| Holds sunrise for 6 *nazhigai* (2h24m), else the day before | monthly Sravanam / Rohini / Swathi, Ugadi |
| First evening in Ashvina Shukla Dvitiya | Navaratri Pooja Begins |

When a nakshatram falls twice in one Tamil month, its tirunakshatram is kept on
the second occurrence. For tirunakshatrams, the Tamil month changes on the
sankranti's punyakalam day.

The observances shown are:

- **Tirunakshatrams:** the Āzhvārs, about 40 Sri Vaishnava acharyas, and all 46
  Azhagiyasingars (Sri Ahobila Mutt's Jeeyars), with their Aradhanams and
  Ashrama Sweekarams.
- **Ekadasis**, including Kaisika, Vaikunta and Bhishma, with each Dvadasi
  Paranai.
- **Pradosham and Amavasya Tarpanam.**
- **Monthly star days:** Sravanam, Rohini and Swathi.
- **Month starts:** lunar months (with Adhika/Nija) and sankrantis with their
  times and punyakalam.
- **Festivals and seasonal days:** the major festivals, and the
  Margazhi/Thai days (Koodarai Vellum, Vanga Kadal, Bhogi, Kanu).

The full list is the `FESTIVAL_NAMES` vocabulary in `panchangam-engine.ts`.

### Observances and their sources

The engine's list (its rules, computed from the astronomy) and the
Ashramam's published Pādukā observances are kept apart and merged for
display by `content-lib/panchangam-observances.ts`:

- **Both carry it:** shown once, under the Ashramam's name ("Sarva
  Ekadasi", "Mahapradosham"), with both sources, and with any detail only
  the engine has (a sankramanam's time). `EQUIVALENTS` pairs the names.
- **Only the Ashramam publishes it** (Chandra Darsanam, Mahavyatipatam,
  the Mahalayams, the Tula Snanam days, its acharyas' tirunakshatrams, …):
  shown on its published date, and only on dates a transcribed issue
  covers. Nothing is carried to years the Ashramam hasn't published.
- **The Ashramam's date decides** (`PUBLISHED_DATE_GOVERNS`): Navaratri
  begins and Sravana Vratam, whose published 2026 days differ from the
  engine's rule (Sri Ahobila Mutt's). On covered dates the engine's own
  day is not shown; other years keep the engine's rule until the
  Ashramam's is established.
- **Only the engine computes it** (Azhagiyasingar tirunakshatrams,
  Dvadasi Paranai, the monthly star days, lunar month starts, …): shown,
  marked as calculated. So is an Ekadasi the transcribed Pādukā doesn't
  list (22 Oct 2026), until the printed page settles it.
- **Away from Indian time** the Pādukā's dates are not the place's: the
  engine, computing for the place's own sunrise, decides the observances
  both carry, and only the Ashramam's own are added from the Pādukā.

The Ashramam's published observances carry no source line. Beneath
observances the engine calculated, the calendar says "Calculated"; when both
kinds are shown, "*" marks the calculated ones and the note reads
"* Calculated".

### Sankalpam

The Sankalpam sentence names the reader's place, the present moment and the
reader's own time zone ("IST", "EDT", …). It runs: samvatsara, ayana, ritu,
solar māsa, paksha, tithi, vāsara, nakshatram. It holds until the tithi,
nakshatram, solar month or (at sunrise) weekday next changes, and the Home
screen recomputes it then (and at midnight), so a screen left open never
shows an expired Sankalpam as the present one.

It does not name the yoga and karana. The Ashramam's Tarpaṇa Saṅkalpams
do ("viṣkambha yoga, taitula karaṇa"), but its daily wording has not been
established, and a Tarpaṇa form is not taken as the wording for every rite.

## Verification

### Against Sri Ahobila Mutt's published calendar

The published calendar covers 15 Mar 2026 – 1 May 2027 (412 days). It was
compared day by day for five places:

| Place | Tithi & nakshatram at sunrise | Sunrise/sunset/kaalams to the minute | Observance list identical |
|---|---|---|---|
| Chennai | 412 / 412 | ~98% | 410 / 412 |
| Singapore | 412 / 412 | ~98% | 409 / 412 |
| London | 409 / 412 | ~92% | 408 / 412 |
| Sydney | 411 / 412 | ~99% | 407 / 412 |
| New York | 412 / 412 | ~96% | 402 / 412 |

Tithi and nakshatram endings agree within a minute on most days, and almost
always within 3 minutes. Dvadasi Paranai windows and sankranti times agree to
within a minute or two.

The remaining differences fall into four groups:

- the first day of the published range;
- transitions within a minute of sunrise;
- Sri Jayanthi in Sydney, where the published dates for different cities follow
  no single rule;
- US-only notices on the published calendar (daylight saving, eclipses), which
  are not reproduced.

### Against the Sri Ranganātha Pādukā journal

All 68 transcribed days (18 Sep - 24 Nov 2026) agree: paksha, tithi and
nakshatram at sunrise. The yoga and karana named in its three Tarpaṇa
Saṅkalpams agree, and its two printed karana ends -- nāzhigai after
sunrise, not clock times -- agree to the minute. Observance by observance,
with Sri Ahobila Mutt's calendar for the same days, see
[PANCHANGAM-COMPARISON.md](PANCHANGAM-COMPARISON.md).

### Worldwide

Checked offline (`tests/content/panchangam-engine.test.ts`, plus a wider
29-city run):

- **Sunrise and sunset:** compared with Swiss Ephemeris, within 1 minute from
  the equator to about 50° latitude and within 2 minutes up to 65° (Oslo,
  Helsinki, Anchorage, Reykjavik). Inside the Arctic Circle (e.g. Tromsø), up to
  about 9 minutes around the midnight-sun weeks. Days without sunrise are
  identified correctly.
- **A full year in every city:** no failures, the same 24 Ekadasis, each yearly
  observance kept exactly once, and kaalams always inside daylight. This held
  across every time zone from UTC−10 (Honolulu) to UTC+14 (Kiritimati),
  including UTC+5:45 (Kathmandu) and both hemispheres' daylight-saving rules.
- **Dates abroad:** an observance falls on the same date as in Chennai, or a day
  either side, because the local sunrise decides the day. This is the same
  pattern the published calendars for other cities show.

### Known limits

- **Future years:** the published calendar covers one year at a time. The model
  uses the tradition's own mean motions, so it carries to later years, but each
  new year's published calendar should be compared when it appears.
- **Above about 65° latitude:** sunrise times are less exact in summer. With no
  sunrise at all, sun-based rows are blank, and the day is reckoned from the
  Sun's transits, as Sri Ahobila Mutt's calendar does.
- **Worldwide validation:** 18 places, 2,206 place-days, against the Mutt's
  calendar; see [PANCHANGAM-VALIDATION.md](PANCHANGAM-VALIDATION.md).

## Monthly update (Sri Ranganātha Pādukā)

Each month's issue of Sri Ranganātha Pādukā (English e-Edition) carries a
Pañcāṅga Saṅgraham and Tarpaṇa Saṅkalpams. These add the Srirangam Srimad
Andavan Ashramam's own observances (its Andavans' and acharyas'
tirunakshatrams) to the Home calendar, and show the Tarpaṇa Saṅkalpam in the
Sankalpam box.

To add an issue:

1. Append the issue to `PADUKA_PANCHANGAM_ISSUES` in
   `content-lib/paduka-panchangam.ts`. Give each day its `date`, `paksha`,
   `tithi`, `nakshatram` (the ones at sunrise, spelled as the existing entries
   are) and `festival`. Give each Tarpaṇa Saṅkalpam its title, text and the
   Tamil/Kannada/Hindi/Telugu forms.
2. Add any new observance name to `OBSERVANCE_LABELS` in the same file. A test
   fails if one is missing.
3. Run `npm run test:content`. It checks the new days against the engine as well.

Every observance in the issue is shown on its date (see
[Observances and their sources](#observances-and-their-sources)). A new
observance name must also be classified in
`content-lib/panchangam-observances.ts`: paired in `EQUIVALENTS` with the
engine's name for the same observance, or added to
`ASHRAMAM_ONLY_OBSERVANCES`. A test fails until it is, so a new name can
never be shown twice under two names. Then re-run
`node scripts/panchangam-comparison.ts` to update the comparison.

## Choosing a city

The city list is bundled, not looked up online, so choosing a city works
offline and sends nothing anywhere.

- **Contents:** 16,831 places from [GeoNames](https://www.geonames.org)
  (CC BY 4.0, credited in the picker). That is every Indian town of 5,000+
  people, places of 50,000+ elsewhere, and six smaller Sri Vaishnava
  pilgrimage towns (Srirangam, Melukote, Ahobilam, Naimisharanya,
  Tirukkannapuram, Tirukkoshtiyur). Each has its coordinates and time zone.
- **Search:** exact names first, then names starting with what was typed,
  then names with a word starting with it. Within each, Indian places come
  first, then larger places. Former names (Bangalore, Madras, Trichy, …)
  find the current one, diacritics are ignored, and "Springfield, Illinois"
  narrows by region or country.
- **Size:** the list is about 570 KB and is loaded only when the picker
  opens: a separate chunk on the website, a dynamic import in the app.
- **Your own location's time zone:** the same list decides the time zone for
  a location fix. The device's own zone is kept when a place within 150 km
  keeps that clock (right on both sides of a border such as India-Nepal);
  otherwise the nearest place's zone is used, as for a traveller whose phone
  is still on home time. On the website the answer is cached by coarse
  location, so the list loads once per place.
- **Regenerating:** download `cities15000.zip`, `cities5000.zip`, `IN.zip`,
  `admin1CodesASCII.txt` and `countryInfo.txt` from
  https://download.geonames.org/export/dump/, unzip them into one folder,
  and run `node scripts/build-panchangam-places.ts <folder>`.

