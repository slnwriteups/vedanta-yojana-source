import { Linking, Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";

/**
 * Handles in-app downloading and triggering of the Android Package Installer
 * for direct-distributed GitHub APKs.
 *
 * Outside Google Play, Android OS prohibits standard applications from
 * silently overwriting their own binary in the background. Instead, the
 * Google-compliant and user-friendly flow used by open apps (Signal,
 * Obtainium, Telegram Direct) is:
 *  1. Download the APK directly within the app to the private cache.
 *  2. Resolve a secure content:// URI via FileSystem.getContentUriAsync.
 *  3. Launch IntentLauncher with ACTION_VIEW / application/vnd.android.package-archive.
 *  4. Android presents the system "Do you want to update this app?" prompt,
 *     allowing the user to upgrade with a single tap without opening a browser
 *     or manually searching through file downloads.
 *
 * If the device is not Android, permission is not yet granted, or any error
 * occurs, gracefully falls back to opening the download URL in the browser.
 */
export async function downloadAndInstallApk(
  downloadUrl: string,
  onProgress?: (percent: number) => void
): Promise<boolean> {
  if (Platform.OS !== "android") {
    await Linking.openURL(downloadUrl);
    return true;
  }

  try {
    const targetFile = new File(Paths.cache, "vedanta-yojana-update.apk");
    if (targetFile.exists) {
      try {
        targetFile.delete();
      } catch {
        // Non-fatal if cache file cleanup fails
      }
    }

    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      targetFile.uri,
      {},
      (downloadProgress) => {
        if (downloadProgress.totalBytesExpectedToWrite > 0) {
          const percent = Math.min(
            100,
            Math.max(
              0,
              Math.round(
                (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
              )
            )
          );
          onProgress?.(percent);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      throw new Error("APK download returned empty result URI");
    }

    const contentUri = await FileSystem.getContentUriAsync(result.uri);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
      type: "application/vnd.android.package-archive",
    });
    return true;
  } catch {
    // Seamless fallback to browser download if native intent launch fails
    try {
      await Linking.openURL(downloadUrl);
    } catch {
      // Ignore if browser opening also fails
    }
    return false;
  }
}
