# Vedanta Yojana Android APK Verification Guide

This guide explains how to confirm that an Android APK claiming to be
Vedanta Yojana is the official release published by this project, and
how to distinguish it from a renamed, repackaged, or otherwise
unofficial file.

## Official source

The only official distribution channel for the Android application is
this repository's **GitHub Releases** page:

> https://github.com/slnwriteups/vedanta-yojana-source/releases

Google Play is not used for distribution. Any APK obtained from
anywhere else — a mirror site, a forwarded file, a search-engine result
that isn't this GitHub Releases page — is **not an official source**,
regardless of what its filename or app icon says.

## Release identity

> **Status:** No Android release has been published yet. The values
> below (package name, scheme) are already fixed by the app's current
> configuration and verifiable in this repository today; the
> release-specific values (versionCode, APK filename, SHA-256,
> signing-certificate fingerprint, EAS build ID) will be filled in
> here, with real values, once a production build is completed and
> published — never with placeholder or invented numbers.

| Property | Value |
|---|---|
| Package name (`applicationId`) | `com.slnwriteups.vedantayojana` |
| versionName | `1.0.0` |
| versionCode | *not yet published* |
| APK filename | *not yet published* |
| APK SHA-256 | *not yet published* |
| Signing certificate SHA-256 | *not yet published* |
| EAS build ID | *not yet published* |

Once published, this table — and the corresponding GitHub Release page
— will carry the actual values for that specific build. Verify against
whichever release you downloaded, not against an older one.

## Level 1 — Use the official GitHub Release

The simplest and strongest protection is also the easiest: download
only from the GitHub Releases page linked above. A file obtained this
way came from the repository's own release infrastructure, which is a
fundamentally different guarantee than a file obtained from a mirror,
forum post, or search result — no verification step below can fully
substitute for this.

## Level 2 — Verify the SHA-256 checksum

A SHA-256 checksum is a short fingerprint of a file's exact contents.
If even one byte of the file changes, the checksum changes completely.
Comparing the checksum of the file you downloaded against the value
published on the release page tells you whether you have the *exact*
file the project published — not a corrupted download, and not a
substituted one.

Once a release is published, its SHA-256 will be given on the release
page (and optionally as a `.sha256` file attached to the release).
Compute it yourself and compare:

**macOS**
```
shasum -a 256 Vedanta-Yojana-1.0.0.apk
```

**Linux**
```
sha256sum Vedanta-Yojana-1.0.0.apk
```

**Windows (PowerShell)**
```
Get-FileHash .\Vedanta-Yojana-1.0.0.apk -Algorithm SHA256
```

Replace the filename with whatever the release actually names the
file. The output must match the published value exactly.

## Level 3 — Verify the signing certificate

Every Android APK is cryptographically signed. The signature does not
just prove the file is intact (the checksum already tells you that) —
it proves the file was signed by whoever holds a specific private key,
and lets you confirm that a future update was signed by the *same*
key as a previous install.

Using the Android SDK's `apksigner` tool (part of Android
build-tools; verified here against build-tools 36.0.0):

```
apksigner verify --print-certs Vedanta-Yojana-1.0.0.apk
```

This prints the signing scheme(s) used and, for each signer, a
certificate fingerprint (including SHA-256). Compare:

- The printed certificate SHA-256 against the value published on the
  release page for that specific version.
- The package name and version shown against what you expected
  (`com.slnwriteups.vedantayojana`, the version you intended to
  download).

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
- The documented **EAS build ID** (given in the release notes) against
  the build that produced the artifact.
- The **published checksum and certificate fingerprint** against what
  you compute locally, per Levels 2 and 3 above.

Important limitation: **source availability alone does not prove a
specific binary was built from that source.** Anyone can read this
repository. What increases confidence is the *combination* — a
documented commit, a documented build (EAS), and an independently
verifiable checksum/signature on the specific artifact — not any one
of these alone. This project does not currently offer bit-for-bit
reproducible builds; the combination above is the strongest evidence
currently available, and is weaker than cryptographic reproducibility
would be.

## Strong evidence vs. weak evidence

| Strong evidence | Weak evidence |
|---|---|
| Official GitHub Release page | The APK's filename |
| Matching SHA-256 checksum | The application's icon |
| Matching signing-certificate fingerprint | Screenshots |
| Matching package name and version | A website's appearance |
| A documented source commit + EAS build | Claims made by a third-party mirror |

Anyone can rename a file, copy an icon, or claim a file is "official."
None of that is evidence. A cryptographic signature and a published
checksum are evidence, because forging them without the actual signing
key is computationally infeasible.

## If you downloaded an APK from somewhere else

If you already have an APK claiming to be Vedanta Yojana from a source
other than this repository's GitHub Releases page:

1. Do not install it.
2. Compare its SHA-256 and signing certificate against the values
   published for the corresponding version on the official release
   page, using the commands above.
3. If either does not match — or if no official release with that
   version exists yet — do not install it, and consider reporting where
   you found it (see [SECURITY.md](../SECURITY.md)).

## Summary

- Authenticity (does this come from the claimed publisher) is
  established by the signing certificate.
- Integrity (is this the exact file that was published) is established
  by the SHA-256 checksum.
- Neither establishes that the software is free of security
  vulnerabilities — see [docs/SECURITY.md](SECURITY.md) for what
  security testing has and has not been done.
- The only way to start from a trustworthy baseline is to download from
  the official GitHub Releases page in the first place.
