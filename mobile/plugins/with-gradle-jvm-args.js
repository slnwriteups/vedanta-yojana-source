const { withGradleProperties } = require("expo/config-plugins");
// The Expo template's default Gradle JVM limits (-Xmx2048m, 512m Metaspace)
// are exhausted once expo-updates is added; the daemon then thrashes
// indefinitely instead of failing (the 6-hour CI hang on android-v15).
const JVM_ARGS = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";
module.exports = function withGradleJvmArgs(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (p) => !(p.type === "property" && p.key === "org.gradle.jvmargs")
    );
    cfg.modResults.push({
      type: "property",
      key: "org.gradle.jvmargs",
      value: JVM_ARGS,
    });
    return cfg;
  });
};
