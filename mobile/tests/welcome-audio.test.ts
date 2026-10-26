import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The welcome taniyan was silent on iPhone and iPad after the Expo SDK 58
 * upgrade: play() ran at mount, before any audio mode was set (so the
 * session used the default, silent-switch-muted category) and before the
 * clip had loaded, and SDK 58 activates the audio session only after
 * play(). These pin the order that fixed it.
 */

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "components", "WelcomeScreen.tsx"),
  "utf8"
);

test("the welcome audio sets an audio mode that plays in silent mode", () => {
  assert.match(source, /setAudioModeAsync\(\{[^}]*playsInSilentMode: true/);
});

test("the welcome audio plays only after the mode is set and the clip has loaded, never straight at mount", () => {
  assert.match(source, /useAudioPlayerStatus\(player\)/);
  assert.match(source, /if \(!audioModeSet \|\| !isLoaded \|\| started\.current\) return;/);
  assert.ok(!/useEffect\(\(\) => \{\s*player\.play\(\);\s*\}, \[player\]\);/.test(source), "play() must not run unconditionally at mount");
});
