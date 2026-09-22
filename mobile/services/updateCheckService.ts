import * as Application from "expo-application";

/**
 * Vedanta Yojana is distributed as a direct-download APK, not through
 * Google Play -- so there is no OS-level background update mechanism
 * the way a Play Store install gets one. This is the closest
 * equivalent achievable outside the Play Store, and the same pattern
 * every other directly-distributed Android app (F-Droid, Obtainium,
 * etc.) uses: fetch a small, publicly hosted version manifest, compare
 * it against this exact running build's own versionCode, and if newer,
 * tell the caller so it can prompt the person to download and install
 * the update themselves. A normal app has no OS permission to silently
 * install an update over itself -- only the Play Store's own installer
 * has that -- so "check and prompt" is the real ceiling here, not a
 * missing feature.
 *
 * The comparison reads `Application.nativeBuildVersion` -- the
 * versionCode of the INSTALLED BINARY, straight from the Android
 * package manager -- and deliberately not
 * `Constants.expoConfig.android.versionCode`. That distinction only
 * became load-bearing when this app gained EAS Update: an
 * over-the-air bundle carries its own copy of app.json, so once a
 * device is running an update published after a versionCode bump,
 * `expoConfig` reports the NEW versionCode while the installed APK is
 * still the old one. Comparing against that would have this function
 * conclude the device is already current and silently stop offering
 * the real binary -- the exact "no user is ever offered the newer
 * build" failure that public/app-version.json's versionCode drift
 * caused before, arriving by a different route. The native value
 * cannot be changed by an update, which is precisely why it is the
 * right one.
 *
 * The two mechanisms answer different questions and both are needed:
 * EAS Update ships JS and asset changes to installed apps by itself,
 * while this prompt covers what an update can never deliver -- a new
 * native build (a new native module, a changed permission, an Expo SDK
 * upgrade).
 */

const VERSION_MANIFEST_URL = "https://vedantayojana.org/app-version.json";
const FETCH_TIMEOUT_MS = 8000;

export interface UpdateInfo {
  latestVersionCode: number;
  latestVersion: string;
  downloadUrl: string;
  notes: string;
}

interface VersionManifest {
  android: {
    versionCode: number;
    version: string;
    url: string;
    notes?: string;
  };
}

function isValidManifest(value: unknown): value is VersionManifest {
  if (typeof value !== "object" || value === null) return false;
  const android = (value as Record<string, unknown>).android;
  if (typeof android !== "object" || android === null) return false;
  const a = android as Record<string, unknown>;
  return typeof a.versionCode === "number" && typeof a.version === "string" && typeof a.url === "string";
}

/**
 * Returns update details if a newer build is published, or null if
 * already current, unreachable, or the manifest is malformed -- never
 * throws, and never fabricates an update that isn't real. The caller
 * fires this fire-and-forget on mount; it must never block app
 * startup or be treated as an error when it resolves to null.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  // Android reports versionCode as a string here. Anything else --
  // null (the value on platforms that have no such concept) or a
  // non-integer -- returns null rather than being coerced: `Number(null)`
  // is 0, which would pass an integer check and make every manifest
  // version look newer, prompting an update without end.
  const nativeBuildVersion = Application.nativeBuildVersion;
  if (!nativeBuildVersion) return null;
  const currentVersionCode = Number(nativeBuildVersion);
  if (!Number.isInteger(currentVersionCode)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(VERSION_MANIFEST_URL, { signal: controller.signal });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!isValidManifest(data)) return null;
    if (data.android.versionCode <= currentVersionCode) return null;
    return {
      latestVersionCode: data.android.versionCode,
      latestVersion: data.android.version,
      downloadUrl: data.android.url,
      notes: data.android.notes ?? "",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
