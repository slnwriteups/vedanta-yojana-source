import * as IntentLauncher from "expo-intent-launcher";
import { File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { ensurePasuramsUnpacked, isPasuramAvailable, localPasuramPath } from "./pasuramArchive.ts";

/**
 * Every Pasuram PDF Prapatti.com resource referenced by the content
 * corpus is bundled directly into the app as a single compressed
 * archive (see mobile/scripts/generate-pasuram-archive.ts and
 * mobile/services/pasuramArchive.ts) -- there is no download step,
 * online or offline, and never has been for a reader: a Pasuram is
 * available the instant the app is installed, exactly like a Divya
 * Desam image. This file is the one place mobile/ is allowed to touch
 * expo-intent-launcher/expo-sharing for this feature -- see
 * mobile/tests/offline.test.ts, which fails the build if app/,
 * components/, or content-lib/ reference fetch/XMLHttpRequest/axios.
 *
 * `isPasuramAvailable` is trivially pure (a manifest lookup) and has no
 * native dependency, so it's safe to call from any render. Opening a
 * PDF still needs real native calls (unpacking the bundled archive into
 * app-private storage on first need, then either an Android VIEW intent
 * or iOS's own file preview), so, like every other native-only adapter
 * in this codebase, this file is not unit-tested under plain
 * `node --test`; it's exercised via `expo export` and real-device
 * testing instead.
 */

export { isPasuramAvailable };

export interface PasuramOpenResult {
  success: boolean;
  error?: string;
}

const ACTION_VIEW = "android.intent.action.VIEW";
/** Intent.FLAG_GRANT_READ_URI_PERMISSION -- required for the PDF reader app (a different process) to read a content:// URI this app's own FileProvider vends. */
const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;

/**
 * Opens a bundled Pasuram PDF directly in the device's PDF reader --
 * deliberately NOT expo-sharing's ACTION_SEND share sheet, which lists
 * messaging/email/"send to a contact" apps alongside PDF viewers and
 * risks a reader tapping the wrong one and sending the file somewhere
 * instead of just reading it. An Android ACTION_VIEW intent with an
 * explicit "application/pdf" type is resolved by the OS against apps
 * that declared themselves capable of *viewing* that type -- normal PDF
 * readers -- never the ACTION_SEND-only messaging/sharing apps.
 *
 * Callers must check isPasuramAvailable() first (or handle a
 * `success: false` result) rather than assuming every URL the content
 * corpus references is actually bundled -- the generator warns, but
 * does not fail the build, if a URL has no matching file under
 * mobile/assets/pasurams/.
 */
export async function openOfflinePasuram(url: string): Promise<PasuramOpenResult> {
  if (!isPasuramAvailable(url)) {
    return { success: false, error: "This Pasuram is not available." };
  }

  try {
    await ensurePasuramsUnpacked();
    const localUri = localPasuramPath(url);
    if (!localUri) {
      return { success: false, error: "Could not resolve the bundled Pasuram file." };
    }

    if (Platform.OS === "android") {
      const contentUri = new File(localUri).contentUri;
      await IntentLauncher.startActivityAsync(ACTION_VIEW, {
        data: contentUri,
        type: "application/pdf",
        flags: FLAG_GRANT_READ_URI_PERMISSION,
      });
    } else {
      // iOS has no Intent/ACTION_VIEW system to target a PDF viewer
      // specifically -- its own document preview sheet (reached via
      // expo-sharing here) is the closest platform equivalent, and,
      // unlike Android's, is not dominated by messaging/send targets.
      await Sharing.shareAsync(localUri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred." };
  }
}
