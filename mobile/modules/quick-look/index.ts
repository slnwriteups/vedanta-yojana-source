import { requireOptionalNativeModule } from "expo";

interface QuickLookNativeModule {
  previewAsync(uri: string): Promise<void>;
}

// iOS only (see ios/QuickLookModule.swift). Optional so that merely
// importing this file on Android -- where the module doesn't exist --
// never throws.
const QuickLook = requireOptionalNativeModule<QuickLookNativeModule>("VYQuickLook");

/** Opens a local file:// URI in iOS's Quick Look preview. Resolves once the preview is on screen. */
export function previewDocumentAsync(uri: string): Promise<void> {
  if (!QuickLook) {
    return Promise.reject(new Error("Quick Look preview is only available on iOS."));
  }
  return QuickLook.previewAsync(uri);
}
