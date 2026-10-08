/**
 * The observed Sun at the reader's place: its position, and so the
 * moments of sunrise and sunset that every Panchangam day, kaalam and
 * observance is counted from. Pure arithmetic with no network, storage
 * or platform APIs, so the web build, the mobile app and node tests all
 * run the same code.
 *
 * The Sun's position follows Jean Meeus, "Astronomical Algorithms" (2nd
 * ed.), chapter 25 (about 0.01 degrees, a few seconds of sunrise). The
 * tithi, nakshatram and solar months themselves are reckoned the
 * traditional way, in panchangam-siddhanta.ts -- only sunrise and sunset
 * come from the observed Sun, as the tradition prescribes.
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
 * The instant of sunrise or sunset on the civil day that starts at
 * `dayStartMs` (epoch ms of local midnight), or null when the Sun
 * doesn't cross the horizon that day (polar day or night).
 *
 * Reckoned the classical way, as the traditional calendar does: find the
 * Sun's transit (local apparent noon), take the Sun's declination at
 * local civil noon, and step back (or forward) by the semi-diurnal arc
 * at 15° an hour of apparent solar time.
 */
export function sunEvent(dayStartMs: number, latitude: number, longitude: number, kind: "rise" | "set"): number | null {
  // Transit: start from 12:00 local mean solar time and iterate on the hour angle.
  const utcMidnight = Math.floor(dayStartMs / MS_PER_DAY) * MS_PER_DAY;
  let transit = utcMidnight + MS_PER_DAY / 2 - (longitude / 360) * MS_PER_DAY;
  while (transit < dayStartMs) transit += MS_PER_DAY;
  while (transit >= dayStartMs + MS_PER_DAY) transit -= MS_PER_DAY;
  for (let pass = 0; pass < 5; pass += 1) {
    const { rightAscension } = sunEquatorial(transit);
    const hourAngle = ((normalizeDegrees(greenwichSiderealTime(transit) + longitude - rightAscension) + 540) % 360) - 180;
    transit -= (hourAngle / 360.98564736629) * MS_PER_DAY;
    if (Math.abs(hourAngle) < 1e-6) break;
  }

  const { declination } = sunEquatorial(dayStartMs + MS_PER_DAY / 2);
  const cosH0 =
    (sinDeg(SUNRISE_ALTITUDE) - sinDeg(latitude) * sinDeg(declination)) / (cosDeg(latitude) * cosDeg(declination));
  if (cosH0 < -1 || cosH0 > 1) return null;
  const H0 = Math.acos(cosH0) / DEG;
  return transit + ((kind === "rise" ? -H0 : H0) / 360) * MS_PER_DAY;
}
