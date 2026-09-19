# Vedanta Yojana Android APK Verification Guide

This guide explains how to confirm that an Android installation
claiming to be Vedanta Yojana is the official release, and how to
distinguish it from a renamed, repackaged, or otherwise unofficial
file.

## Official source

The official Android distribution channel is **Google Play**. Once
published, the listing will be linked from the project
[README](../README.md#download).

This source repository (`vedanta-yojana-source`) is the project's
source code, documentation, and release-provenance record — it is
**not** itself an Android distribution channel. Any APK obtained
outside of the official Google Play listing — a mirror site, a
forwarded file, a search-engine result — is **not an official source**,
regardless of what its filename or app icon says.

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
| versionCode | `11` |
| AAB SHA-256 | `c09cd4de1040e97789756acb39652e50ac57151555f845f9885f28ad215c5579` |
| Upload certificate SHA-256 | `6F:1A:65:65:D8:C6:C3:AB:3E:2F:D7:69:90:CA:13:74:D5:6D:2F:A3:53:0E:50:61:38:69:FE:34:CB:AB:85:97` |
| Upload certificate SHA-1 | `1D:99:66:22:1F:6A:15:9B:B6:50:E5:CC:B4:01:78:A0:2D:88:FC:ED` |
| Google Play app-signing certificate SHA-256 | *not yet available — assigned on first Google Play upload* |
| Source commit | `ff4d227de15356d5309dd0399afc59c0b0511be3` |
| EAS build ID | `6cb099a8-cf63-4c8e-8c08-8d7d362309ce` |

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

## Level 1 — Install only from Google Play

The simplest and strongest protection is also the easiest: install and
update only through the official Google Play listing. Play verifies
the app's signature against its own records on every install and
update — a guarantee no manual verification step below can fully
substitute for.

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
other than the official Google Play listing:

1. Do not install it.
2. Compare its SHA-256 and signing certificate against the values
   published for the corresponding version in this repository, using
   the commands above.
3. If either does not match — or no official release with that version
   exists yet — do not install it, and consider reporting where you
   found it (see [SECURITY.md](../SECURITY.md)).

## Summary

- Authenticity (does this come from the claimed publisher) is
  established by the signing certificate.
- Integrity (is this the exact file that was published) is established
  by the SHA-256 checksum.
- Neither establishes that the software is free of security
  vulnerabilities — see [docs/SECURITY.md](SECURITY.md) for what
  security testing has and has not been done.
- The only way to start from a trustworthy baseline is to install from
  the official Google Play listing in the first place.
