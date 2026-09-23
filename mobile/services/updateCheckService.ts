import Constants from "expo-constants";

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
 * `Constants.expoConfig.android.versionCode` (not the deprecated
 * `Constants.nativeBuildVersion`, and not `expo-application`, which
 * isn't a dependency) is reliable for this: this app has no
 * expo-updates/OTA mechanism, so the JS bundle's own config always
 * matches the native build it was compiled and shipped with -- there's
 * no scenario where they could diverge.
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
export const BUILD_VERSION_CODE = 15;

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const currentVersionCode =
    typeof Constants.expoConfig?.android?.versionCode === "number"
      ? Constants.expoConfig.android.versionCode
      : BUILD_VERSION_CODE;
  if (typeof currentVersionCode !== "number") return null;

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
