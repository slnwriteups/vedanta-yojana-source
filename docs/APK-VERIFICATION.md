# Vedanta Yojana Android APK Verification Guide

This guide explains how to confirm that an Android installation
claiming to be Vedanta Yojana is the official release, and how to
distinguish it from a renamed, repackaged, or otherwise unofficial
file.

## Official source

Vedanta Yojana is open source and is distributed **only through
GitHub**. It is not published on Google Play or any other app store,
and there are no plans to publish it there (decision recorded
2026-09-24; an earlier plan to list it on Google Play has been
dropped).

- **GitHub Releases** — the one official place to download the
  Android APK:
  [`slnwriteups/vedanta-yojana-releases`](https://github.com/slnwriteups/vedanta-yojana-releases/releases).
  This is a separate, binary-only repository (no source code) that
  hosts the signed release APKs. Every release there is built by EAS,
  signed with the project's production credential, and published with
  a `.sha256` checksum file for independent verification.
- **Over-the-air (OTA) updates** — once v16 or later is installed, the
  app receives content and JavaScript fixes automatically from the
  project's EAS Update endpoint. These do not replace the APK or change
  its signature (see [Release identity](#release-identity)).

This source repository (`vedanta-yojana-source`) holds the project's
source code, documentation, and release-provenance record — it is
**not** an Android distribution channel. Its `android-v14` and
`android-v15` releases do carry APK files, but those were produced by
an older CI workflow and signed with the public Android debug key;
they are not official releases (see
[Builds that are not official releases](#builds-that-are-not-official-releases)).

**A release only counts as genuine if its SHA-256 checksum and signing
certificate match the values published for that version** (see Levels
1 and 2 below) — not merely because it came from a URL under
`github.com/slnwriteups/vedanta-yojana-releases`. A file whose checksum
or certificate doesn't match what's documented for its version should
be treated like an APK from any other unverified source: do not
install it. Any APK obtained from a mirror site, an app store, a
forwarded file, or a search-engine result is **not an official
source**, regardless of what its filename or app icon says.

## Release identity

> **Status:** v16 (1.0.3) is the current Android release and the
> baseline for over-the-air (OTA) updates. It is an APK built via EAS
> with the project's production signing credential — the same
> certificate as v13 — and was verified directly from the built
> artifact. It is published, marked Latest, as
> [`android-v16`](https://github.com/slnwriteups/vedanta-yojana-releases/releases/tag/android-v16)
> on the releases repository, together with its `.sha256` checksum
> file; the published asset's SHA-256 was re-checked against the value
> below after publication. Nothing below is a placeholder or invented
> value; everything listed was read directly from the artifacts.

| Property | v16 (current) | v13 |
|---|---|---|
| Package name (`applicationId`) | `com.slnwriteups.vedantayojana` | `com.slnwriteups.vedantayojana` |
| versionName | `1.0.3` | `1.0.0` |
| versionCode | `16` | `13` |
| Published APK | [`android-v16`](https://github.com/slnwriteups/vedanta-yojana-releases/releases/tag/android-v16) | [`android-v13`](https://github.com/slnwriteups/vedanta-yojana-releases/releases/tag/android-v13) |
| APK SHA-256 | `e4193fcec40d01c28ca047ea01920a62295ce5c345a23999ff7bbdfceaac4584` | `400db3b630265247bfb537778a8f959ad132e11249db271a96c746ee545cd4d4` |
| Signing certificate SHA-256 | `6F:1A:65:65:D8:C6:C3:AB:3E:2F:D7:69:90:CA:13:74:D5:6D:2F:A3:53:0E:50:61:38:69:FE:34:CB:AB:85:97` | same |
| Signing certificate SHA-1 | `1D:99:66:22:1F:6A:15:9B:B6:50:E5:CC:B4:01:78:A0:2D:88:FC:ED` | same |
| OTA updates | Enabled — runtime `1.0.3`, channel `production`, checked on every launch | Not enabled |
| Source commit | `2860fda683a5d88cf141264d3c870fd8a4701d6c` | `7b76e27e10d0f305d18ed6d474431066547c61e4` |
| EAS build ID | `1f5e3c13-39f7-4766-82ba-57712d373153` (`production-apk` profile) | `f39d545b-0f21-40c8-8449-9f0d4cfd387e` (`preview` profile) |

Because the app is distributed directly rather than through an app
store, the certificate above is exactly the one an installed app
carries on your device — there is no separate store re-signing key.
Verify against whichever version you have installed, not against an
older one.

OTA updates change the app's bundled JavaScript and content, not the
APK: an installed v16 keeps versionCode `16` and the signing
certificate above after applying an update, so these values remain the
correct ones to verify against.

*Historical note:* on 2026-09-19 a v13 Android App Bundle (AAB) was
also built for a planned Google Play submission (EAS build
`8140578b-0f56-48b7-b31d-1ab680b291b3`, source commit `73b0fff`, AAB
SHA-256 `8fa98326593d4e77dd686c88358526510af1308cfb4671fdf374d68e05ba682d`,
same certificate). It was never uploaded, and the Google Play plan has
since been dropped; the published v13 is the APK in the table above.

### Builds that are not official releases

`android-v14` (1.0.1, versionCode 14) and `android-v15` (1.0.2,
versionCode 15), published on this source repository's releases page,
were built by the repository's older GitHub Actions workflow and are
signed with the public Android debug key (certificate SHA-256
`FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`),
not the production certificate above. Neither has OTA updates enabled.
Because Android only accepts an update signed with the same key as the
installed app, a device with v14 or v15 installed must uninstall it
before installing v16. Since 2026-09-24 both releases are marked as
pre-releases on the source repository, with a notice at the top of
their release notes saying they are not official production releases
and pointing to v16.

## Level 1 — Verify the SHA-256 checksum (for a downloaded file)

Download the APK only from the official GitHub Releases page linked
above, and verify it before installing. The SHA-256 is a short
fingerprint of the file's exact contents: if even one byte changes,
the checksum changes completely.

Each release includes a `vedanta-yojana.apk.sha256` file. With both
files in the same folder:

```
shasum -a 256 -c vedanta-yojana.apk.sha256
```

Or compute the checksum yourself:

**macOS**
```
shasum -a 256 <filename>
```

**Linux**
```
sha256sum <filename>
```

**Windows (PowerShell)**
```
Get-FileHash .\<filename> -Algorithm SHA256
```

Compare the result against the value in the
[Release identity](#release-identity) table and in that release's notes.

## Level 2 — Verify the signing certificate

Every Android APK is cryptographically signed. The signature does not
just prove the file is intact (the checksum already tells you that) —
it proves the file was signed by whoever holds a specific private key,
and lets you confirm that a future update was signed by the *same* key
as a previous install.

Using the Android SDK's `apksigner` tool (part of Android build-tools;
verified here against build-tools 36.0.0):

```
apksigner verify --print-certs <filename>
```

This prints the signing scheme(s) used and, for each signer, a
certificate fingerprint (including SHA-256). Compare the printed
certificate SHA-256 against the **signing certificate** in the
[Release identity](#release-identity) table, and confirm the package
name and version match what you expected
(`com.slnwriteups.vedantayojana`, the version you intended). The same
comparison works for an app already installed on your device, since
directly distributed APKs keep the project's own signing certificate.

**What a valid signature establishes:** the APK was signed using the
private key corresponding to the published release identity, and its
contents have not been altered since signing.

**What it does not establish:** a valid signature says nothing about
whether the signed software is free of bugs or vulnerabilities. It is
evidence of *authenticity* (this file came from the key that signed
official releases), not evidence of *safety*.

## Level 3 — Cross-check source provenance

Because the project is open source, an advanced user can compare, for
a given release:

- The release's documented **source commit** against this repository's
  own Git history.
- The documented **EAS build** used to produce the artifact.
- The **published checksum and certificate fingerprint** against what
  you compute locally, per Levels 1 and 2 above.

Important limitation: **source availability alone does not prove a
specific binary was built from that source.** Anyone can read this
repository. What increases confidence is the *combination* — a
documented commit, a documented build, and an independently verifiable
checksum/signature on the specific artifact — not any one of these
alone. This project does not currently offer bit-for-bit reproducible
builds; the combination above is the strongest evidence currently
available, and is weaker than cryptographic reproducibility would be.

## Strong evidence vs. weak evidence

| Strong evidence | Weak evidence |
|---|---|
| Downloaded from the official GitHub Releases page | The APK's filename |
| Matching SHA-256 checksum | The application's icon |
| Matching signing certificate fingerprint | Screenshots |
| Matching package name and version | A website's appearance |
| A documented source commit + build | Claims made by a third-party mirror or store listing |

Anyone can rename a file, copy an icon, or claim a file is "official."
None of that is evidence. A cryptographic signature and a published
checksum are evidence, because forging them without the actual signing
key is computationally infeasible.

## If you got an APK from somewhere else

If you already have an APK claiming to be Vedanta Yojana from any
source other than the official GitHub Releases page — including any
app store, since the project is not published on one:

1. Do not install it.
2. Compare its SHA-256 and signing certificate against the values
   published for the corresponding version in this repository, using
   the commands above.
3. If either does not match — or no official release with that version
   exists — do not install it, and consider reporting where you found
   it (see [SECURITY.md](../SECURITY.md)).

This check applies even to a file downloaded from the GitHub Releases
repository itself: match the specific release tag's checksum and
certificate before trusting it, not just the fact that it came from
that repository.

## Summary

- The only official source for the Android app is the GitHub Releases
  page at `slnwriteups/vedanta-yojana-releases`; the app is not on any
  app store.
- Authenticity (does this come from the claimed publisher) is
  established by the signing certificate.
- Integrity (is this the exact file that was published) is established
  by the SHA-256 checksum.
- Neither establishes that the software is free of security
  vulnerabilities — see [docs/SECURITY.md](SECURITY.md) for what
  security testing has and has not been done.
