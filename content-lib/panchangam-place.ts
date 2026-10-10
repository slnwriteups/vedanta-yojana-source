/**
 * A place chosen for the Panchangam instead of the reader's own location:
 * its type, its display label and the check applied to a stored value.
 * Kept apart from panchangam-places.ts (the search over the ~570 KB
 * bundled list) so the Home screen can restore a saved choice without
 * loading the list.
 */

/** A place the Panchangam can be computed for, as stored when a reader chooses it. */
export interface ChosenPlace {
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

/** "Chennai, Tamil Nadu, India" -- the region is left out when it repeats the name. */
export function placeLabel(place: ChosenPlace): string {
  return [place.name, place.region === place.name ? "" : place.region, place.country].filter(Boolean).join(", ");
}

/** Whether a stored value is a usable ChosenPlace (storage can hold anything). */
export function isChosenPlace(value: unknown): value is ChosenPlace {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    v.name.length > 0 &&
    typeof v.region === "string" &&
    typeof v.country === "string" &&
    typeof v.latitude === "number" &&
    Math.abs(v.latitude) <= 90 &&
    typeof v.longitude === "number" &&
    Math.abs(v.longitude) <= 180 &&
    typeof v.timeZone === "string" &&
    isValidTimeZone(v.timeZone)
  );
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
