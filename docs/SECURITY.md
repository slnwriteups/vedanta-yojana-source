# Security Architecture

This is the detailed technical security document for Vedanta Yojana. It
covers the threat model, dependency security, build security, Android
security, network security, content integrity, signing, and known
limitations. For the short vulnerability-reporting policy, see the
root [SECURITY.md](../SECURITY.md). For how to verify a specific
downloaded Android release, see
[APK-VERIFICATION.md](APK-VERIFICATION.md).

Every control described here is drawn from the current repository
configuration or from a specific verification step, cited by file path
or command. Where something is not yet verified, it is stated as such
rather than assumed.

## Contents

- [Threat model](#threat-model)
- [Source & repository security](#source--repository-security)
- [Dependency security](#dependency-security)
- [The image-size vulnerability](#the-image-size-vulnerability)
- [Security testing](#security-testing)
- [Build security](#build-security)
- [Android security](#android-security)
- [Network security](#network-security)
- [Content integrity](#content-integrity)
- [Signing & release provenance](#signing--release-provenance)
- [Secrets management](#secrets-management)
- [Security limitations](#security-limitations)

## Threat model

| Threat | Mitigation | Residual risk |
|---|---|---|
| Fake or repackaged APK distributed under the project's name | Distribution limited to one channel — the project's own GitHub Releases repository (`vedanta-yojana-releases`); the app is not on any app store. A published checksum and certificate fingerprint let a specific download or install be confirmed — see [APK Verification Guide](APK-VERIFICATION.md) | A user who ignores verification guidance and installs from an unofficial mirror cannot be protected by anything the project publishes |
| Modified/tampered APK | Android's own signature verification rejects any APK whose contents were altered after signing, at install time, if the certificate doesn't match a prior install | Only protects users who compare the certificate against a trusted reference; does not itself alert an unsuspecting user |
| Compromised GitHub account | Secret scanning and push protection enabled on the repository; Dependabot security updates enabled | No hardware-key/2FA enforcement is independently verifiable from repository configuration alone |
| Compromised GitHub Actions workflow | All third-party Actions pinned to a full commit SHA (not a floating tag) in `.github/workflows/*.yml`; workflows use least-privilege `permissions: contents: read` unless a step specifically needs more | A compromised upstream Action release that predates the pinned SHA is not something a SHA pin can catch by itself |
| Compromised EAS build | EAS is Expo's managed build infrastructure — the project depends on Expo's own account security and build isolation | Outside this project's direct control; see [Security Limitations](#security-limitations) |
| Signing-credential compromise | Android production signing credentials are held remotely by EAS ("Using remote Android credentials (Expo server)"), not stored in this repository or on any local developer machine | Credential custody ultimately depends on Expo account security |
| Malicious or vulnerable dependency | `package-lock.json` committed for both web and mobile; Dependabot configured (`.github/dependabot.yml`) for npm (root, `mobile/`) and GitHub Actions; `npm audit` reviewed; two dependencies patched via `patch-package` (see [Dependency security](#dependency-security)) | New vulnerabilities can be disclosed after release; Dependabot/audit tooling only knows about publicly disclosed advisories |
| Malicious content payload (Library remote update) | Content is schema-validated at build time (`content-lib/schemas/`) before publication; the app enforces a schema-version literal check and fails closed on any shape it doesn't recognize | The remote content manifest is served over HTTPS from GitHub Pages with no additional content-signing beyond TLS + schema validation — see [Content integrity](#content-integrity) |
| Stale or incorrect content build | `contentHash` per book in `content-manifest.json`, generated from the same build pipeline that produces the payload; hash mismatch triggers re-download | Does not detect a build that is internally consistent but was generated from wrong/incorrect source content |
| Network interception (MITM) | All remote endpoints used by the app are HTTPS (`https://vedantayojana.org/...`); release-build cleartext traffic is not enabled (see [Network security](#network-security)) | Standard TLS trust-chain assumptions apply; no certificate pinning is implemented |
| Malicious third-party APK mirror | Not part of the project's distribution; users are explicitly directed to the project's GitHub Releases page only | The project cannot prevent third parties from mirroring or renaming the APK; this is why signature/checksum verification matters for anyone who sideloads instead — see [APK-VERIFICATION.md](APK-VERIFICATION.md) |
| Accidental release of a debug-signed or debug-configured build | Release builds are produced via EAS with the production signing credential (`production` / `production-apk` profiles), which is distinct from `development`/`preview` | **This risk has materialized once:** `android-v14` and `android-v15` were built by the `build-apk.yml` GitHub Actions workflow, which signs with the Android debug key, and published on the source repository's releases page — see [Signing & release provenance](#signing--release-provenance). Pushing an `android-v*` or `v*` tag still triggers that workflow; nothing in the build system prevents it |
| Malicious over-the-air (OTA) update | OTA updates are fetched over HTTPS only from this project's EAS Update endpoint, on the `production` channel, and only an update built for the installed runtime version (`1.0.3`) is accepted | EAS Update code signing is not configured, so an update's authenticity rests on TLS and the security of the Expo account that publishes it, not on a signature the app verifies |
| Compromised developer machine | Signing credentials are not stored locally (EAS-managed); `.env`/secret files are not committed (see [Secrets management](#secrets-management)) | A compromised machine with valid EAS/GitHub session credentials could still initiate actions under the developer's identity |

No entry in this table should be read as "risk eliminated." Each is a
specific, verifiable control with a specific, stated limit.

## Source & repository security

- **Repository:** [`slnwriteups/vedanta-yojana-source`](https://github.com/slnwriteups/vedanta-yojana-source) is public. Source, tests, and CI configuration are all visible.
- **Secret scanning:** enabled, with push protection enabled (verified via the repository's security-and-analysis configuration). This blocks/flags commits containing recognizable credential patterns before or immediately after they reach the repository.
- **Dependabot security updates:** enabled for npm (root and `mobile/`) and GitHub Actions, on a weekly schedule (`.github/dependabot.yml`).
- **Private vulnerability reporting:** enabled on this repository, giving the mechanism described in the root [SECURITY.md](../SECURITY.md) an actual, checked-on GitHub setting to back it, rather than only a documented intention.
- **Branch protection:** not currently configured on `main`. This is stated plainly as a residual gap rather than omitted — see [Security Limitations](#security-limitations).
- **CI (`ci.yml`):** runs content tests, app tests, TypeScript, and a production web build on every push and pull request, with `permissions: contents: read` (the job never writes back to the repository).
- **CodeQL (`codeql.yml`):** static analysis for JavaScript/TypeScript, on every push/PR to `main` and weekly on a schedule, so vulnerability patterns disclosed after a commit was written are still checked against it.
- **Source maps:** the web production build (`next build`, static export) is not configured to publish source maps as part of the deploy step in `deploy-pages.yml`; the deployed site therefore does not intentionally ship a client-side source map. This has not been independently re-verified against the literal bytes of the deployed `out/` directory as part of this documentation pass.

## Dependency security

Both the web root and `mobile/` commit a `package-lock.json`, and CI
installs with `npm ci` (exact, reproducible installs from the lockfile,
not `npm install`).

**Overrides (`mobile/package.json`):** `react-dom`, `postcss`, and
`uuid` are pinned via `overrides` to versions that close specific
Dependabot alerts, applied 2026-09-18 (`a2b82cf`).

**patch-package patches (`mobile/patches/`):**

| Patch | Target | Fixes |
|---|---|---|
| `decode-uri-component+0.2.2.patch` | `decode-uri-component@0.2.2` (transitive, via `query-string`/`@react-navigation/core`/`expo-router`) | Denial-of-service via exponential decoding of malformed percent-encoded input |
| `metro++image-size+1.2.1.patch` | `metro`'s nested `image-size@1.2.1` | Infinite-loop denial-of-service in the ICNS and JPEG XL parsers — see below |

`npm audit --omit=dev` in `mobile/` currently reports 12 advisories (4
moderate, 8 high) against the `metro`/`@expo/metro-config`/`@expo/cli`
dependency chain and `image-size` itself. This is expected and does
not indicate an unpatched runtime vulnerability: `npm audit` matches
against published package *versions*, and has no way to know that a
locally applied `patch-package` patch already fixes the specific
vulnerable code path inside an installed version it still considers
vulnerable by version number. The `image-size` entry specifically
covers the exact ICNS/JXL infinite-loop issue described below, which
is patched — see [Security testing](#security-testing) for how that
patch is verified to actually be in effect, rather than trusted on
the strength of the patch file existing.

Separately: `metro` and its dependency chain are **build-time tooling**
— they run on the developer/CI machine while bundling the app, and are
not themselves shipped inside the built Android artifact. A
denial-of-service in a build-time bundler is a real risk (a malicious
crafted asset reaching the bundler could hang a build or a
developer's machine), but it is not a runtime risk to an end user's
installed app.

## The image-size vulnerability

**Package:** `image-size@1.2.1`, resolved as a nested dependency of
`metro` at `mobile/node_modules/metro/node_modules/image-size` (not a
direct dependency of this project).

**Vulnerability class:** synchronous infinite loop (denial of
service), triggerable by a crafted image file with a malformed,
zero-length internal box/entry.

**Affected parsers and root cause:**

- `ICNS.calculate()` (`dist/types/icns.js`) advances a read cursor by
  each icon entry's own declared length field. A crafted entry
  declaring length `0` left the cursor unchanged, so the function's
  `while` loop re-read the same bytes forever.
- `JXL.extractPartialStreams()` (`dist/types/jxl.js`) has the same
  pattern for JPEG XL container "boxes": a crafted `jxlp` box
  declaring size `0` caused the same unchanged-cursor infinite loop.

Both functions had their own separate cursor-advancement logic,
distinct from `image-size`'s own internal `findBox()` helper (used
elsewhere in the package), which already had an equivalent guard —
these two call sites did not go through it and lacked one.

**Why upgrading was not used:** a newer `image-size` release was
evaluated and found incompatible with the pinned Metro/toolchain
version this project currently depends on. Upgrading Metro itself to
reach a compatible `image-size` was out of scope for this fix — it
would be a build-tooling upgrade with its own separate risk surface,
not a targeted security fix.

**The applied fix (`mobile/patches/metro++image-size+1.2.1.patch`):**
adds a minimum-advance guard to both loops — when the declared
entry/box length is `0`, the cursor advances by a fixed minimum size
instead of by `0`, so the loop can never stall on a crafted zero-length
field. Both changes are two-line diffs, changing only the cursor
arithmetic, not the parsers' logic otherwise.

**What this patch protects against:** a build-time hang triggered by a
crafted `.icns` or `.jxl` file with a zero-length internal field
reaching Metro's asset bundler.

**What this patch does not protect against:** it is a fix for this
one specific bug class in these two specific parsers. It is not a
general security review of `image-size`, and does not claim to cover
other potential parsing issues in that package or in Metro's broader
asset-handling pipeline.

## Security testing

**Regression test:**
[`mobile/tests/image-size-zero-size-box.test.ts`](../mobile/tests/image-size-zero-size-box.test.ts),
driving a fixture at
[`mobile/tests/fixtures/image-size-zero-box-check.cjs`](../mobile/tests/fixtures/image-size-zero-box-check.cjs).

The fixture imports the *actual installed* nested package
(`mobile/node_modules/metro/node_modules/image-size`) — the same copy
Metro resolves at build time and the same copy the patch targets — not
a separately installed or newer copy. It constructs a minimal crafted
ICNS file (zero-length entry) and a minimal crafted JPEG XL container
(zero-size `jxlp` box) and calls the package's `imageSize()` on each.

**Why a child process with a hard timeout is used:** the vulnerability
is a fully synchronous infinite loop. Nothing that runs *in the same
process* — a `Promise` timeout, `node:test`'s own per-test timeout —
can preempt a synchronous busy loop running on the same thread the
test itself occupies. The only reliable way to bound it is to run the
check in a separate process and kill that process from the outside if
it overruns. The test does this via `child_process.spawnSync(...,
{ timeout: 5000 })`: if the fixture hangs, the OS kills it after 5
seconds (surfaced as `result.signal === 'SIGTERM'`), and the test fails
with a diagnostic message rather than hanging the suite indefinitely.

**Verified to actually detect a regression, not just to exist:** while
writing this test, the patch was temporarily reverted in the installed
package, the test was re-run, and it failed exactly as expected — the
fixture process was killed by `SIGTERM` after timing out
(`error.code === 'ETIMEDOUT'`). The patch was then restored and
confirmed byte-identical to the shipped version via `diff` before the
test was committed. This step is not something the test re-performs on
every run (that would require shipping a deliberately vulnerable copy
of a real dependency); it was a one-time manual verification during
development, recorded in the test's own doc comment.

This test runs as part of the mobile test suite (`node --test
mobile/tests/*.test.ts`), which is part of the project's regular test
run — see [DEVELOPMENT.md](DEVELOPMENT.md#testing-architecture) for
the full suite breakdown and current counts.

## Build security

- **Hermes bytecode:** the release JavaScript bundle is compiled to
  Hermes bytecode (`hermesEnabled` in the prebuild-generated
  `mobile/android/`, which is not committed), not shipped as readable
  source.
- **R8 minification and resource shrinking:** enabled for release
  builds (`enableProguardInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`
  in `mobile/app.json`'s `expo-build-properties` config; applied via
  `minifyEnabled`, `shrinkResources`, and `proguardFiles` in
  `build.gradle`).
- **Native architecture scope:** builds target `arm64-v8a` only
  (`buildArchs` in `expo-build-properties`).
- **Reproducible installs:** `npm ci` from a committed lockfile, both
  in CI and for the production build.
- **Production build isolation:** the production Android build runs on
  EAS's own build infrastructure via the `production` profile in
  `mobile/eas.json`, not on a local developer machine — see
  [Signing & release provenance](#signing--release-provenance).

## Android security

Verified against the merged manifest of the published v16 APK
(`android-v16`, SHA-256 `e4193fce…4584`, read with `aapt2 dump`) and
`mobile/app.json`. The native project under `mobile/android/` is
generated by `expo prebuild` from `app.json` at build time and is not
committed (it is gitignored), so the shipped APK is the authoritative
evidence:

| Property | Value | Evidence |
|---|---|---|
| Package name | `com.slnwriteups.vedantayojana` | `mobile/app.json` |
| Declared permissions | `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `MODIFY_AUDIO_SETTINGS`, `REQUEST_INSTALL_PACKAGES`, `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` (plus the app's own `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`). `REQUEST_INSTALL_PACKAGES` lets the in-app update notice hand a downloaded APK to Android's package installer, which always asks the user to confirm; the rest are requested in `app.json` or merged in from Expo/AndroidX libraries | v16 APK merged manifest; `mobile/app.json` (`android.permissions`) |
| Explicitly blocked permissions | `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `RECORD_AUDIO` (listed in `app.json`'s `blockedPermissions`; absent from the v16 APK) | `app.json`, v16 APK |
| `usesCleartextTraffic` | Not set in the release manifest — Android's secure default (`false` for `targetSdkVersion >= 28`) applies | The v16 APK's merged manifest has no `usesCleartextTraffic` attribute. (Debug builds generated by prebuild set it `true` — the standard React Native debug convention, which does not affect release builds.) |
| `allowBackup` | `true` — Android's default; the app's local data (preferences, bookmarks, reading positions, downloaded books) may be included in the user's own device backup | v16 APK merged manifest |
| Exported components | `MainActivity`, `android:exported="true"` (required for the launcher/deep-link intent filters it declares); AndroidX `ProfileInstallReceiver`, exported but restricted to callers holding the system-only `DUMP` permission. All Expo services and file providers are `exported="false"` | v16 APK merged manifest |
| Deep link scheme | `vedantayojana://` (custom scheme, plus a `BROWSABLE` intent filter for `https` `VIEW` intents declared under `<queries>`) | v16 APK merged manifest, `app.json` (`"scheme": "vedantayojana"`) |
| Debuggable | Not debuggable — no `android:debuggable` attribute in the release manifest | Confirmed directly on the EAS-built v16 production APK (`aapt2 dump badging` reports no `application-debuggable`); earlier also confirmed on the v13 production build |
| In-app auto-update mechanism | From v16 (1.0.3): EAS Update (`expo-updates`) is enabled — `expo.modules.updates.ENABLED` is `true`, runtime version `1.0.3`, channel `production`, checked on every launch. It replaces the JavaScript bundle and bundled content only; native code and the APK itself can only change through a manual install. v15 and earlier have OTA disabled (`false`). Separately, `mobile/services/updateCheckService.ts` compares the running versionCode against `https://vedantayojana.org/app-version.json` and, if a newer APK is published, shows an "Update available" notice. From v14 on, tapping it downloads the APK inside the app and hands it to Android's package installer, which asks the user to confirm (nothing installs silently); v13 opens the download in the browser; v10 polls an older address (`slnwriteups.github.io/vedanta-yojana/app-version.json`) that no longer exists, so it shows no notice. | v16 APK merged manifest, `mobile/app.json`, `updateCheckService.ts`, `components/UpdateBanner.tsx`, the published v10–v16 APKs |

## Network security

All remote endpoints referenced in the mobile app's source are HTTPS,
served from GitHub Pages:

| Endpoint | Purpose | Source |
|---|---|---|
| `https://vedantayojana.org/content-manifest.json` | Library content catalog/version check | `mobile/services/libraryCatalogService.ts` |
| `https://vedantayojana.org/app-version.json` | App version/update check | `mobile/services/updateCheckService.ts` |
| `https://vedantayojana.org/...` (book payloads) | Library book content download | `mobile/services/bookOfflineService.ts` |

No `localhost` or development-server URL is referenced outside Expo's
own development-client tooling (which is not part of a release build).
No certificate pinning is implemented; the app relies on the
platform's standard TLS trust chain. There is no in-app authentication
system and no user account, so there is no credential to intercept in
the first place — see [Privacy & Data Access](../README.md#privacy--data-access)
in the README for what the app does and does not send over the
network.

**What the app does offline:** bundled Pasurams remain fully available
with network fully disabled — verified on a physical device during
release-engineering QA (Wi-Fi and mobile data both disabled via `adb
shell svc wifi disable` / `svc data disable`, confirmed unreachable via
a failed `ping`, then a bundled Pasuram opened successfully). Library
content that has never been downloaded, and version-check data, are
unavailable offline by nature — the app fails closed (treats an
unreachable manifest the same as "no update", per
[Library remote-update architecture](DEVELOPMENT.md#library-remote-update-architecture)),
not by falling back to a cached or default value that might be wrong.

## Content integrity

Three categories of data reach the app by three different paths, with
three different integrity properties:

| Category | Examples | Delivery | Integrity mechanism |
|---|---|---|---|
| Bundled content | Pasurams (compressed archive), the JS/Hermes bundle itself | Compiled into the installed APK/AAB | Covered by the APK's own signature — see [Signing & release provenance](#signing--release-provenance) |
| OTA updates (v16 and later) | A replacement JS/Hermes bundle and its assets | Downloaded over HTTPS from EAS Update at launch, applied on the next restart | Not covered by the APK signature; HTTPS plus runtime-version matching only (EAS Update code signing is not configured) |
| Remote Library content | Book chapters, Library catalog | Fetched over HTTPS from GitHub Pages at runtime | Per-book `contentHash` compared against the installed copy; schema-version literal check fails closed on an unrecognized shape (see [Library remote-update architecture](DEVELOPMENT.md#library-remote-update-architecture)) |
| Application metadata | `app-version.json` | Fetched over HTTPS from GitHub Pages at runtime | Used only to prompt a manual update; never drives a silent code change |

This is a meaningful distinction for users to understand: "the
application fetches remote data" (true, for Library content and
version metadata) is a different statement from "the application
uploads personal data" (not observed anywhere in the audited source —
see the Privacy section of the README).

**Content-accuracy audit (2026-09-18):** the same day's commits
(`3db9724` through `0df4000`, and content-adjacent fixes `4d6c7e8`,
`40d8940`) corrected chapter ordering, special-note rendering,
formatting/punctuation, and transcribed the three Charama Shlokams from
source images. These are *internal consistency* corrections — content
now renders the way its own source data says it should — not a
historical or doctrinal accuracy review of the underlying religious
texts. See [Security Limitations](#security-limitations).

## Signing & release provenance

**Distribution model.** The Android app is open source and distributed
only through GitHub: signed APKs are published on
[`vedanta-yojana-releases`](https://github.com/slnwriteups/vedanta-yojana-releases/releases),
and content and JavaScript fixes reach installed apps through EAS
over-the-air updates. It is not published on Google Play or any other
app store, and there are no plans to publish it there (decision
recorded 2026-09-24). Because APKs are distributed directly, the
certificate on a user's device is the project's own production
certificate — there is no store re-signing key.

*Historical note:* until 2026-09-24 the plan was to publish on Google
Play. No Play submission was ever made (`eas submit:list --platform
android` returned no submissions, and `mobile/eas.json`'s
`submit.production` profile never carried a configured service account
or track).

**What is explicitly true today:**

- The locally generated Gradle release-signing configuration
  (`mobile/android/app/build.gradle`, produced by `expo prebuild` and
  not committed) has historically pointed the
  `release` signing config at `debug.keystore` — the standard React
  Native template default. A build produced with this local
  configuration is a **debug-signed artifact** and has correctly
  **not** been published anywhere as an official release. The
  repository defines no `signingConfigs.release` block of its own.
- EAS holds a separate, existing production Android signing credential
  for this project, managed remotely by Expo — not stored in this
  repository, not stored on any local developer machine. This was
  confirmed by inspecting EAS build history (`eas build:list`), which
  shows prior successful Android builds using the `production` profile
  with `distribution: store`, and directly by EAS build logs reporting
  `Using remote Android credentials (Expo server)` and `Using Keystore
  from configuration: Build Credentials DlSst9jBhk (default)` when a
  production build is initiated.
- The project's official Android release artifact is an APK built and
  signed through this EAS-managed credential via `eas build --profile
  production-apk --platform android` — not through the repository's
  local Gradle debug-keystore path, and not through the `build-apk.yml`
  GitHub Actions workflow, which signs with the debug key.

**v13 AAB (historical, never uploaded):** a production AAB had been built
via EAS (build `8140578b-0f56-48b7-b31d-1ab680b291b3`, versionCode 13,
source commit `73b0fff`) and independently verified: signed with the
existing production credential (not `debug.keystore`), package
identity, version, non-debuggable state, Hermes bytecode, and R8
obfuscation all confirmed directly from the built artifact, and the
exact artifact re-tested on a physical device (fresh install, upgrade
install, navigation, all September 19 content fixes, zero crashes) —
see [APK-VERIFICATION.md](APK-VERIFICATION.md) for the exact values. It
was prepared for Google Play and was never uploaded; with the move to
GitHub-only distribution it will not be. The v13 release published on
GitHub is an APK (EAS build `f39d545b-0f21-40c8-8449-9f0d4cfd387e`,
SHA-256 `400db3b6…cd4d4`) signed with the same production certificate.

**v16 (1.0.3) — current Android release and OTA baseline:** an APK
built via EAS (build `1f5e3c13-39f7-4766-82ba-57712d373153`,
`production-apk` profile, versionCode 16, source commit `2860fda`),
signed with the same production credential as v13 (certificate SHA-256
`6f1a6565…cbab8597`) and verified directly from the artifact: package
identity, version, and the OTA configuration (`expo.modules.updates`
enabled, runtime `1.0.3`, channel `production`, check on every launch).
OTA delivery has been verified end to end on a physical device: with
v16 installed, and without reinstalling or clearing data, the device
downloaded and applied three production-channel updates — update
groups `8ec8b1ab-8434-48c3-aa61-b8d838487708` (Telugu Pasurams),
`82b485ac-741b-4f75-a59f-4efe7bb743d0` (Pasuram source attribution) and
`f1d701e5-bb91-4b37-9cda-0215fb0a5a38` (Pasuram order fix and Telugu
chapter revisions) — and displayed the changed content while remaining
on versionCode 16 / 1.0.3, with its install time unchanged and the
installed APK byte-identical to the published v16. v16 is published on
the releases repository as `android-v16`, marked Latest.

**v14 and v15 are not production releases.** Both were built by the
`build-apk.yml` GitHub Actions workflow, which signs with the Android
debug key (certificate SHA-256 `fac61745…91033b9c`), and neither has
OTA updates enabled. v15 in particular is not an OTA baseline. Since
2026-09-24 both are marked as pre-releases with a warning in their
release notes. See
[APK-VERIFICATION.md](APK-VERIFICATION.md#builds-that-are-not-official-releases).

**Why this matters to a user:** a valid signature establishes that a
given APK file was signed with the private key corresponding to a
specific, consistent identity — the same identity across every release
signed with that key, letting a user's device (and a user, manually)
confirm an update genuinely comes from the same publisher as a
previous install. It does not, by itself, prove the signed software is
free of bugs or vulnerabilities.

## Secrets management

- No `.env` file, keystore file, or credential belonging to the
  *current* application is committed to the repository (verified by
  inspecting the working tree and `.gitignore`; secret scanning is
  additionally enabled — see
  [Source & repository security](#source--repository-security)).
- **Correction (2026-09-19 pre-publication audit):** a Google/Firebase
  Web API key (the `AIzaSy...` pattern) belonging to the *legacy*,
  pre-rewrite version of this application is committed twice in this
  repository: once inside the raw legacy bundle
  (`_next/static/chunks/pages/_app-*.js`) and once in its decoded form
  (`content-extraction/_generated/app-definition.json`). GitHub's
  secret scanning has not flagged it (confirmed via the repository's
  own alerts API, which currently returns none). This key is not used
  by, and has no bearing on, the current application — a full grep of
  `app/`, `components/`, `lib/`, `mobile/`, and `content-lib/` confirms
  no Firebase dependency exists in the current codebase. It belongs to
  a retired project. It should still be rotated or the underlying
  Firebase project deleted/disabled by whoever holds access to it,
  since a syntactically valid, publicly visible API key is a legitimate
  finding regardless of whether the project it authenticates against is
  still in active use — see Blocking Issues in the 2026-09-19
  pre-publication audit.
- The one GitHub Actions secret referenced in this repository's
  workflows is `secrets.DEPLOY_REPO_TOKEN`
  (`.github/workflows/deploy-preview-repo.yml`), a scoped token used
  only to publish a static export to a separate, non-production
  preview repository — it is not a signing credential and has no
  bearing on the Android release.
- Android production signing credentials are held by EAS, not by this
  repository or any file in it — see
  [Signing & release provenance](#signing--release-provenance).

## Security limitations

Stated explicitly, because transparency about limitations is more
useful to a user than reassurance:

- **Source availability is not proof of build provenance.** Anyone can
  read this repository's source. That alone does not prove any
  specific binary was built from it — it establishes what *should*
  have been built. Confidence that a specific published APK matches
  this source comes from the combination of a documented source
  commit, a documented EAS build, and independent signature/checksum
  verification against that specific artifact — not from source
  visibility alone.
- **EAS, GitHub, and the Android platform are third-party
  infrastructure dependencies.** This project's build, distribution,
  and installation security ultimately rests in part on Expo's,
  GitHub's, and Google's own platform security — none of which this
  project controls or can independently audit.
- **No branch protection is currently configured on `main`.** Any
  collaborator with write access can push directly to the branch that
  CI and deployment both build from.
- **New vulnerabilities can be disclosed after release.** Dependency
  scanning (Dependabot, `npm audit`, CodeQL) only knows about publicly
  disclosed issues at the time it runs.
- **Content validation is not content accuracy.** Schema validation and
  the 2026-09-18 formatting/ordering audit establish that stored
  content is internally consistent with its own declared structure.
  Neither establishes that every religious or historical statement in
  that content is factually correct — that is a domain/editorial
  question outside what engineering verification can answer.
- **Four stale, non-production releases remain publicly published in
  `vedanta-yojana-releases`** as of the 2026-09-19 pre-publication
  audit: `mobile-v1.0.0` through `mobile-v1.0.3`. Each is a debug-signed
  (`CN=Android Debug`), wrong-package-identity
  (`com.anonymous.vedantayojana` rather than
  `com.slnwriteups.vedantayojana`) APK from earlier ad-hoc testing —
  confirmed directly against each artifact's own signing certificate
  and package manifest, not inferred. They are not draft — an
  unauthenticated user can currently download them, and several already
  have. They do not affect the currently published `android-v10`
  release (independently re-verified in the same audit: correct
  package, correct production certificate, checksum matches its
  published digest) but should be deleted before public announcement
  to avoid a user mistaking one for a real release. See
  [APK Verification Guide](APK-VERIFICATION.md) for how a user can tell
  the difference in the meantime: checksum and certificate must match
  the specific version's published values, not merely come from this
  repository.
- **No security control here is absolute.** Each mitigation in the
  [threat model](#threat-model) has a stated residual risk. Treat this
  document as a description of what is actually in place, not as a
  guarantee.
