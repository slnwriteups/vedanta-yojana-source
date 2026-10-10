import { useSyncExternalStore } from "react";
import { readJSON, writeJSON } from "./storage.ts";
import { isChosenPlace, type ChosenPlace } from "../content-lib/panchangam-place.ts";

/**
 * The place the Panchangam is computed for: a city the reader chose, or
 * null for the browser's own location (the default). Saved in this browser,
 * so the choice survives a restart; shared by everything that shows the
 * Panchangam (the Home header and the calendar card), so changing it in
 * one place updates both.
 */

const STORAGE_KEY = "panchangamPlace";

let current: ChosenPlace | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Reads the saved choice once; later calls return the same answer. */
export async function loadPanchangamPlace(): Promise<ChosenPlace | null> {
  if (!loaded) {
    current = await readJSON(STORAGE_KEY, isChosenPlace);
    loaded = true;
    emit();
  }
  return current;
}

/** Chooses a city, or null to go back to the browser's location. */
export function setPanchangamPlace(place: ChosenPlace | null): void {
  current = place;
  loaded = true;
  emit();
  void writeJSON(STORAGE_KEY, place);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The current choice for rendering. `ready` is false until the saved
 * choice has been read, so a screen does not compute the Panchangam for
 * the browser's location first and then again for the saved city.
 */
export function usePanchangamPlace(): { place: ChosenPlace | null; ready: boolean } {
  // The static export renders with no saved choice; the browser's is read after hydration.
  const place = useSyncExternalStore(subscribe, () => current, () => null);
  const ready = useSyncExternalStore(subscribe, () => loaded, () => false);
  return { place, ready };
}
