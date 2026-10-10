import { readJSON, writeJSON } from "./storage.ts";
import { computePanchangamForDate, timeZoneLabel, utcOffsetMinutes } from "../content-lib/panchangam-engine.ts";
import type { ChosenPlace } from "../content-lib/panchangam-place.ts";

/**
 * Web twin of mobile/services/panchangamService.ts: today's Panchangam
 * (Hindu lunar calendar) for the browser's own location, computed in the
 * browser by content-lib/panchangam-engine.ts -- tithi, nakshatram,
 * sunrise/sunset, the day's kaalams, festivals, the next Ekadasi and the
 * Sankalpam declaration. No calendar service is called.
 *
 * The two platforms differ only in how they obtain the location:
 *
 *  1. Coordinates come from the browser's own `navigator.geolocation`
 *     instead of expo-location -- same real-device-location input, same
 *     graceful "ask once, remember the browser's own answer" permission
 *     model. A denied/unavailable permission resolves to `null`, exactly
 *     like the mobile version, never a guessed coordinate.
 *
 *  2. The place name uses a plain HTTPS lookup instead of
 *     expo-location's `reverseGeocodeAsync` (which has no browser
 *     equivalent): BigDataCloud's key-less client-side reverse-geocode
 *     endpoint. The resolved name is named in the Sankalpam ("Sankalpam
 *     for Chennai on 22nd Sep 2026...") and shown as the place the day's
 *     Panchangam is computed for. A failed or unavailable lookup falls
 *     back to UNNAMED_LOCATION and never a guessed city; the calculation
 *     itself is entirely latitude/longitude/timezone-driven, so a failed
 *     lookup never affects the tithi/nakshatram/festival values.
 *
 * A reader may instead choose a city (panchangam-place-store.ts); the
 * Panchangam is then computed for that city, on that city's clock, and
 * neither the browser's location nor the geocoder is used.
 *
 * Resolved place names are cached (keyed by coarse coordinates) so a
 * returning reader at the same place never re-hits the geocoder at all.
 */

/**
 * BigDataCloud's `reverse-geocode-client` endpoint: free, key-less and
 * account-less, and explicitly meant to be called straight from a
 * browser (it answers with `Access-Control-Allow-Origin: *`). It is sent
 * only the coordinates being named, and its answer is used only for the
 * place label; see docs/privacy-policy.html.
 */
const REVERSE_GEOCODE_ENDPOINT = "https://api.bigdatacloud.net/data/reverse-geocode-client";

const LOCATION_TIMEOUT_MS = 8000;
const REVERSE_GEOCODE_TIMEOUT_MS = 5000;

/**
 * The stand-in Sankalpam place name when no place name could be resolved
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
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface PanchangamData {
  tithi: string;
  paksha: string;
  nakshatram: string;
  festival: string;
  upcomingEkadashiText: string;
  /** The full Sankalpam declaration sentence for the current moment, or "" if unavailable. */
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
  /** Sunrise/sunset and the day's kaalams, 24-hour local "HH:MM" / "HH:MM-HH:MM" (see panchangam-timings.ts). */
  sunrise?: string;
  sunset?: string;
  rahuKaalam?: string;
  yamagandam?: string;
  gulikaKaalam?: string;
  /** True when this is for a city the reader chose rather than the browser's location. */
  isChosenPlace?: boolean;
  /**
   * The time zone the times are in ("IST"), set only when it differs
   * from the browser's own clock -- a reader in London who chooses
   * Chennai needs to know the sunrise shown is Chennai's.
   */
  timeZoneNote?: string;
}

/**
 * Returned if the calculation itself fails -- deliberately empty values
 * rather than a fabricated tithi or festival, since presenting invented
 * Panchangam facts as real would be worse than admitting it couldn't be
 * computed.
 */
const UNAVAILABLE_FALLBACK: PanchangamData = {
  tithi: "",
  paksha: "",
  nakshatram: "",
  festival: "",
  upcomingEkadashiText: "Panchangam unavailable",
  sankalpamText: "",
  location: "",
};

/** Location permission was denied or no fix could be obtained -- never silently substitutes a guessed city. */
const LOCATION_UNAVAILABLE_FALLBACK: PanchangamData = {
  tithi: "",
  paksha: "",
  nakshatram: "",
  festival: "",
  upcomingEkadashiText: "Enable location access for today's Panchangam",
  sankalpamText: "",
  location: "",
};

/**
 * Keyed by coarse coordinates only, not by day: a place's name doesn't
 * change overnight, so the geocoder is asked once per coarse location
 * and never again for a reader who keeps opening Home from the same
 * city.
 */
const PLACE_CACHE_KEY_PREFIX = "vy.calendar.place.";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
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
 * Resolves the browser's own real location: its coordinates, the place
 * name they resolve to, and the browser's own configured timezone
 * (Intl), mobile's identical choice. Returns null (never a guessed
 * location) when no fix is available -- a place name that can't be
 * resolved is NOT such a case: the Panchangam is still exactly
 * computable from the coordinates, so it falls back to UNNAMED_LOCATION
 * and carries on.
 */
async function resolveLocation(): Promise<ResolvedLocation | null> {
  const coordinates = await currentCoordinates();
  if (!coordinates) return null;

  return {
    city: await resolvePlaceName(coordinates.latitude, coordinates.longitude),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * The Panchangam for `date` (the Sankalpam for the present moment when
 * `date` is today) at the chosen city, or at the browser's own real
 * location when `chosen` is null. Falls back to
 * LOCATION_UNAVAILABLE_FALLBACK if location permission is denied/no fix
 * is available -- never a fabricated Panchangam.
 */
export async function fetchPanchangam(date: Date = new Date(), chosen: ChosenPlace | null = null): Promise<PanchangamData> {
  const location: ResolvedLocation | null = chosen
    ? { city: chosen.name, latitude: chosen.latitude, longitude: chosen.longitude, timezone: chosen.timeZone }
    : await resolveLocation();
  if (!location) return LOCATION_UNAVAILABLE_FALLBACK;

  try {
    const computed = computePanchangamForDate(
      date,
      { latitude: location.latitude, longitude: location.longitude, timeZone: location.timezone },
      location.city
    );
    const now = Date.now();
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const sameClock = utcOffsetMinutes(now, location.timezone) === utcOffsetMinutes(now, deviceZone);
    const data: PanchangamData = {
      tithi: computed.tithi,
      paksha: computed.paksha,
      nakshatram: computed.nakshatram,
      festival: computed.festival,
      upcomingEkadashiText: computed.upcomingEkadashiText,
      sankalpamText: computed.sankalpamText,
      sunrise: computed.sunrise,
      sunset: computed.sunset,
      rahuKaalam: computed.rahuKaalam,
      yamagandam: computed.yamagandam,
      gulikaKaalam: computed.gulikaKaalam,
      // "" rather than the placeholder itself: an unresolved name is
      // shown as no location row at all, never as a fake city.
      location: location.city === UNNAMED_LOCATION ? "" : location.city,
      isChosenPlace: Boolean(chosen),
      timeZoneNote: sameClock ? undefined : timeZoneLabel(now, location.timezone),
    };
    // A chosen city is labelled with its region too ("Chennai, Tamil Nadu"), so a
    // reader can tell same-named places apart; the Sankalpam names the city alone.
    if (chosen) data.location = [chosen.name, chosen.region === chosen.name ? "" : chosen.region].filter(Boolean).join(", ");
    return data;
  } catch {
    return UNAVAILABLE_FALLBACK;
  }
}
