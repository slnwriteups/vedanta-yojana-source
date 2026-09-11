/**
 * Web substitute for mobile/storage.ts's AsyncStorage wrapper -- same
 * signatures, same "never throws" contract, backed by localStorage
 * instead. A missing key, malformed JSON, or a value that fails the
 * caller's own type guard all fall back to null rather than throwing --
 * preferences are a convenience, never something that should be able to
 * crash a page. Kept async to stay a drop-in match for the mobile API
 * even though localStorage itself is synchronous.
 */
export async function readJSON<T>(key: string, isValid: (value: unknown) => value is T): Promise<T | null> {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort -- a write failure (e.g. storage full,
    // or localStorage unavailable in this browsing context) should not
    // surface as an error in a settings toggle.
  }
}
