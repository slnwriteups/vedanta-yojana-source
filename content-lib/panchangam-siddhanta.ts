/**
 * The traditional (siddhantic) Sun and Moon the panchangam reckons
 * tithi, nakshatram and the solar months from -- the South Indian
 * Sri Vaishnava reckoning that Sri Ahobila Mutt's published calendar
 * follows, rather than modern positional astronomy.
 *
 * The model is the classical one:
 *
 *  - mean motions are the Surya Siddhanta's (revolutions per mahayuga
 *    of 4,320,000 years over 1,577,917,828 civil days: Sun 4,320,000,
 *    Moon 57,753,336, lunar apogee 488,203);
 *  - one manda (equation-of-centre) correction each for the Sun and the
 *    Moon, with Aryabhatan-sized epicycles (about 13½° and 31⅓°) and no
 *    evection, variation or other later lunar terms;
 *  - longitudes are nirayana (sidereal) in the tradition's own frame,
 *    the same zero point for the Sun's signs and the Moon's nakshatrams;
 *  - clock times omit the udayantara (the obliquity part of the
 *    equation of time), as siddhantic practice does.
 *
 * The epoch values, epicycle sizes and time terms were calibrated
 * against the Mutt's published Parābhava (2026–27) panchangam: 1,115
 * tithi/nakshatram transitions read to the second, and the year's
 * thirteen sankranti times. The model reproduces those transitions to
 * about a minute (94–96% within 3 minutes) and the sankrantis to under
 * a minute. Because the mean motions are the tradition's own, the model
 * carries forward to later years the way the tradition itself does.
 *
 * Differences from modern astronomy are expected and intentional: the
 * traditional Moon can stand up to ~3° from the true one, which moves a
 * tithi's end by up to several hours.
 *
 * Sunrise and sunset are not reckoned here -- the traditional calendar
 * takes them from the observed Sun at the reader's own place (see
 * panchangam-astronomy.ts).
 */

import { julianDay, normalizeDegrees } from "./panchangam-astronomy.ts";

const DEG = Math.PI / 180;

const CIVIL_DAYS_PER_MAHAYUGA = 1_577_917_828;
const SUN_RATE = (360 * 4_320_000) / CIVIL_DAYS_PER_MAHAYUGA;
const MOON_RATE = (360 * 57_753_336) / CIVIL_DAYS_PER_MAHAYUGA;
const MOON_APOGEE_RATE = (360 * 488_203) / CIVIL_DAYS_PER_MAHAYUGA;

/** Calibration epoch: JD 2461300.0 (2026-08-11 12:00 UT). */
const EPOCH_JD = 2461300.0;
// Sidereal (nirayana) mean longitudes at the epoch, degrees.
const SUN_MEAN_AT_EPOCH = 151.003_002_7;
const MOON_MEAN_AT_EPOCH = 209.249_678_4;
const MOON_APOGEE_AT_EPOCH = 246.876_963_0;
const SUN_APOGEE = 78.342_868_5;
// Manda epicycle circumferences (degrees of a 360° circle): at the
// apsides ("even") and at quadrature ("odd"), varying with |sin kendra|.
const SUN_EPICYCLE_EVEN = 13.497_745;
const SUN_EPICYCLE_ODD = 13.496_482;
const MOON_EPICYCLE_EVEN = 31.312_550;
const MOON_EPICYCLE_ODD = 31.331_704;
// Clock-time terms in minutes: the udayantara the tradition leaves out
// (semi-annual) and its residual annual term.
const TIME_SIN_2L = 9.853_936;
const TIME_COS_2L = -0.611_009;
const TIME_SIN_M = 3.906_433;
const TIME_COS_M = -0.025_309;

function sinDeg(angle: number): number {
  return Math.sin(angle * DEG);
}

/** Days since the epoch on the tradition's own time scale. */
function traditionalDays(ms: number): number {
  const jd = julianDay(ms);
  const t = (jd - 2451545) / 36525;
  const L = 280.46646 + 36000.76983 * t;
  const M = 357.52911 + 35999.05029 * t;
  const offsetMinutes =
    TIME_SIN_2L * sinDeg(2 * L) +
    TIME_COS_2L * Math.cos(2 * L * DEG) +
    TIME_SIN_M * sinDeg(M) +
    TIME_COS_M * Math.cos(M * DEG);
  return jd + offsetMinutes / 1440 - EPOCH_JD;
}

/** The manda-corrected (true) longitude from a mean longitude and its apogee. */
function manda(mean: number, apogee: number, epicycleEven: number, epicycleOdd: number): number {
  const kendra = mean - apogee;
  const epicycle = epicycleEven - (epicycleEven - epicycleOdd) * Math.abs(sinDeg(kendra));
  return normalizeDegrees(mean - Math.asin((epicycle / 360) * sinDeg(kendra)) / DEG);
}

/** The traditional true Sun, sidereal, degrees. */
export function traditionalSunLongitude(ms: number): number {
  const d = traditionalDays(ms);
  return manda(SUN_MEAN_AT_EPOCH + SUN_RATE * d, SUN_APOGEE, SUN_EPICYCLE_EVEN, SUN_EPICYCLE_ODD);
}

/** The traditional true Moon, sidereal, degrees. */
export function traditionalMoonLongitude(ms: number): number {
  const d = traditionalDays(ms);
  return manda(
    MOON_MEAN_AT_EPOCH + MOON_RATE * d,
    MOON_APOGEE_AT_EPOCH + MOON_APOGEE_RATE * d,
    MOON_EPICYCLE_EVEN,
    MOON_EPICYCLE_ODD
  );
}

/** Moon − Sun, 0..360: 12 degrees per tithi. */
export function traditionalElongation(ms: number): number {
  const d = traditionalDays(ms);
  const sun = manda(SUN_MEAN_AT_EPOCH + SUN_RATE * d, SUN_APOGEE, SUN_EPICYCLE_EVEN, SUN_EPICYCLE_ODD);
  const moon = manda(
    MOON_MEAN_AT_EPOCH + MOON_RATE * d,
    MOON_APOGEE_AT_EPOCH + MOON_APOGEE_RATE * d,
    MOON_EPICYCLE_EVEN,
    MOON_EPICYCLE_ODD
  );
  return normalizeDegrees(moon - sun);
}
