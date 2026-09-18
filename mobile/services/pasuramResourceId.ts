/**
 * Pure, framework-free resource-identity logic for offline Pasuram
 * PDFs, split out of pasuramOfflineService.ts (which touches
 * expo-file-system/expo-sharing) so this file can be unit-tested under
 * plain `node --test`, matching this project's established convention
 * (mobile/components/image-viewer-math.ts is the same pattern; see
 * mobile/tests/screens.test.ts's own doc comment for why mobile/tests/
 * cannot import react-native or a native module at all).
 */

import { sha256Hex, sha256HexBytes } from "./sha256.ts";

export { sha256Hex, sha256HexBytes };

/**
 * The stable per-resource identity: a URL always maps to the same ID
 * (and therefore the same local file), regardless of which Divya Desam
 * -- or how many times the same record repeats it -- referenced it. See
 * this module's own unit tests for the exact dedup guarantees this must
 * uphold. Truncated to 32 hex chars (128 bits) -- astronomically
 * collision-safe for ~400 known URLs, and short enough to stay a sane
 * filename.
 */
export function getPasuramResourceId(url: string): string {
  return sha256Hex(url).slice(0, 32);
}

export const PASURAM_DIRECTORY_NAME = "pasurams";

/** The stable local filename (not a full path) a given Pasuram URL always resolves to. */
export function getPasuramFileName(url: string): string {
  return `${getPasuramResourceId(url)}.pdf`;
}
