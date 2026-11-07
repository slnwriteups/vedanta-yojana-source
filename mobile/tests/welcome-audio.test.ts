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

/**
 * App Review rejected 1.1.0 (26) under guideline 2.5.4: expo-audio's config
 * plugin adds "audio" to UIBackgroundModes unless told otherwise, and the
 * app has no audio that keeps playing in the background (the welcome
 * taniyan plays only on screen). Keep background playback off.
 */
test("the app does not declare background audio (App Review guideline 2.5.4)", () => {
  const appJson = JSON.parse(
    fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app.json"), "utf8")
  );
  const audioPlugin = appJson.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-audio");
  assert.ok(audioPlugin, "expo-audio plugin entry with options is expected");
  assert.equal(audioPlugin[1].enableBackgroundPlayback, false);
  assert.notEqual(audioPlugin[1].enableBackgroundRecording, true);
  assert.ok(!(appJson.expo.ios.infoPlist.UIBackgroundModes ?? []).includes("audio"));
});

/**
 * Same review hygiene for location: the app only asks for "while using"
 * location (Panchangam for the reader's place). expo-location otherwise
 * adds generic "Allow $(PRODUCT_NAME)..." Always, motion and full-accuracy
 * purpose strings for features the app never uses (guideline 5.1.1).
 */
test("the app declares only the while-in-use location permission", () => {
  const appJson = JSON.parse(
    fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app.json"), "utf8")
  );
  const locationPlugin = appJson.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-location");
  const options = locationPlugin[1];
  assert.equal(options.locationAlwaysAndWhenInUsePermission, false);
  assert.equal(options.locationAlwaysPermission, false);
  assert.equal(options.motionUsagePermission, false);
  assert.equal(options.locationFullAccuracyPermission, false);
  assert.notEqual(options.isIosBackgroundLocationEnabled, true);
});
