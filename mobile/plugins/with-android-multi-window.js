const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");
// Split screen, freeform windows and foldables (folding/unfolding) change the
// window's smallest width. The Expo template's MainActivity does not declare
// smallestScreenSize in configChanges, so each of those changes destroys and
// recreates the activity -- React Native remounts from the start and the
// reader loses their place. Declaring it lets the app resize in place, as it
// already does for rotation. resizeableActivity is the platform default for
// our target SDK; it is set explicitly so split screen cannot be lost to a
// template change.
const REQUIRED_CONFIG_CHANGES = [
  "keyboard",
  "keyboardHidden",
  "orientation",
  "screenSize",
  "smallestScreenSize",
  "screenLayout",
  "uiMode",
];
module.exports = function withAndroidMultiWindow(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const existing = (activity.$["android:configChanges"] || "").split("|").filter(Boolean);
    const merged = [...existing];
    for (const change of REQUIRED_CONFIG_CHANGES) {
      if (!merged.includes(change)) merged.push(change);
    }
    activity.$["android:configChanges"] = merged.join("|");
    activity.$["android:resizeableActivity"] = "true";
    return cfg;
  });
};
