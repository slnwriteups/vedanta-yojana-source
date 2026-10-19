# Panchangam validation

How far the Panchangam can be trusted, worldwide and over the years: what
Sri Ahobila Mutt's online calendar is known to do, the exact model the app
computes with, how the two compare across 18 places, and how each
observance is decided. Companion documents:
[PANCHANGAM.md](PANCHANGAM.md) (how it works),
[PANCHANGAM-COMPARISON.md](PANCHANGAM-COMPARISON.md) (Srirangam, three
sources side by side) and
[PANCHANGAM-VALIDATION-MATRIX.md](PANCHANGAM-VALIDATION-MATRIX.md) (the
generated worldwide tables).

Nothing here is used at runtime: the app computes everything on the device
and calls no calendar service.

## Sources, and what each may be used for

| Source | Used for | Not used for |
|---|---|---|
| Sri Ahobila Mutt's published Parābhava calendar for **Chennai** (2026–27) | Calibration: the model's epoch longitudes, epicycles and time terms were fitted to its 1,115 transition times and 13 sankramanams | Validation (it would only show the fit) |
| The Mutt's online calendar for **17 other places** (`tests/content/fixtures/ahobila-worldwide-2026-27.json`) | Independent validation of the engine at other longitudes, latitudes, clocks and hemispheres | Calibration |
| The Mutt's online calendar for **Srirangam**, 68 days (`tests/content/fixtures/ahobila-srirangam-2026-09-18_11-24.json`) | Validation, and the three-way comparison with the Pādukā | Calibration |
| Srimad Andavan Ashramam's **Sri Ranganātha Pādukā**, Sep and Oct 2026 (`content-lib/paduka-panchangam.ts`) | The authority for observances; validation of the elements at sunrise and its printed karana ends | Astronomy calibration |
| A **modern ephemeris** (Meeus, with the Lahiri ayanāṃśa) | An independent astronomical benchmark | Deciding any observance |

Every validation place shares the calibration's *dates*: the Mutt's online
calendar only covers 15 Mar 2026 – 1 May 2027. So the matrix validates
the engine across the world, not across years; later years are discussed
under [Over the years](#over-the-years).

## Sri Ahobila Mutt's online calendar

Recovered from the app's former client (`git show fc45b33^:lib/panchangam-service.ts`,
removed when the Panchangam moved on-device), and checked again on
19 Oct 2026 with a handful of requests. Nothing below is used by the app.

### Confirmed behaviour

| | |
|---|---|
| **Endpoints** | Daily view: `https://samdailycal-324121.uc.r.appspot.com/rpc`, `action=findDailycal`. Next Ekadasi and Sankalpam: `https://samekadasi-324123.uc.r.appspot.com/rpc`, `action=findEkadasi` / `action=findSankalpam`. Plain GET with query parameters. |
| **Parameters** | `cityfld` (a name, only echoed back in the Sankalpam sentence), `latfld`, `lngfld` (decimal degrees), `tzfld` (an IANA zone), the date as `MM/DD/YYYY` (`Dailycaldatestr`, `startdatestr`, `sankalpamdatestr`), `sankalpamtimestr` (`h:mm AM`), `obsce` (empty), `time` (a cache-buster). |
| **Response** | A JSON string holding an HTML fragment; no CORS header, so a browser can't read it directly (the app once used a proxy for this; it is gone). |
| **Date range** | Only 15 Mar 2026 – 1 May 2027: other dates answer "Sorry, only have data from 03/15/2026 to 05/01/2027!". |
| **Time zone** | `tzfld` sets the clock every time is printed in; the same place in `UTC` gives Chennai's sunrise as 00:32 (06:02 IST). Daylight saving is applied (New York prints EDT on 31 Oct 2026, EST on 2 Nov). |
| **Location** | Latitude and longitude change sunrise, sunset, the kaalams and every sunrise-based decision; the tithi, nakshatram and karana *instants* are the same everywhere (across all 18 places, each published end converts to the same UTC instant). |
| **Daily view fields** | The day's observances (`<b>`); each tithi and nakshatram with its end; sunrise; sunset; Rahu Kaalam, Yamagandam, Gulikan; the sraddha tithi of each solar month; "Yogam"; each karana with its span. |
| **Time notation** | `HH:MM` on the place's clock, then `/n-v`: nāzhigai and vināzhigai after the day's sunrise (60-0 is the next sunrise). `*` marks a time after midnight; `Full` an element running past the next sunrise. An element running past the next sunrise is sometimes printed as ending at it instead (Srirangam, 21 Sep 2026: Uttara Ashadha "06:07*/59-58", which the next day shows running to 07:43). |
| **Precision** | Whole minutes in the daily view; seconds in the Sankalpam (sunrise "07:16:23" there, "07:16" in the daily view). |
| **"Yogam"** | Weekday combinations, abbreviated (Su, Si, Am, Na, Va, Ma, Da, and "vasara-nakshatra ashubam" / "vasara-thithi ashubam"), never one of the 27 yogas. The daily view does not publish the 27-yoga cycle. |
| **Karana** | Every karana end in the middle of a tithi is the midpoint in time of the tithi's own printed start and end, to within 0.5 min (68 of 68 at Srirangam; see [Karana](#karana)). |
| **Next Ekadasi** | "Next Ekadasi for {city} is on {weekday, date}. Perform Dvadasi Paranai {start-end} on {date}". |
| **Sankalpam** | "Sankalpam for {city} on {date} At {time} {zone} and valid through {time}[ of following day]:" then the declaration (samvatsara, ayana, ritu, solar māsa, paksha, tithi, vāsara, nakshatram), then sunrise and sunset to the second. |

### Inferred, not confirmed

- **How it computes.** Reproducing its outputs to a minute does not reveal its
  algorithm. The fixed date range and location-independent instants suggest
  a precomputed table of transitions with sunrise-based decisions made per
  request, but that is an inference.
- **Its astronomical model.** Not stated anywhere found; see
  [Which traditional system](#which-traditional-system).
- **The meaning of the "Yogam" abbreviations.** Not decoded; not used.

### Not reproduced

- The app's 2026 notes record the Mutt's times from mid-January 2027 as
  shifted by exactly 5 h 30 min. On 19 Oct 2026 its Chennai figures for
  1 Feb 2027 (Krishna Dasami till 12:32) agree with the engine and the
  published calendar: the shift is not present now.

## The model

`content-lib/panchangam-siddhanta.ts`, `panchangam-astronomy.ts` and
`panchangam-engine.ts`. All instants are UTC epoch milliseconds; a place's
clock is applied only to read them out.

| Element | Model |
|---|---|
| **Sun and Moon** | Mean longitudes advancing at the Surya Siddhanta's rates (revolutions per 4,320,000-year mahayuga over 1,577,917,828 civil days: Sun 4,320,000, Moon 57,753,336, lunar apogee 488,203). One manda correction each, `true = mean − asin((p/360)·sin(mean − apogee))`, with the epicycle `p` varying between its value at the apsides and at quadrature with \|sin(kendra)\| (Sun ≈ 13.50°, Moon ≈ 31.31–31.33°). No evection, variation or later lunar terms. Solar apogee fixed at 78.34°. |
| **Fitted constants** | 3 epoch mean longitudes (Sun, Moon, lunar apogee) at JD 2461300.0, the solar apogee, 4 epicycle sizes, and 4 clock-time terms (semi-annual and annual, in minutes) that stand for the udayantara the tradition leaves out. All 12 were fitted to the Mutt's Chennai 2026–27 times. |
| **Sidereal frame** | The tradition's own: longitudes are nirayana by construction (the epoch values are sidereal); no separate ayanāṃśa is applied. The Sun's signs and the Moon's nakshatrams share one zero point. |
| **Tithi** | Moon − Sun, 12° each: tithi `k` runs while the elongation is in [12k, 12k + 12). Boundaries are solved by Newton iteration to 10⁻⁷°. |
| **Nakshatram** | The Moon's sidereal longitude, 13°20′ each. |
| **Yoga** | Sun + Moon (sidereal), 13°20′ each, 27 names. |
| **Karana** | Each tithi halved in time: the first karana from its start to its midpoint, the second from its midpoint to its end; Kimstughna first, the seven movable karanas eight times, then Shakuni, Chatushpada, Nagava. See [Karana](#karana). |
| **Sunrise, sunset** | The *observed* Sun (Meeus ch. 25, apparent longitude with nutation and aberration; ΔT from Espenak–Meeus): the centre of the disc on the true horizon, no refraction; the transit found by iteration, the semi-diurnal arc from the declination at local noon. Within a minute of Swiss Ephemeris up to about 50° latitude, and of the Mutt's printed times at all 18 places. Where the Sun neither rises nor sets, its transits stand in, as the Mutt takes them: under the midnight sun, sunrise at its lowest point and sunset at the next (a day all daylight); in polar night, both at its highest point. None is displayed. |
| **Solar ingress** | The traditional Sun reaching a multiple of 30°, solved like a tithi. |
| **Tamil month** | The Sun's sign at the civil day's sunset (a month begins on the day whose sunset follows the sankramanam). Tirunakshatrams are reckoned in the month of the sankramanam's punyakalam day. |
| **Lunar month** | Amanta: named from the Sun's sign at the new moon that opens it, plus one; a month with no sankramanam is adhika. |
| **Samvatsara** | (solar year − 1987) mod 60, the solar year turning at Mesha sankramanam. |
| **Day** | Sunrise to sunrise; a day's tithi and nakshatram are those at its sunrise. |
| **Ekadasi** | The Ekadasi first seen at sunrise is kept that day, unless Dasami is still running at arunodaya (96 min before sunrise; viddha), the Ekadasi also holds the next sunrise, or the following Dvadasi holds two sunrises (vyañjulī mahādvādaśī) -- then the next day. An Ekadasi seeing no sunrise (kshaya) is kept on the Dasami-to-Dvadasi day. |
| **Pradosham** | Trayodasi at sunset; when it holds two sunsets, the later -- if it runs on at least half a nāzhigai (12 min) past it; when no sunset qualifies, the evening it begins. The half-nāzhigai is inferred from the Mutt's published days, not stated (see [Worldwide](#worldwide)). |
| **Dvadasi Paranai** | From sunrise, or the end of Ekadasi, or the end of Hari Vasara (the first quarter of Dvadasi), whichever is latest, to the end of the first fifth of the daylight; "Alpa" when Dvadasi ends sooner. |

### Karana

Classical definitions make a karana half a tithi; the usual modern
computation takes that as 6° of elongation. The published calendars
divide the tithi in **time** instead, which falls up to 6 minutes from
the 6° point because the Moon's speed changes:

- **Sri Ahobila Mutt:** every one of its 68 mid-tithi karana ends at
  Srirangam is the midpoint of its own printed tithi start and end
  within 0.5 min. It prints whole minutes, so a 0.5-minute residual is
  exactly what rounding (or truncating) both ends and the midpoint
  allows; the convention is the time midpoint, not a rounding artefact
  of the 6° one, which misses by up to 6 minutes.
- **The Ashramam:** one printed karana end can tell the two apart (10 Oct
  2026, 09.05 nāzhigai = 09:45) and it agrees with the time midpoint
  (the 6° point is 09:41). One data point: consistent, not established.

The engine follows the published practice. This is a deliberate
compatibility choice: a calendar reader comparing the app with either
maṭha's calendar sees the same karana times.

### Which traditional system

Neither maṭha states its method in any source found. The model was
fitted to the Mutt's published times, so calling it "the Mutt's method"
is an inference from agreement. What the numbers support:

- Both maṭhas use a **traditional** reckoning, not a modern ephemeris: the
  Ashramam's two printed karana ends are 1 and 3 minutes from the engine
  and 20 and 71 minutes from the modern Moon with Lahiri; the Mutt's 13
  sankramanams in 2026–27 are within a minute of the engine and about
  5½ hours from Lahiri.
- **Which** traditional system (a siddhanta, a vākya table, a karaṇa
  text) cannot be told from a year's agreement: systems built on the
  same mean motions agree closely over months.

### Over the years

The engine against a modern ephemeris (Meeus Moon and Sun, Lahiri),
2020–2045, every tithi end and sankramanam:

| Year | Tithi end, median \|Δ\| | Tithi end, 95th percentile | Tithi end, largest | Sankramanam, mean Δ |
|---|---|---|---|---|
| 2020 | 128 min | 344 min | 410 min | +292 min |
| 2026 | 105 min | 328 min | 401 min | +323 min |
| 2035 | 98 min | 321 min | 398 min | +347 min |
| 2045 | 111 min | 322 min | 405 min | +389 min |

- **Tithi, nakshatram:** the traditional Moon differs from the real one by
  up to about 6½ hours at a tithi's end, by design, and the spread is the
  same in every year: the difference is bounded and periodic, with no
  accumulating error.
- **Sankramanam:** the traditional Sun drifts later against Lahiri by about
  3.9 minutes a year, as the Surya Siddhanta year (365.258756 days) is
  0.0024 day longer than the sidereal year. That is the tradition's own
  drift, not an error, *if* the maṭhas keep using these mean motions:
  only their future calendars can confirm it. A Tamil month start moves
  by a day only when a sankramanam lies within these few minutes of
  sunset.
- **What the 12 fitted constants assume:** that the next years' published
  calendars come from the same system. Each new year's published calendar
  should be compared when it appears (`scripts/panchangam-comparison.ts`
  and `scripts/panchangam-validation.ts` take new fixtures).

## Observances: basis and place

Three things are kept apart: the **instant** (a tithi's end, the same
moment everywhere), the **local date and time** it falls on at the reader's
place, and the **observance date** the applicable tradition gives it. Each
observance the calendar shows carries its basis and, where it is not the
reader's own, the place its date belongs to (`Observance.basis`,
`Observance.referencePlace` in `content-lib/panchangam-observances.ts`).

### Basis

| Basis | Meaning | Observances now |
|---|---|---|
| **Published** by the Ashramam | Printed in the Pādukā for that date | Every Pādukā observance, on the dates a transcribed issue covers (18 Sep – 24 Nov 2026) |
| **Ashramam rule** | Calculated by a rule the Ashramam states | None: the Pādukā prints dates, not rules |
| **Provisional rule** | Calculated by a documented rule inferred from the Ashramam's dates | None adopted. Candidate: Sravana Vratam on the day whose sunset Sravanam holds (fits 3 of 3 published days; too few to adopt) |
| **General rule** | Calculated by the engine's general Sri Vaishnava rules, verified against Sri Ahobila Mutt's calendar | Everything else: Ekadasi, Paranai, Pradosham, Amavasya Tarpanam, sankramanams, tirunakshatrams, star days, festivals, lunar months -- outside the covered dates for those the Pādukā also prints |

Where the Ashramam and the Mutt differ on the covered dates, the published
date is kept and the difference documented
([PANCHANGAM-COMPARISON.md](PANCHANGAM-COMPARISON.md#observances)):
Navaratri begins (11 Oct, not 12) and Sravana Vratam (22 Sep, 19 Oct, not
23 Sep, 20 Oct). For other years the general rule applies until the
Ashramam's is established. More Pādukā issues are the way to establish
it; the e-Edition is by subscription, and no other issue could be reached.

### Place

| Kind | Decided by | Where it holds | Examples |
|---|---|---|---|
| **Astronomical, location-dependent** | An instant against the place's own sunrise, sunset, aparahna or arunodaya | Computed for the reader's place | Ekadasi, Dvadasi Paranai, Pradosham, Amavasya Tarpanam, sankramanam day and punyakalam, tirunakshatrams, Sravanam/Rohini/Swathi, lunar month starts, Ugadi |
| **Religious rule** | A stated rule applied to the place's own day | Computed for the reader's place | None stated by the Ashramam yet (see Basis) |
| **Published, tied to a reference place** | The Ashramam's printed date | Srirangam, and India (the Ashramam publishes one calendar on Indian time) | Chandra Darsanam, Mahavyatipatam, the Mahalayams, Tula Snanam, Masa Pravesa Tarpanams, the Andavans' tirunakshatrams, and the published dates of observances both carry |
| **Fixed commemorative date** | A civil date | Everywhere | None in the calendar |

On Indian time the Pādukā's dates are the place's own. On any other clock:

- the engine decides every observance it computes, for the place's own
  sunrise -- the Pādukā's dates do not move them;
- the Ashramam's own published observances are still shown on their
  published dates, and the calendar says so: "Sri Ranganātha Pādukā
  (dates as published for Srirangam)". A reader in New York is never
  shown a Srirangam date as though it were calculated for New York.

## Sankalpam

The Sankalpam is declared for the present moment at the reader's place, on
its clock and in its time zone, and holds until the tithi, nakshatram,
solar month or (at sunrise) weekday it names changes. The Home screen
recomputes it:

| When | How | Checked by |
|---|---|---|
| The tithi changes | At the engine's `currentUntil` | `panchangam-engine.test.ts`: 18 Oct 2026, Saptami ending 07:17 |
| The nakshatram changes | Likewise | 19 Oct 2026, Bengaluru, Uttara Ashadha ending 14:50:57 |
| The solar month changes | Likewise | 18 Oct 2026, the Sun entering Tula at 06:21, "kanyā māse" → "tulā māse" |
| The local date changes | `currentUntil` is never later than the place's next midnight | New York, 23:30 EDT, and Bengaluru, 23:30 IST |
| The app or tab resumes | Always recomputed, and the location read again | Code: `HomeDashboardClient.tsx`, `mobile/app/(tabs)/index.tsx` |
| The reader changes the place | Recomputed for the new place | Code: the same effect depends on the chosen place |

Its wording is unchanged: the declaration as the Mutt's calendar gives it.
The Ashramam's Tarpaṇa Saṅkalpams (which also name the yoga and karana and
the rite) are shown as published on their days and are not extended to the
daily Sankalpam.

## Reliability

- **Local only:** the engine, the observance layer and the Pādukā data
  are bundled; no calendar service is called. The only network request is
  the optional place-name lookup.
- **One calculation for every platform:** web, Android and iOS import the
  same `content-lib` modules; their copies of the labels and UI strings
  are kept identical by `tests/app/panchangam-consistency.test.ts`.
- **Saved places offline:** a chosen city is stored on the device with its
  coordinates and time zone, and the city list is bundled.
- **Own location's time zone:** taken from the coordinates (see
  [PANCHANGAM.md](PANCHANGAM.md#choosing-a-city)), not only the device clock.

## Worldwide

The engine against Sri Ahobila Mutt's calendar at 18 places
(`scripts/panchangam-validation.ts`; every table in
[PANCHANGAM-VALIDATION-MATRIX.md](PANCHANGAM-VALIDATION-MATRIX.md), and
held by `tests/content/panchangam-worldwide.test.ts`).

### Places and dates

- **Places:** Bengaluru, Srirangam, Chennai (calibration), Mumbai; Raxaul
  and Birgunj, either side of the India–Nepal border (+5:30 / +5:45);
  Kathmandu; Singapore and Quito (equator); Tokyo; London; New York; Los
  Angeles; Sydney; Auckland; Reykjavik and Anchorage (above 60°); Tromsø
  (inside the Arctic Circle: midnight sun and polar night).
- **Dates:** 109 for every place, chosen to test what is hard: every
  Ekadasi of the year and the next day, each sankramanam, every day with
  a tithi or nakshatram change within 40 minutes of sunrise, each
  daylight-saving change in both hemispheres (Europe, the US, Australia,
  New Zealand) and the solstices; plus, at six places across the
  longitudes (Chennai, London, New York, Los Angeles, Sydney, Tokyo),
  every Pradosham with the days either side. 2,206 place-days in all,
  with 429 Ekadasi days, 479 Paranai days and 402 Pradosham days
  published.
- **Not covered:** leap years and other years. The Mutt publishes 15 Mar
  2026 – 1 May 2027 only; 29 Feb is handled by the calendar arithmetic
  (`dayNumberOf`) and not checked against any publication.

### Results, independent places (17)

| Element | Compared | Within 1 min | Within 2 min | Within 5 min | Largest |
|---|---|---|---|---|---|
| Sunrise | 2,027 | 100% | 100% | 100% | 1 min |
| Sunset | 2,027 | 100% | 100% | 100% | 1 min |
| Tithi end | 2,134 | 56% | 82% | 100% | 5 min |
| Nakshatram end | 2,062 | 69% | 91% | 100% | 4 min |
| Karana end | 4,248 | 57% | 84% | 99.9% | 61 min (see below) |
| Dvadasi Paranai bounds | 864 | 94% | 97% | 99.8% | 288 min (see below) |
| Sankramanam time | 181 | 85% | 100% | 100% | 2 min |

Every published end names the same element as the engine's (no
"unmatched"); every instant is compared in UTC. The calibration place,
Chennai, sits in the same ranges: its fit does not stand out, so the
constants were not tuned to it at the others' expense.

Of the observances decided per place, at every place and date compared:

- **Ekadasi day, Paranai day:** all agree, except the Mutt's first day
  (15–16 Mar 2026, where its calendar can't see the day before), one
  Śravaṇa Dvādaśī (below) and one transition a minute from the midnight-sun
  "sunrise" at Tromsø.
- **Pradosham:** all 1,360 judged days agree, after the change below.
- **Sankramanam:** every day and time within 2 minutes.
- **Elements at sunrise:** all agree except three transitions 0, 1 and 3
  minutes from sunrise (Bengaluru, Kathmandu, Tokyo).

### What the matrix changed

- **Pradosham.** At Chennai, "Trayodasi at sunset, the later of two"
  always agreed. Elsewhere it didn't: at Los Angeles on 29–30 Mar 2026 the
  Mutt keeps the evening Trayodasi *begins* (50 min after sunset), not the
  next, whose sunset Trayodasi holds for only 9.6 minutes. Measured in the
  Mutt's own printed times, it keeps the later sunset when Trayodasi runs
  on 30 vināzhigai (12 min, Auckland 24 Oct 2026) or more, and the earlier
  at 26 (Srirangam, 4 Feb 2027) or 24 (Los Angeles): the threshold lies in
  (26, 30] vināzhigai, and the engine takes half a nāzhigai. Before:
  1,355 of 1,360 Pradosham judgements agreed; after: 1,360.
- **Polar days.** The engine took 06:00 and 18:00 for a day without sunrise;
  the Mutt takes the Sun's transits (above), which moved Tromsø's
  Pradosham of 26 Jun 2026 to the right day.

### Differences that are the published calendar's

- **Karana on the US daylight-saving day** (14 Mar 2027; New York, Los
  Angeles, Anchorage): the Mutt's karana ends are an hour from the
  midpoints of its own tithis, and fall on round hours: wall-clock
  arithmetic across the clock change. Its tithi ends that day agree with
  the engine.
- **Paranai under the midnight sun** (Tromsø, 28 May and 12 Jun 2026): the
  Mutt prints a zero-length window ("00:41-00:41"), though its own day is
  all daylight; the engine gives the first fifth of that day. The starts
  agree.
- **Sunrise under the midnight sun and in polar night:** the Mutt prints
  the transit as "Sunrise"; the engine reckons from the same moment but
  shows no sunrise, as the Sun does not rise (30 days at Tromsø).
- **Its first day,** 15 Mar 2026 (above).

### Earlier reports: London, Sydney, New York

The year-long comparison recorded in [PANCHANGAM.md](PANCHANGAM.md)
(London 409/412 days, Sydney 411, New York's observance list 402/412)
attributed its differences to the range's first day, transitions within
a minute of sunrise, Sri Jayanthi at Sydney and US-only notices. That data
was not kept. In this matrix, London, Sydney and New York show only the
first-day differences and none near sunrise; their Pradosham days,
which the old rule decided differently at some longitudes, now all agree.
Sri Jayanthi at Sydney is not among the dates chosen and remains as
reported.

### Remaining uncertainty

- **Śravaṇa Dvādaśī.** At Auckland on 23 Sep 2026 the Mutt keeps
  "Sravana Dvadasi Vratam" and no Paranai; at the other 17 places, the
  same day has a Paranai. Śravaṇam ran 24 nāzhigai 48 vināzhigai past
  sunrise there, 20-52 at Sydney (Paranai kept). One case: the rule (a
  Vijayā Mahādvādaśī) is not established, and the engine keeps the Paranai.
- **The Pradosham threshold** rests on five cases near it; another year's
  calendar should be checked against it.
- **Precision.** About half of all transition times agree to the minute and
  all within 5; a transition within that of sunrise can put a day's tithi
  or nakshatram, and so an observance, a day apart from the published one
  (3 of 2,206 place-days here).
