/**
 * The only place an in-app update may download an APK from: a release
 * asset of the official releases repository, over HTTPS.
 *
 * The update URL arrives from https://vedantayojana.org/app-version.json
 * at runtime. Without this check, anyone able to change that file (or a
 * future mistake in it) could make the app download and offer to install
 * an arbitrary APK -- including a different app, which Android would
 * install alongside ours, since its signature check only protects
 * updates to the same package. Pinning the source to our own GitHub
 * releases means an attacker would need both the website and the
 * releases repository; Android's signature check then still refuses any
 * APK for our package not signed with the production key.
 *
 * A strict pattern on the raw string rather than `new URL()`: React
 * Native's URL implementation does not support `hostname`/`pathname`,
 * and a pattern also rules out userinfo, ports, query strings,
 * fragments, percent-encoding and `..` segments by construction.
 */
const TRUSTED_APK_URL =
  /^https:\/\/github\.com\/slnwriteups\/vedanta-yojana-releases\/releases\/download\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.apk$/;

export function isTrustedApkUrl(url: unknown): url is string {
  return typeof url === "string" && TRUSTED_APK_URL.test(url) && !url.includes("/../") && !url.includes("/./");
}
