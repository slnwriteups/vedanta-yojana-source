# Vedanta Yojana Android APK Verification Guide

This guide explains how to confirm that an Android installation
claiming to be Vedanta Yojana is the official release, and how to
distinguish it from a renamed, repackaged, or otherwise unofficial
file.

## Official sources

There are two legitimate distribution channels for this application,
serving different purposes:

- **Google Play** — the official app-store channel. This is where the
  app will eventually receive Google Play's own install-time signature
  verification and update management. Not yet published; the listing
  will be linked from the project [README](../README.md#latest-release)
  once it is.
- **GitHub Releases** — direct APK distribution, at
  [`slnwriteups/vedanta-yojana-releases`](https://github.com/slnwriteups/vedanta-yojana-releases/releases).
  This is a separate, binary-only repository (no source code) dedicated
  to hosting signed release artifacts, and is the project's intended
  public location for manually downloading the Android APK today, ahead
  of a Google Play listing. Publishing an APK there does not bypass the
  normal release process described in this guide — every release is
  built by the same EAS pipeline, signed with the same production
  credential, and published with a checksum for exactly this kind of
  independent verification.

This source repository (`vedanta-yojana-source`) is the project's
source code, documentation, and release-provenance record — it is
**not** itself an Android distribution channel, and does not host APK
files.

> **What checksum verification does and does not cover.** Since the
> build that introduced EAS Update, the app can receive JavaScript and
> asset updates over the air after it is installed (see
> [DEVELOPMENT.md](DEVELOPMENT.md#deployment-architecture)). Verifying
> an APK proves that the *binary* you installed is the one this project
> published — its native code, its permissions, and the JavaScript it
> shipped with. It does not cover a JavaScript bundle delivered later.
> Those updates are published only from `main` by
> `.github/workflows/eas-update.yml`, and a native change cannot be
> delivered this way at all: `mobile/app.json` uses a `fingerprint`
> runtime policy, so a bundle built after any native change is never
> offered to an older binary. Stating this plainly is the point of this
> guide — an unqualified "verify the checksum and you have verified the
> app" would no longer be true.

**A release only counts as genuine if its SHA-256 checksum and signing
certificate match the values published for that version** (see Levels
2 and 3 below) — not merely because it came from a URL under
`github.com/slnwriteups/vedanta-yojana-releases`. A release tag whose
checksum or certificate doesn't match what's documented for that
version should be treated the same as an APK from any other
unverified source: do not install it. Any APK obtained from a mirror
site, a forwarded file, or a search-engine result outside of these two
channels is **not an official source**, regardless of what its
filename or app icon says.

## Release identity

> **Status:** A production AAB has been built via EAS using the
> project's existing production signing credential and independently
> verified (see below), but has not yet been uploaded to Google Play.
> The Google Play app-signing certificate does not exist yet — it is
> assigned by Google Play App Signing on first upload — and will be
> added here once known. Nothing below is a placeholder or invented
> value; everything listed was read directly from the built artifact.

| Property | Value |
|---|---|
| Package name (`applicationId`) | `com.slnwriteups.vedantayojana` |
| versionName | `1.0.0` |
| versionCode | `13` |
| AAB SHA-256 | `8fa98326593d4e77dd686c88358526510af1308cfb4671fdf374d68e05ba682d` |
| Upload certificate SHA-256 | `6F:1A:65:65:D8:C6:C3:AB:3E:2F:D7:69:90:CA:13:74:D5:6D:2F:A3:53:0E:50:61:38:69:FE:34:CB:AB:85:97` |
| Upload certificate SHA-1 | `1D:99:66:22:1F:6A:15:9B:B6:50:E5:CC:B4:01:78:A0:2D:88:FC:ED` |
| Google Play app-signing certificate SHA-256 | *not yet available — assigned on first Google Play upload* |
| Source commit | `73b0fff00bfa8cd35e69bc3780e3b43b274db5fd` |
| EAS build ID | `8140578b-0f56-48b7-b31d-1ab680b291b3` |

Once uploaded to Google Play, this table will be updated with the
Google Play app-signing certificate fingerprint. Verify against
whichever version you have installed, not against an older one.

## Understanding Google Play App Signing (read this first)

Because this will be this application's first Google Play submission,
it goes through **Google Play App Signing**, which Google requires for
apps published as an Android App Bundle. This introduces two distinct
certificates, not one:

- **Upload certificate** — the key the project uses to sign the AAB
  before handing it to Google Play. This authenticates the upload to
  Google; it is not the certificate that ends up on a user's device.
- **App signing certificate** — a separate key that Google generates
  and holds, which actually re-signs the app for distribution to
  users. This is the certificate an installed app on a device carries.

**What this means for verification:** the certificate you see on an
*installed* app (via `apksigner` or `pm` on a device) is Google's app
signing certificate, not the project's upload certificate. Both will
be published here once known — the app signing certificate is the one
that matters for confirming what's actually on your device.

## Level 1 — Prefer Google Play once it's available

The simplest and strongest protection is also the easiest: once the
app is on Google Play, install and update only through that listing.
Play verifies the app's signature against its own records on every
install and update — a guarantee no manual verification step below
can fully substitute for.

Until then, download the APK only from the official GitHub Releases
page linked above, and verify it using Levels 2 and 3 below before
installing — this substitutes for Play's automatic check, but only if
you actually do it.

## Level 2 — Verify the SHA-256 checksum (for a downloaded file)

If you have a specific APK/AAB file — for example, one extracted from
your device, or shared for offline verification — its SHA-256 is a
short fingerprint of its exact contents. If even one byte changes, the
checksum changes completely.

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

Compare the result against the value published for the corresponding
release in this repository's release notes.

## Level 3 — Verify the signing certificate

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
certificate SHA-256 against the **Google Play app-signing certificate**
value published for the release (see
[Understanding Google Play App Signing](#understanding-google-play-app-signing-read-this-first)
above — not the upload certificate), and confirm the package name and
version match what you expected
(`com.slnwriteups.vedantayojana`, the version you intended).

**What a valid signature establishes:** the APK was signed using the
private key corresponding to the published release identity, and its
contents have not been altered since signing.

**What it does not establish:** a valid signature says nothing about
whether the signed software is free of bugs or vulnerabilities. It is
evidence of *authenticity* (this file came from the key that signed
official releases), not evidence of *safety*.

## Level 4 — Cross-check source provenance

For additional confidence, an advanced user can compare, for a given
release:

- The release's documented **source commit** (given in the release
  notes) against this repository's own Git history.
- The documented **EAS build** used to produce the artifact.
- The **published checksum and certificate fingerprint** against what
  you compute locally, per Levels 2 and 3 above.

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
| Installed via the official Google Play listing | The APK's filename |
| Matching SHA-256 checksum | The application's icon |
| Matching Google Play app-signing certificate fingerprint | Screenshots |
| Matching package name and version | A website's appearance |
| A documented source commit + build | Claims made by a third-party mirror |

Anyone can rename a file, copy an icon, or claim a file is "official."
None of that is evidence. A cryptographic signature and a published
checksum are evidence, because forging them without the actual signing
key is computationally infeasible.

## If you downloaded an APK from somewhere else

If you already have an APK claiming to be Vedanta Yojana from a source
other than the official Google Play listing or the official GitHub
Releases page:

1. Do not install it.
2. Compare its SHA-256 and signing certificate against the values
   published for the corresponding version in this repository, using
   the commands above.
3. If either does not match — or no official release with that version
   exists yet — do not install it, and consider reporting where you
   found it (see [SECURITY.md](../SECURITY.md)).

This check applies even to a file downloaded from the GitHub Releases
repository itself: match the specific release tag's checksum and
certificate before trusting it, not just the fact that it came from
that repository.

## Summary

- Authenticity (does this come from the claimed publisher) is
  established by the signing certificate.
- Integrity (is this the exact file that was published) is established
  by the SHA-256 checksum.
- Neither establishes that the software is free of security
  vulnerabilities — see [docs/SECURITY.md](SECURITY.md) for what
  security testing has and has not been done.
- The most trustworthy baseline, once available, is installing from
  the official Google Play listing. Until then, the official GitHub
  Releases page is the intended source — verify its checksum and
  certificate before installing either way.
