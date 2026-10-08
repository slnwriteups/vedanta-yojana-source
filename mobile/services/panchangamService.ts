import * as Location from "expo-location";
import { computePanchangamForDate } from "../../content-lib/panchangam-engine.ts";

/**
 * Today's Panchangam (Hindu lunar calendar) for the device's own
 * location, computed on the device by content-lib/panchangam-engine.ts:
 * tithi, nakshatram, sunrise/sunset, the day's kaalams, festivals, the
 * next Ekadasi and the Sankalpam declaration. Nothing is fetched from a
 * calendar service, so it works offline once a location fix is known.
 *
 * Location: a Panchangam is genuinely location-dependent (tithi/
 * nakshatra transition times are fixed instants, but which one is in
 * force at sunrise shifts with longitude, and sunrise/sunset with both),
 * so this uses the device's own real location (expo-location) rather
 * than assuming any one fixed city. Falls back to
 * LOCATION_UNAVAILABLE_FALLBACK (never a guessed city) if location
 * permission is denied or a fix can't be obtained.
 *
 * lib/panchangam-service.ts is the web twin; the two differ only in how
 * they obtain the location.
 */

/**
 * The stand-in Sankalpam place name when reverse geocoding resolves no
 * name at all. Never shown as a place label: PanchangamData carries
 * `location: ""` in that case, so the Panchangam card omits its
 * location row entirely rather than labelling the reader's city with a
 * placeholder. lib/panchangam-service.ts (web) falls back to this same
 * literal string.
 */
const UNNAMED_LOCATION = "Your Location";

const LOCATION_TIMEOUT_MS = 8000;

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
   * computed for ("Chennai"), or "" when reverse geocoding produced no
   * name -- the whole point being that a reader can see WHERE the day's
   * figures are valid, since tithi/nakshatra transition times and
   * sunrise/sunset all shift with location. "" is rendered as no
   * location row at all, never as a placeholder standing in for a real
   * city.
   */
  location?: string;
  /** Sunrise/sunset and the day's kaalams, 24-hour local "HH:MM" / "HH:MM-HH:MM" (see panchangamTimings.ts). */
  sunrise?: string;
  sunset?: string;
  rahuKaalam?: string;
  yamagandam?: string;
  gulikaKaalam?: string;
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
 * Resolves the device's own real location for the Panchangam --
 * requests foreground permission (a no-op prompt if already
 * granted/denied from a prior call), reads the last known fix if one is
 * cached by the OS (fast, no GPS wait) or otherwise requests a fresh
 * one, and reverse-geocodes it to a place name -- shown to the reader
 * as the place the day's figures are valid for, and named inside the
 * "Sankalpam for {city}" declaration sentence (the calculation itself
 * only ever uses latitude/longitude/timezone, so a name that can't be
 * resolved changes the label alone).
 * Timezone is the DEVICE's own configured zone (Intl), so every time
 * shown reads on the reader's own clock.
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
    let city: string = UNNAMED_LOCATION;
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      city = place?.city || place?.subregion || place?.region || city;
    } catch {
      // A failed lookup still lets the Panchangam itself be computed from
      // the coordinates -- the name only decides how the place is
      // LABELLED (the Panchangam card's location row and the "Sankalpam
      // for {city}" sentence), never what is computed.
    }

    return {
      city,
      latitude,
      longitude,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  } catch {
    return null;
  }
}

/**
 * The Panchangam for `date` (the Sankalpam for the present moment when
 * `date` is today) at the device's own real location. Falls back to
 * LOCATION_UNAVAILABLE_FALLBACK if location permission is denied/no fix
 * is available -- never a fabricated Panchangam.
 */
export async function fetchPanchangam(date: Date = new Date()): Promise<PanchangamData> {
  const location = await resolveLocation();
  if (!location) return LOCATION_UNAVAILABLE_FALLBACK;

  try {
    const computed = computePanchangamForDate(
      date,
      { latitude: location.latitude, longitude: location.longitude, timeZone: location.timezone },
      location.city
    );
    return {
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
    };
  } catch {
    return UNAVAILABLE_FALLBACK;
  }
}
