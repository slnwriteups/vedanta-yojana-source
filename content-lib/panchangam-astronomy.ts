/**
 * The astronomy underneath the Panchangam: where the Sun and Moon are at
 * a given instant, and when the Sun rises and sets at a given place.
 * Pure arithmetic with no network, storage or platform APIs, so the web
 * build, the mobile app and node tests all run the same code.
 *
 * Positions follow the standard published series in Jean Meeus,
 * "Astronomical Algorithms" (2nd ed.): the Sun from chapter 25 (about
 * 0.01 degrees) and the Moon from chapter 47's main periodic terms
 * (about 0.003 degrees). The Moon moves roughly half a degree an hour,
 * so tithi and nakshatram transitions land within a minute or two.
 * Sidereal (nirayana) longitudes use the Lahiri (Chitrapaksha)
 * ayanamsa, the Government of India standard most South Indian
 * panchangams follow.
 *
 * Instants are plain epoch milliseconds (UTC) throughout; turning them
 * into a reader's local clock is panchangam-engine.ts's job.
 */

const DEG = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
const JD_UNIX_EPOCH = 2440587.5;
const J2000 = 2451545.0;

export function normalizeDegrees(angle: number): number {
  const result = angle % 360;
  return result < 0 ? result + 360 : result;
}

function sinDeg(angle: number): number {
  return Math.sin(angle * DEG);
}

function cosDeg(angle: number): number {
  return Math.cos(angle * DEG);
}

/** Julian Day (UT) of an epoch-millisecond instant. */
export function julianDay(ms: number): number {
  return ms / MS_PER_DAY + JD_UNIX_EPOCH;
}

/** ΔT = TT − UT in seconds (Espenak & Meeus polynomial for 2005–2050, a smooth extrapolation outside). */
function deltaTSeconds(jd: number): number {
  const y = 2000 + (jd - J2000) / 365.25;
  const t = y - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
}

/** Julian centuries of Terrestrial Time since J2000.0. */
function centuriesTT(ms: number): number {
  const jd = julianDay(ms);
  return (jd + deltaTSeconds(jd) / 86400 - J2000) / 36525;
}

/** Nutation in longitude (degrees) and the true obliquity of the ecliptic (degrees). */
function nutationAndObliquity(T: number): { deltaPsi: number; epsilon: number } {
  const omega = 125.04452 - 1934.136261 * T;
  const sunMeanLong = 280.4665 + 36000.7698 * T;
  const moonMeanLong = 218.3165 + 481267.8813 * T;
  const deltaPsiArcsec =
    -17.2 * sinDeg(omega) - 1.32 * sinDeg(2 * sunMeanLong) - 0.23 * sinDeg(2 * moonMeanLong) + 0.21 * sinDeg(2 * omega);
  const deltaEpsArcsec =
    9.2 * cosDeg(omega) + 0.57 * cosDeg(2 * sunMeanLong) + 0.1 * cosDeg(2 * moonMeanLong) - 0.09 * cosDeg(2 * omega);
  const meanObliquity = 23.4392911 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
  return { deltaPsi: deltaPsiArcsec / 3600, epsilon: meanObliquity + deltaEpsArcsec / 3600 };
}

/** Apparent geocentric ecliptic longitude of the Sun (tropical, degrees). */
export function sunLongitude(ms: number): number {
  const T = centuriesTT(ms);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * sinDeg(M) +
    (0.019993 - 0.000101 * T) * sinDeg(2 * M) +
    0.000289 * sinDeg(3 * M);
  const omega = 125.04 - 1934.136 * T;
  return normalizeDegrees(L0 + C - 0.00569 - 0.00478 * sinDeg(omega));
}

/**
 * Meeus table 47.A, longitude column: multiples of D, M, M', F and the
 * sine coefficient in millionths of a degree.
 */
const MOON_LONGITUDE_TERMS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 0, 1, 0, 6288774],
  [2, 0, -1, 0, 1274027],
  [2, 0, 0, 0, 658314],
  [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116],
  [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793],
  [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322],
  [2, -1, 0, 0, 45758],
  [0, 1, -1, 0, -40923],
  [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383],
  [2, 0, 0, -2, 15327],
  [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675],
  [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548],
  [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766],
  [1, 0, -1, 0, -5163],
  [1, 1, 0, 0, 4987],
  [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994],
  [4, 0, 0, 0, 3861],
  [2, 0, -3, 0, 3665],
  [0, 1, -2, 0, -2689],
  [2, 0, -1, 2, -2602],
  [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348],
  [2, -2, 0, 0, 2236],
  [0, 1, 2, 0, -2120],
  [0, 2, 0, 0, -2069],
  [2, -2, -1, 0, 2048],
  [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595],
  [4, -1, -1, 0, 1215],
  [0, 0, 2, 2, -1110],
  [3, 0, -1, 0, -892],
  [2, 1, 1, 0, -810],
  [4, -1, -2, 0, 759],
  [0, 2, -1, 0, -713],
  [2, 2, -1, 0, -700],
  [2, 1, -2, 0, 691],
  [2, -1, 0, -2, 596],
  [4, 0, 1, 0, 549],
  [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520],
  [1, 0, -2, 0, -487],
  [2, 1, 0, -2, -399],
  [0, 0, 2, -2, -381],
  [1, 1, 1, 0, 351],
  [3, 0, -2, 0, -340],
  [4, 0, -3, 0, 330],
  [2, -1, 2, 0, 327],
  [0, 2, 1, 0, -323],
  [1, 1, -1, 0, 299],
  [2, 0, 3, 0, 294],
];

/** Apparent geocentric ecliptic longitude of the Moon (tropical, degrees). */
export function moonLongitude(ms: number): number {
  const T = centuriesTT(ms);
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.29 * T;

  let sum = 0;
  for (const [d, m, mp, f, coefficient] of MOON_LONGITUDE_TERMS) {
    const eccentricity = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sum += coefficient * eccentricity * sinDeg(d * D + m * M + mp * Mp + f * F);
  }
  sum += 3958 * sinDeg(A1) + 1962 * sinDeg(Lp - F) + 318 * sinDeg(A2);

  const { deltaPsi } = nutationAndObliquity(T);
  return normalizeDegrees(Lp + sum / 1e6 + deltaPsi);
}

/**
 * Lahiri ayanamsa (degrees): its defined value at J2000.0 advanced by
 * the IAU general precession in longitude.
 */
export function lahiriAyanamsa(ms: number): number {
  const T = centuriesTT(ms);
  return 23.857092 + (5028.796195 * T + 1.1054348 * T * T) / 3600;
}

export function siderealSunLongitude(ms: number): number {
  return normalizeDegrees(sunLongitude(ms) - lahiriAyanamsa(ms));
}

export function siderealMoonLongitude(ms: number): number {
  return normalizeDegrees(moonLongitude(ms) - lahiriAyanamsa(ms));
}

/** Moon − Sun, 0..360: 12 degrees per tithi. Ayanamsa cancels out. */
export function lunarElongation(ms: number): number {
  return normalizeDegrees(moonLongitude(ms) - sunLongitude(ms));
}

/** Greenwich mean sidereal time (degrees). */
function greenwichSiderealTime(ms: number): number {
  const jd = julianDay(ms);
  const T = (jd - J2000) / 36525;
  return normalizeDegrees(280.46061837 + 360.98564736629 * (jd - J2000) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

function sunEquatorial(ms: number): { rightAscension: number; declination: number } {
  const T = centuriesTT(ms);
  const lambda = sunLongitude(ms);
  const { epsilon } = nutationAndObliquity(T);
  const rightAscension = normalizeDegrees(Math.atan2(cosDeg(epsilon) * sinDeg(lambda), cosDeg(lambda)) / DEG);
  const declination = Math.asin(sinDeg(epsilon) * sinDeg(lambda)) / DEG;
  return { rightAscension, declination };
}

/**
 * Sunrise and sunset are taken when the centre of the Sun's disc is on
 * the true horizon, with no allowance for refraction -- the traditional
 * panchangam convention (Surya Siddhanta), a few minutes later at
 * sunrise and earlier at sunset than the upper-limb, refracted times
 * almanacs print.
 */
const SUNRISE_ALTITUDE = 0;

/**
 * The instant of sunrise or sunset nearest local apparent noon of the
 * civil day that starts at `dayStartMs` (epoch ms of local midnight), or
 * null when the Sun doesn't cross the horizon that day (polar day or
 * night). Iterates on the hour angle; four passes settle to well under
 * a second.
 */
export function sunEvent(dayStartMs: number, latitude: number, longitude: number, kind: "rise" | "set"): number | null {
  // Local apparent noon is close to 12:00 local mean solar time; start a
  // quarter-day either side of it and walk to the exact crossing.
  const utcMidnight = Math.floor(dayStartMs / MS_PER_DAY) * MS_PER_DAY;
  let noon = utcMidnight + MS_PER_DAY / 2 - (longitude / 360) * MS_PER_DAY;
  // Keep the estimate inside the requested local day.
  while (noon < dayStartMs) noon += MS_PER_DAY;
  while (noon >= dayStartMs + MS_PER_DAY) noon -= MS_PER_DAY;

  let t = noon + (kind === "rise" ? -0.25 : 0.25) * MS_PER_DAY;
  for (let pass = 0; pass < 6; pass += 1) {
    const { rightAscension, declination } = sunEquatorial(t);
    const cosH0 =
      (sinDeg(SUNRISE_ALTITUDE) - sinDeg(latitude) * sinDeg(declination)) / (cosDeg(latitude) * cosDeg(declination));
    if (cosH0 < -1 || cosH0 > 1) return null;
    const H0 = Math.acos(cosH0) / DEG;
    const targetHourAngle = kind === "rise" ? -H0 : H0;
    const hourAngle = normalizeDegrees(greenwichSiderealTime(t) + longitude - rightAscension);
    let correction = targetHourAngle - hourAngle;
    correction = ((correction + 540) % 360) - 180;
    t += (correction / 360.98564736629) * MS_PER_DAY;
    if (Math.abs(correction) < 1e-5) break;
  }
  return t;
}
