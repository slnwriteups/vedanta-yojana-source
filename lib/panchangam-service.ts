import { readJSON, writeJSON } from "./storage.ts";

/**
 * Web port of mobile/services/panchangamService.ts. Fetches today's
 * Panchangam (Hindu lunar calendar) details published by Sri Ahobila
 * Mutt at https://ahobilamutt.org/online-calendar/, via the same three
 * backing RPC endpoints the mobile app calls directly (confirmed by
 * fetching them, not guessed -- see the mobile file's own doc comment
 * for the full provenance). The parsing logic (parseDailyCalendar/
 * parseUpcomingEkadashi/parseSankalpam) is copied verbatim: it operates
 * on the exact same response shape regardless of caller.
 *
 * Two platform differences from the mobile version, both narrowing
 * rather than fabricating:
 *
 *  1. Location comes from the browser's own `navigator.geolocation`
 *     instead of expo-location -- same real-device-location input, same
 *     graceful "ask once, remember the browser's own answer" permission
 *     model, just the web API for it. A denied/unavailable permission
 *     resolves to `null`, exactly like the mobile version, never a
 *     guessed coordinate.
 *
 *  2. Reverse geocoding uses a plain HTTPS lookup instead of
 *     expo-location's `reverseGeocodeAsync` (which has no browser
 *     equivalent): BigDataCloud's key-less client-side
 *     reverse-geocode endpoint, confirmed directly to answer with
 *     `Access-Control-Allow-Origin: *` and to need no API key or
 *     account. Same role as on mobile -- the resolved place name is
 *     sent as `cityfld`, which the Sankalpam endpoint echoes back
 *     verbatim inside its own declaration sentence ("Sankalpam for
 *     Chennai on 22nd Sep 2026..."), and is shown to the reader as the
 *     place the day's Panchangam is computed for. A failed or
 *     unavailable lookup falls back to UNNAMED_LOCATION -- the exact
 *     placeholder mobile's own resolveLocation() falls back to -- and
 *     never a guessed city. The Panchangam calculation itself is
 *     entirely lat/lng/timezone-driven either way, so a failed lookup
 *     never affects the tithi/nakshatram/festival/Ekadashi values
 *     themselves.
 *
 * Caching is identical: same cache-key shape (day + coarse lat/lng),
 * same lib/storage.ts (localStorage instead of AsyncStorage, same
 * never-throws contract), same offline/location-unavailable fallbacks.
 * Resolved place names get their own separate, longer-lived cache entry
 * (keyed by coarse coordinates only, not by day) so a returning reader
 * at the same place never re-hits the geocoder at all.
 */

const DAILY_CAL_ENDPOINT = "https://samdailycal-324121.uc.r.appspot.com/rpc";
const EKADASHI_ENDPOINT = "https://samekadasi-324123.uc.r.appspot.com/rpc";
// Same app as EKADASHI_ENDPOINT, different `action` -- confirmed against
// the live /sankalpam widget, not assumed from the Ekadasi one.
const SANKALPAM_ENDPOINT = "https://samekadasi-324123.uc.r.appspot.com/rpc";

/**
 * Both RPC endpoints above send no Access-Control-Allow-Origin header at
 * all (confirmed directly, not assumed) -- a real browser blocks the
 * response outright, unlike mobile's React Native fetch, which isn't
 * subject to browser CORS. This Cloudflare Worker (cloudflare/
 * panchangam-proxy/worker.js) fetches them server-side and re-adds a
 * permissive CORS header; it's hard-allowlisted to only these two
 * hostnames, so it can't be abused as an open proxy to anything else.
 */
const PANCHANGAM_PROXY_BASE_URL = "https://vedanta-yojana.soft-rice-6620.workers.dev";

function proxied(url: string): string {
  return `${PANCHANGAM_PROXY_BASE_URL}/?url=${encodeURIComponent(url)}`;
}

/**
 * BigDataCloud's `reverse-geocode-client` endpoint: free, key-less and
 * account-less, and explicitly meant to be called straight from a
 * browser -- it answers with `Access-Control-Allow-Origin: *`
 * (confirmed directly, like every other endpoint in this module), so
 * unlike the two Ahobila Mutt RPC hosts it needs no CORS proxy, and the
 * panchangam-proxy Worker stays narrowly allowlisted to those two hosts
 * alone. It is sent only the coordinates being named, and its answer is
 * used only for the place label; see docs/privacy-policy.html.
 */
const REVERSE_GEOCODE_ENDPOINT = "https://api.bigdatacloud.net/data/reverse-geocode-client";

const FETCH_TIMEOUT_MS = 8000;
const LOCATION_TIMEOUT_MS = 8000;
const REVERSE_GEOCODE_TIMEOUT_MS = 5000;

/**
 * The stand-in used as `cityfld` when no place name could be resolved
 * (geocoder unreachable, or coordinates with no named place at all,
 * e.g. mid-ocean). Byte-for-byte what mobile's own resolveLocation()
 * falls back to, and never shown as a place label: PanchangamData
 * carries `location: ""` in that case, so the Panchangam card omits its
 * location row entirely rather than labelling the reader's city with a
 * placeholder.
 */
const UNNAMED_LOCATION = "Your Location";

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
  /**
   * The resolved name of the place this Panchangam/Sankalpam was
   * computed for ("Chennai"), or "" when no name could be resolved --
   * the whole point being that a reader can see WHERE the day's figures
   * are valid, since tithi/nakshatra transition times and sunrise/sunset
   * all shift with location. "" is rendered as no location row at all,
   * never as a placeholder standing in for a real city.
   */
  location?: string;
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
  location: "",
};

/** Distinct from OFFLINE_FALLBACK: the network is fine, but location permission was denied or no fix could be obtained -- never silently substitutes a guessed city. */
const LOCATION_UNAVAILABLE_FALLBACK: PanchangamData = {
  tithi: "",
  paksha: "",
  nakshatram: "",
  festival: "",
  upcomingEkadashiText: "Enable location access for today's Panchangam",
  sankalpamText: "",
  location: "",
};

const CACHE_KEY_PREFIX = "vy.calendar.panchangam.";
/**
 * Deliberately NOT day-scoped, unlike CACHE_KEY_PREFIX: a place's name
 * doesn't change overnight the way its tithi does, so the geocoder is
 * asked once per coarse location and never again for a reader who keeps
 * opening Home from the same city.
 */
const PLACE_CACHE_KEY_PREFIX = "vy.calendar.place.";

function isValidPanchangamData(value: unknown): value is PanchangamData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.tithi === "string" &&
    typeof candidate.paksha === "string" &&
    typeof candidate.nakshatram === "string" &&
    typeof candidate.festival === "string" &&
    typeof candidate.upcomingEkadashiText === "string" &&
    typeof candidate.sankalpamText === "string" &&
    (candidate.location === undefined || typeof candidate.location === "string")
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
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

async function reverseGeocodeWeb(lat: number, lng: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal }
    );
    if (!res.ok) return "Your Location";
    const data = (await res.json()) as { city?: string; locality?: string; principalSubdivision?: string };
    return data.city || data.locality || data.principalSubdivision || "Your Location";
  } catch {
    return "Your Location";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The browser's own real coordinates via
 * `navigator.geolocation.getCurrentPosition` -- a no-op (instant
 * resolve with the last decision) if the visitor already
 * granted/denied permission earlier in this browsing session,
 * otherwise prompting. Resolves null (never a guessed position) if
 * geolocation is unsupported, permission is denied, or no fix can be
 * obtained within the timeout.
 */
function currentCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    const timer = setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { timeout: LOCATION_TIMEOUT_MS, maximumAge: 5 * 60 * 1000 }
    );
  });
}

/**
 * Turns coordinates into the name of the place they fall in, so the
 * reader sees "Chennai" rather than a placeholder for where the day's
 * Panchangam and Sankalpam are valid. Answered from the coarse-location
 * cache when possible, otherwise by REVERSE_GEOCODE_ENDPOINT.
 *
 * `city` first, then `locality`, then `principalSubdivision` -- the
 * same widest-recognizable-name-first order as mobile's own `place.city
 * || place.subregion || place.region` chain, so the two platforms
 * label the same spot the same way. Every failure mode (offline,
 * timeout, an unexpected response shape, or genuinely unnamed
 * coordinates such as mid-ocean) returns UNNAMED_LOCATION and caches
 * nothing, so the next call retries rather than pinning a placeholder
 * to this location forever.
 */
async function resolvePlaceName(latitude: number, longitude: number): Promise<string> {
  const cacheKey = `${PLACE_CACHE_KEY_PREFIX}${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = await readJSON(cacheKey, isNonEmptyString);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REVERSE_GEOCODE_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: "en",
    });
    const response = await fetch(`${REVERSE_GEOCODE_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) return UNNAMED_LOCATION;

    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) return UNNAMED_LOCATION;
    const place = payload as Record<string, unknown>;
    const name = [place.city, place.locality, place.principalSubdivision].find(isNonEmptyString);
    if (!name) return UNNAMED_LOCATION;

    void writeJSON(cacheKey, name);
    return name;
  } catch {
    return UNNAMED_LOCATION;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves the browser's own real location for the Panchangam request:
 * its coordinates, the place name they resolve to, and the browser's
 * own configured timezone (Intl), matching the Ahobila Mutt widget's
 * own fallback (`browser_tz =
 * Intl.DateTimeFormat().resolvedOptions().timeZone`) and mobile's
 * identical choice. Returns null (never a guessed location) when no fix
 * is available -- a place name that can't be resolved is NOT such a
 * case: the Panchangam is still exactly computable from the
 * coordinates, so it falls back to UNNAMED_LOCATION and carries on.
 */
async function resolveLocation(): Promise<ResolvedLocation | null> {
  const coordinates = await currentCoordinates();
  if (!coordinates) return null;

  return {
    city: await resolvePlaceName(coordinates.latitude, coordinates.longitude),
    lat: String(coordinates.latitude),
    lng: String(coordinates.longitude),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Parses the validity expiration time from a Sankalpam text
 * (e.g. "valid through 09:38:42 AM" or "valid through 10:28:18 PM of following day").
 * Returns a Date in the baseDate's local day representing when this declaration expires.
 */
export function parseSankalpamExpiry(sankalpamText: string, baseDate: Date = new Date()): Date | null {
  if (!sankalpamText) return null;
  const match = sankalpamText.match(
    /valid through\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)(\s+of\s+following\s+day)?/i
  );
  if (!match) return null;
  const [, hoursStr, minsStr, secsStr = "0", period, followingDay] = match;
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minsStr, 10);
  const seconds = parseInt(secsStr, 10);
  if (period.toUpperCase() === "PM" && hours < 12) hours += 12;
  if (period.toUpperCase() === "AM" && hours === 12) hours = 0;

  const expiry = new Date(baseDate);
  expiry.setHours(hours, minutes, seconds, 0);
  if (followingDay) {
    expiry.setDate(expiry.getDate() + 1);
  }
  return expiry;
}

/** Returns true if the given Sankalpam's validity window has elapsed relative to now. */
export function isSankalpamExpired(sankalpamText: string, now: Date = new Date()): boolean {
  const expiry = parseSankalpamExpiry(sankalpamText, now);
  if (!expiry) return false;
  return now.getTime() >= expiry.getTime();
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
  // Non-greedy `.+?`, not `\S+` -- plenty of real city names are more
  // than one word ("San Jose"), as is the UNNAMED_LOCATION placeholder
  // used when no name resolves, and `\S+` silently fails to match those,
  // leaving the raw English sentence completely unprocessed (confirmed
  // live: real API output with a two-word cityfld never got replaced at
  // all).
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
 * Panchangam for the browser's own real location. Cached per calendar
 * day + coarse location (lib/storage.ts's best-effort localStorage
 * wrapper) so re-opening Home repeatedly in one day/place never re-hits
 * the network or re-prompts for location; falls back to
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
  const isToday = date.toDateString() === new Date().toDateString();

  if (cached) {
    let needsUpdate = false;
    const data: PanchangamData = { ...cached };

    // If cached Ekadashi contains "a date, past" (e.g. from an earlier Dvadasi query), look ahead to the next cycle
    if (data.upcomingEkadashiText.includes("a date, past")) {
      try {
        const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowEkadashiHtml = await fetchRpcHtml(
          proxied(buildEkadashiUrl(location, formatDateParam(tomorrow)))
        );
        const parsedTomorrow = parseUpcomingEkadashi(tomorrowEkadashiHtml);
        if (parsedTomorrow && !parsedTomorrow.includes("a date, past")) {
          data.upcomingEkadashiText = parsedTomorrow;
          needsUpdate = true;
        }
      } catch {
        // Retain cached on transient network error
      }
    }

    // For today: if the cached Sankalpam has expired, re-fetch just the Sankalpam for the current time
    if (isToday && isSankalpamExpired(data.sankalpamText)) {
      try {
        const now = new Date();
        const timeParam = formatTimeParam(now);
        const dateParam = formatDateParam(now);
        const sankalpamHtml = await fetchRpcHtml(
          proxied(buildSankalpamUrl(location, dateParam, timeParam))
        );
        const freshSankalpam = parseSankalpam(sankalpamHtml);
        if (freshSankalpam) {
          data.sankalpamText = freshSankalpam;
          needsUpdate = true;
        }
      } catch {
        // Retain cached on transient network error
      }
    }

    if (location.city && location.city !== "Your Location" && !data.location) {
      data.location = location.city;
      needsUpdate = true;
    }

    if (needsUpdate) {
      void writeJSON(cacheKey, data);
    }
    return data;
  }

  try {
    const dateParam = formatDateParam(date);
    const timeParam = formatTimeParam(isToday ? new Date() : date);
    const [dailyHtml, ekadashiHtml, sankalpamHtml] = await Promise.all([
      fetchRpcHtml(proxied(buildDailyCalUrl(location, dateParam))),
      fetchRpcHtml(proxied(buildEkadashiUrl(location, dateParam))),
      fetchRpcHtml(proxied(buildSankalpamUrl(location, dateParam, timeParam))),
    ]);

    const parsedDaily = parseDailyCalendar(dailyHtml);
    if (!parsedDaily) throw new Error("Unrecognized daily calendar response format");

    let upcomingEkadashiText = parseUpcomingEkadashi(ekadashiHtml);
    // On Dvadasi, the API returns "Next Ekadasi for <city> is on a date, past. Perform Dvadasi Paranai..."
    // In that case, look ahead to tomorrow to fetch the actual upcoming Ekadasi of the next cycle.
    if (upcomingEkadashiText.includes("a date, past") || ekadashiHtml.includes("a date, past")) {
      try {
        const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowEkadashiHtml = await fetchRpcHtml(
          proxied(buildEkadashiUrl(location, formatDateParam(tomorrow)))
        );
        const parsedTomorrow = parseUpcomingEkadashi(tomorrowEkadashiHtml);
        if (parsedTomorrow && !parsedTomorrow.includes("a date, past")) {
          upcomingEkadashiText = parsedTomorrow;
        }
      } catch {
        // Retain parsed if tomorrow fetch fails
      }
    }

    const data: PanchangamData = {
      ...parsedDaily,
      upcomingEkadashiText,
      sankalpamText: parseSankalpam(sankalpamHtml),
      // "" rather than the placeholder itself: an unresolved name is
      // shown as no location row at all, never as a fake city.
      location: location.city === UNNAMED_LOCATION ? "" : location.city,
    };

    void writeJSON(cacheKey, data);
    return data;
  } catch {
    return OFFLINE_FALLBACK;
  }
}
