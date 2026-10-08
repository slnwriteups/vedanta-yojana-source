# Panchangam

How the daily Panchangam on the Home screen (web and Android) is computed,
which tradition it follows, how it was verified, and how to keep it current.

## Summary

- **Computed on the device.** Tithi, nakshatram, sunrise/sunset, Rahu Kaalam,
  Yamagandam, Gulika Kaalam, the day's observances, the next Ekadasi and the
  Sankalpam are all calculated in the browser or the app. No calendar service
  is called, so it works offline once the device knows where it is. The only
  network request is the optional place-name lookup (see
  [privacy-policy.html](privacy-policy.html)).
- **Traditional Sri Vaishnava reckoning.** It follows the reckoning of the
  calendar Sri Ahobila Mutt publishes, not modern positional astronomy. The two
  can differ by a few hours at a tithi or nakshatram ending, and the app
  deliberately follows the tradition.
- **Worldwide.** Every rule is applied to the reader's own sunrise, location and
  clock, so the calendar is correct wherever the reader is, not only in India.

## Code

| File | What it does |
|---|---|
| `content-lib/panchangam-siddhanta.ts` | The traditional Sun and Moon that tithi, nakshatram and the solar months are reckoned from |
| `content-lib/panchangam-astronomy.ts` | The observed Sun at the reader's place: sunrise and sunset |
| `content-lib/panchangam-engine.ts` | Days, tithi/nakshatram and their end times, months, kaalams, Ekadasi, observances, the Sankalpam |
| `content-lib/paduka-panchangam.ts` | The Sri Ranganātha Pādukā journal's monthly Pañcāṅgam, transcribed (see [Monthly update](#monthly-update-sri-ranganatha-paduka)) |
| `lib/panchangam-service.ts`, `mobile/services/panchangamService.ts` | Get the reader's location (web / Android) and call the engine |
| `lib/panchangam-labels.ts`, `mobile/panchangam-labels.ts` | Tamil, Kannada, Hindi and Telugu labels |
| `tests/content/panchangam-engine.test.ts` | Checks against the published calendar, and the worldwide checks |

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

- **The day:** runs sunrise to sunrise. Its tithi and nakshatram are those in
  force at its sunrise.
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
| Tithi at sunset (the later day if two) | Pradosham |
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

### Sankalpam

The Sankalpam sentence names the reader's place, the present moment and the
reader's own time zone ("IST", "EDT", …). It runs: samvatsara, ayana, ritu,
solar māsa, paksha, tithi, vāsara, nakshatram. It holds until the tithi,
nakshatram, solar month or (at sunrise) weekday next changes.

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

All 37 transcribed days agree: paksha, tithi and nakshatram.

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
  sunrise at all, sun-based rows are blank.

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

Observances both calendars carry (Ekadasi, Pradosham, the Āzhvārs, Swami
Desikan, …) are shown once. Only the Ashramam's own (names containing
"Andavan" or "Mahadesikan") are added from the journal.
