import * as Location from "expo-location";
import { readJSON, writeJSON } from "../storage.ts";

/**
 * Fetches today's Panchangam (Hindu lunar calendar) details published by
 * Sri Ahobila Mutt at https://ahobilamutt.org/online-calendar/.
 *
 * That page renders no Panchangam data in its own static HTML -- the
 * actual daily figures are computed by two backing Google App Engine
 * services the page embeds:
 *
 *   - an <iframe src="https://samdailycal-324121.uc.r.appspot.com/">
 *     (linked from the page's "Online Calendar" content) that itself
 *     calls a same-origin `/rpc?action=findDailycal&...` endpoint and
 *     injects the JSON-string HTML fragment it returns into the page;
 *   - the sibling "Ekadasi Calculator" page
 *     (https://ahobilamutt.org/online-calendar/'s "Ekadasi Calculator"
 *     menu entry) which embeds
 *     https://samekadasi-324123.uc.r.appspot.com/ekadasi, backed by its
 *     own `/rpc?action=findEkadasi&...` endpoint;
 *   - the sibling "Sankalpam" page (same nav menu, /sankalpam/) which
 *     embeds https://samekadasi-324123.uc.r.appspot.com/sankalpam --
 *     same app as the Ekadasi calculator, a different route -- backed
 *     by its own `/rpc?action=findSankalpam&...` endpoint. A Sankalpam
 *     is the formal Sanskrit time/place declaration recited before a
 *     ritual (year name, ayana, ritu, masa, paksha, tithi, vasara,
 *     nakshatra); SAM (Sri Ahobila Mutt) is this service's own name for
 *     it, matching the "SAM Daily Calendar" title on the daily-cal
 *     widget itself.
 *
 * All three were confirmed directly (fetched and read their JS) rather
 * than guessed: this module calls those RPC endpoints directly -- the
 * same requests the embedded widgets themselves make once a location is
 * known -- instead of trying to execute the widgets' own client-side JS
 * (not possible from a React Native fetch) or scraping a page that has
 * no Panchangam markup to scrape.
 *
 * Location: a Panchangam is genuinely location-dependent (tithi/
 * nakshatra transition times shift with longitude, sunrise/sunset with
 * both), so this uses the device's own real location (expo-location) --
 * the same real input the widgets themselves use once a visitor's
 * browser geolocates -- rather than assuming any one fixed city. Falls
 * back to LOCATION_UNAVAILABLE_FALLBACK (never a guessed city) if
 * location permission is denied or a fix can't be obtained.
 *

 * No HTML-parsing dependency: both endpoints return one short,
 * single-line HTML fragment in a fixed, verified-by-hand shape (not an
 * arbitrary page), so a general DOM parser would be more machinery than
 * the actual parsing need warrants -- plain tag-stripping/regexes below
 * are enough and keep this service dependency-free.
 */

const DAILY_CAL_ENDPOINT = "https://samdailycal-324121.uc.r.appspot.com/rpc";
const EKADASHI_ENDPOINT = "https://samekadasi-324123.uc.r.appspot.com/rpc";
// Same app as EKADASHI_ENDPOINT, different `action` -- confirmed against
// the live /sankalpam widget, not assumed from the Ekadasi one.
const SANKALPAM_ENDPOINT = "https://samekadasi-324123.uc.r.appspot.com/rpc";

const FETCH_TIMEOUT_MS = 8000;
const LOCATION_TIMEOUT_MS = 8000;

interface ResolvedLocation {
  city: string;
  lat: string;
  lng: string;
  timezone: string;
}

export interface PanchangamData {
  tithi: string;
  paksha: string;
  nakshatram: string;
  festival: string;
  upcomingEkadashiText: string;
  /** The full SAM Sankalpam declaration sentence for the current moment, or "" if unavailable. */
  sankalpamText: string;
}

/**
 * Returned when the network is unavailable or any endpoint's response
 * can't be parsed -- deliberately empty/placeholder values rather than a
 * fabricated tithi or festival, since presenting invented Panchangam
 * facts as real would be worse than admitting the data couldn't load.
 */
const OFFLINE_FALLBACK: PanchangamData = {
  tithi: "",
  paksha: "",
  nakshatram: "",
  festival: "",
  upcomingEkadashiText: "Panchangam unavailable offline",
  sankalpamText: "",
};

/** Distinct from OFFLINE_FALLBACK: the network is fine, but location permission was denied or no fix could be obtained -- never silently substitutes a guessed city. */
const LOCATION_UNAVAILABLE_FALLBACK: PanchangamData = {
  tithi: "",
  paksha: "",
  nakshatram: "",
  festival: "",
  upcomingEkadashiText: "Enable location access for today's Panchangam",
  sankalpamText: "",
};

const CACHE_KEY_PREFIX = "vy.calendar.panchangam.";

function isValidPanchangamData(value: unknown): value is PanchangamData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.tithi === "string" &&
    typeof candidate.paksha === "string" &&
    typeof candidate.nakshatram === "string" &&
    typeof candidate.festival === "string" &&
    typeof candidate.upcomingEkadashiText === "string" &&
    typeof candidate.sankalpamText === "string"
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * yyyy-mm-dd + coarse lat/lng, local device date -- scoped to "today AND
 * roughly where the device is" so a traveling reader gets a fresh
 * Panchangam for their new city rather than yesterday's location's
 * cached copy, while ordinary GPS jitter (a few hundred meters between
 * calls at the same desk) still hits the same cache entry. Rounded to
 * 2 decimal places (~1.1km) -- far finer than a Panchangam's own
 * location sensitivity actually needs.
 */
function cacheKeyFor(date: Date, location: ResolvedLocation): string {
  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const roundedLat = Number(location.lat).toFixed(2);
  const roundedLng = Number(location.lng).toFixed(2);
  return `${CACHE_KEY_PREFIX}${day}.${roundedLat},${roundedLng}`;
}

/**
 * Resolves the device's own real location for the Panchangam request --
 * requests foreground permission (a no-op prompt if already
 * granted/denied from a prior call), reads the last known fix if one is
 * cached by the OS (fast, no GPS wait) or otherwise requests a fresh
 * one, and reverse-geocodes it to a city name purely for the "For
 * {city}" cosmetic label the daily-cal response echoes back (the
 * Panchangam calculation itself only ever uses lat/lng/timezone).
 * Timezone is the DEVICE's own configured zone (Intl, not derived from
 * the coordinates) -- exactly what the Ahobila Mutt widget itself falls
 * back to when it can't otherwise determine one (its own
 * `browser_tz = Intl.DateTimeFormat().resolvedOptions().timeZone`).
 * Returns null (never a guessed city) if permission is denied or no fix
 * can be obtained.
 */
async function resolveLocation(): Promise<ResolvedLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return null;

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS));
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        timeoutPromise,
      ]));
    if (!position) return null;

    const { latitude, longitude } = position.coords;
    let city = "Your Location";
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      city = place?.city || place?.subregion || place?.region || city;
    } catch {
      // Reverse geocoding is cosmetic only (the "For {city}" label) -- a
      // failure here still lets the Panchangam itself resolve via coords.
    }

    return {
      city,
      lat: String(latitude),
      lng: String(longitude),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  } catch {
    return null;
  }
}

/** mm/dd/yyyy -- the exact format both RPC endpoints expect (verified against their own client-side `getDailyCalDate()`/date-field format). */
function formatDateParam(date: Date): string {
  return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}/${date.getFullYear()}`;
}

/** h:mm AM/PM -- the exact format findSankalpam's own form field expects (its placeholder: "9:43 AM"). A Sankalpam is time-specific (it names the tithi/nakshatra in force at a moment, not just a day), so this uses the actual current time rather than a fixed hour. */
function formatTimeParam(date: Date): string {
  const hours24 = date.getHours();
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${pad2(date.getMinutes())} ${period}`;
}

async function fetchRpcHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Panchangam request failed: ${response.status}`);
    const raw = await response.text();
    // Both endpoints respond with a JSON-encoded string (the HTML
    // fragment as its payload), not raw HTML -- confirmed directly
    // against both live endpoints.
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "string") throw new Error("Unexpected Panchangam response shape");
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

interface ParsedDailyCalendar {
  tithi: string;
  paksha: string;
  nakshatram: string;
  festival: string;
}

/**
 * Parses a findDailycal response, e.g.:
 * `<b>Yajur Upakarma</b><br/><i>s.chaturdasi 09:54/9-42  </br>dhanishta
 * 03:47*\/54-26  </i><br/>Sunrise: <i>06:01</i> Sunset: ...`
 *
 * The leading `<b>...</b>` is the day's festival/special observation
 * (empty -- `<b></b>` -- on an ordinary day). The first `<i>...</i>`
 * block holds the tithi and nakshatram together, separated by a
 * (malformed, but consistently present) `</br>` -- confirmed against
 * the live endpoint across a dozen dates. A tithi is either
 * "s."/"k." (Shukla/Krishna paksha) followed by its name and
 * end-time/duration, or -- for the two tithis that close out a whole
 * paksha -- a bare name with no prefix ("pournami" closes Shukla,
 * "amavasya" closes Krishna).
 */
function parseDailyCalendar(html: string): ParsedDailyCalendar | null {
  const festivalMatch = html.match(/^<b>(.*?)<\/b>/);
  const festival = festivalMatch ? stripTags(festivalMatch[1]) : "";

  const firstItalic = html.match(/<i>(.*?)<\/i>/);
  if (!firstItalic) return null;

  const [tithiRaw = "", nakshatramRaw = ""] = firstItalic[1].split(/<\/?br\/?>/i);
  const tithiText = stripTags(tithiRaw);
  const nakshatramText = stripTags(nakshatramRaw);
  if (!tithiText) return null;

  let paksha = "";
  let tithiName = "";
  const pakshaMatch = tithiText.match(/^([sk])\.(\S+)/i);
  if (pakshaMatch) {
    paksha = pakshaMatch[1].toLowerCase() === "s" ? "Shukla Paksha" : "Krishna Paksha";
    tithiName = capitalize(pakshaMatch[2]);
  } else {
    const nameMatch = tithiText.match(/^(\S+)/);
    const name = nameMatch ? nameMatch[1] : "";
    tithiName = capitalize(name);
    if (name.toLowerCase() === "pournami") paksha = "Shukla Paksha";
    else if (name.toLowerCase() === "amavasya") paksha = "Krishna Paksha";
  }
  if (!tithiName) return null;

  // Six of the 27 nakshatras (Phalguni, Ashadha, Bhadrapada) come back
  // "p."/"u." prefixed for their Purva/Uttara half -- the same
  // abbreviation shape as tithi's "s."/"k." paksha prefix, confirmed
  // against the live endpoint (e.g. "p.badra", "u.shada",
  // "p.phalguni"). Left unexpanded, this used to capitalize the whole
  // token verbatim ("P.badra") instead of "Purva Badra".
  const nakshatramPrefixMatch = nakshatramText.match(/^([pu])\.(\S+)/i);
  let nakshatram = "";
  if (nakshatramPrefixMatch) {
    const qualifier = nakshatramPrefixMatch[1].toLowerCase() === "p" ? "Purva" : "Uttara";
    nakshatram = `${qualifier} ${capitalize(nakshatramPrefixMatch[2])}`;
  } else {
    const nakshatramNameMatch = nakshatramText.match(/^(\S+)/);
    nakshatram = nakshatramNameMatch ? capitalize(nakshatramNameMatch[1]) : "";
  }

  return { tithi: tithiName, paksha, nakshatram, festival };
}

/**
 * Parses a findEkadasi response, e.g.:
 * `<p>Next Ekadasi for Chennai is on <b>Monday, 07th Sep 2026.</b><br/>
 * Perform <b>Dvadasi Paranai 06:01-08:27</b> on <b>08th Sep 2026</b>`
 *
 * Kept to just the first sentence (the next Ekadasi's day/date) --
 * the header banner this feeds is a single compact pill, not room for
 * the full Paranai (breaking-the-fast) instructions that follow.
 */
function parseUpcomingEkadashi(html: string): string {
  const text = stripTags(html);
  const firstSentence = text.split(/\.\s/)[0]?.trim();
  if (!firstSentence) return "";
  const withPeriod = firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;
  // Non-greedy `.+?`, not `\S+` -- most real city names are one word, but
  // some (a multi-word geocoded name) aren't, and `\S+` would silently fail
  // to match those, leaving the raw English sentence completely unprocessed.
  return withPeriod.replace(/^Next Ekadasi for .+? is on\s*/i, "Next Ekadasi: ");
}

/**
 * Parses a findSankalpam response, e.g.:
 * `<p>Sankalpam for Chennai on 27th Aug 2026<br/>At 10:00 AM IST and
 * valid through 03:47:54 AM of following day: <br/> <b>parAbhava</b>
 * nAma saMvathsare, <b>dakShiNAyaNe</b>, <br/><b>varSha</b> Ritau,<b>
 * siMha</b> mAse,<br/> <b>shukla</b> pakShe, <b>pournamAsyAm</b> shubha
 * tithau,<br/> <b>guru</b> vAsara, <b>shraviShThA (dhaniShThA)</b>
 * nakShatra yuktAyAm...<br/>Sunrise: <i>06:01:06</i><br/> Sunset:
 * <i>18:19:55</i><br/>`
 *
 * Everything from "Sunrise:" onward is dropped (sunrise/sunset already
 * surface via the daily-cal parse above); what remains is detagged and
 * whitespace-collapsed into the one flowing declaration sentence, kept
 * whole and unabridged -- unlike the Ekadasi banner text, a Sankalpam is
 * recited in full, so it is never truncated to a single clause.
 */
function parseSankalpam(html: string): string {
  const withoutSunTimes = html.split(/Sunrise:/i)[0] ?? html;
  return stripTags(withoutSunTimes);
}

function buildDailyCalUrl(location: ResolvedLocation, dateParam: string): string {
  const params = new URLSearchParams({
    action: "findDailycal",
    cityfld: location.city,
    latfld: location.lat,
    lngfld: location.lng,
    tzfld: location.timezone,
    obsce: "",
    Dailycaldatestr: dateParam,
    time: String(Date.now()),
  });
  return `${DAILY_CAL_ENDPOINT}?${params.toString()}`;
}

function buildEkadashiUrl(location: ResolvedLocation, dateParam: string): string {
  const params = new URLSearchParams({
    action: "findEkadasi",
    cityfld: location.city,
    latfld: location.lat,
    lngfld: location.lng,
    tzfld: location.timezone,
    startdatestr: dateParam,
    time: String(Date.now()),
  });
  return `${EKADASHI_ENDPOINT}?${params.toString()}`;
}

function buildSankalpamUrl(location: ResolvedLocation, dateParam: string, timeParam: string): string {
  const params = new URLSearchParams({
    action: "findSankalpam",
    cityfld: location.city,
    latfld: location.lat,
    lngfld: location.lng,
    tzfld: location.timezone,
    sankalpamdatestr: dateParam,
    sankalpamtimestr: timeParam,
    time: String(Date.now()),
  });
  return `${SANKALPAM_ENDPOINT}?${params.toString()}`;
}

/**
 * Fetches (or returns the same-day-and-place cached copy of) today's
 * Panchangam for the device's own real location. Cached per calendar
 * day + coarse location (storage.ts's best-effort AsyncStorage wrapper)
 * so re-opening Home repeatedly in one day/place never re-hits the
 * network or re-prompts for location; falls back to
 * LOCATION_UNAVAILABLE_FALLBACK if location permission is denied/no fix
 * is available, or OFFLINE_FALLBACK on a network/parse failure -- never
 * a fabricated Panchangam, and neither fallback is cached, so the next
 * call retries once location/connectivity is available.
 */
export async function fetchAhobilaPanchangam(date: Date = new Date()): Promise<PanchangamData> {
  const location = await resolveLocation();
  if (!location) return LOCATION_UNAVAILABLE_FALLBACK;

  const cacheKey = cacheKeyFor(date, location);
  const cached = await readJSON(cacheKey, isValidPanchangamData);
  if (cached) return cached;

  try {
    const dateParam = formatDateParam(date);
    const timeParam = formatTimeParam(date);
    const [dailyHtml, ekadashiHtml, sankalpamHtml] = await Promise.all([
      fetchRpcHtml(buildDailyCalUrl(location, dateParam)),
      fetchRpcHtml(buildEkadashiUrl(location, dateParam)),
      fetchRpcHtml(buildSankalpamUrl(location, dateParam, timeParam)),
    ]);

    const parsedDaily = parseDailyCalendar(dailyHtml);
    if (!parsedDaily) throw new Error("Unrecognized daily calendar response format");

    const data: PanchangamData = {
      ...parsedDaily,
      upcomingEkadashiText: parseUpcomingEkadashi(ekadashiHtml),
      sankalpamText: parseSankalpam(sankalpamHtml),
    };

    void writeJSON(cacheKey, data);
    return data;
  } catch {
    return OFFLINE_FALLBACK;
  }
}
