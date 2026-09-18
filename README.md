# Vedanta Yojana

An original collection of Divya Desam temple records, Vedantic
philosophy texts, and full-length books (Ramayana, Bhagavatam,
Mahabharata), maintained as clean, validated, versioned content —
served today through both a website and a native mobile app.

**Website:** https://slnwriteups.github.io/vedanta-yojana/
**Android:** see [Download](#download) below.

## Key features

- **108** Divya Desam temples (107 records — one record covers a
  combined two-shrine site), each in English, Tamil, Kannada, and Hindi
- **4** full-length books (162 chapters) plus a Knowledge section,
  readable online and downloadable for offline reading
- All Pasurams bundled into the app for fully offline access — no
  network required
- Reading preferences: font scale, light/dark theme, reading-position
  memory, bookmarks
- Library content can update independently of the app itself — see
  [Content Architecture](docs/DEVELOPMENT.md#content-architecture)

## Supported platforms

| Platform | Status |
|---|---|
| Web (any modern browser) | Live at the link above |
| Android | Distributed via GitHub Releases — see [Download](#download) |
| iOS | Not currently distributed |

## Download

The official Android release is distributed **only** through this
repository's GitHub Releases:

> **[GitHub Releases](https://github.com/slnwriteups/vedanta-yojana-source/releases)**

> For security and provenance, download Android releases only from the
> official Vedanta Yojana GitHub Release page. Do not use third-party
> APK mirrors — see [APK Verification Guide](docs/APK-VERIFICATION.md)
> for how to confirm a file you downloaded is genuine, and why filename
> or appearance alone is not evidence of that.

*A production Android release has not been published yet. This section
will be updated with a direct link once one is.*

## Security & verification summary

- The Android release is signed using this project's EAS-managed
  production signing credentials, not a local development key.
- Each release publishes a SHA-256 checksum and signing-certificate
  fingerprint so a downloaded file can be independently verified.
- Dependency vulnerabilities are tracked via Dependabot and `npm audit`;
  known issues are patched or remediated and covered by automated
  regression tests.
- Full detail: [Security Architecture](docs/SECURITY.md) ·
  [How to verify an APK](docs/APK-VERIFICATION.md) ·
  [Vulnerability reporting](SECURITY.md)

## Privacy & data summary

- No analytics, advertising, crash-reporting, or tracking SDK is
  present in the mobile app's dependencies.
- No account or sign-in is required or offered.
- Network requests fetch public content (Library book updates, version
  checks) from this project's own GitHub Pages site over HTTPS; nothing
  in the audited source uploads user data anywhere.
- Location access (coarse/fine) is used only to show the day's
  Panchangam for the user's approximate location.
- Full detail, including a permission-by-permission table: [docs/SECURITY.md](docs/SECURITY.md#android-security).

## Offline functionality

All Pasurams are bundled inside the app itself and work with no network
connection at all — verified on a physical device with Wi-Fi and mobile
data both disabled. Library books you've downloaded remain available
offline; checking for new or updated Library content and checking for
app updates both require connectivity. See
[Pasuram offline architecture](docs/DEVELOPMENT.md#pasuram-offline-architecture).

## Documentation

- [Development & Architecture](docs/DEVELOPMENT.md) — project history, system architecture, content pipeline, build/test/deploy architecture
- [Security Architecture](docs/SECURITY.md) — threat model, dependency security, build/Android/network security, signing
- [APK Verification Guide](docs/APK-VERIFICATION.md) — how to confirm a downloaded Android release is genuine
- [Vulnerability Reporting](SECURITY.md) — how to report a security issue

## The two runtimes

| | Website (repo root) | Mobile (`mobile/`) |
|---|---|---|
| Framework | Next.js (`output: "export"`, fully static) | Expo (React Native) |
| Status | **co-equal target — full feature parity** | **co-equal target — full feature parity** |
| Deploy | GitHub Pages, auto-deploys from `main` | GitHub Releases (see [Download](#download)); not submitted to Google Play |
| Detail | — | see `mobile/README.md` |

Both runtimes now carry the same feature set: content translation
(Tamil/Kannada/Hindi), a manual light/dark theme override, reading
preferences (font scale), reading-position memory, bookmarks, a
settings/onboarding flow, book cover art, and a daily-rotating "Divya
Desam Spotlight" card — ported from mobile's implementation onto the
website rather than redesigned, sharing the framework-agnostic pieces
(`content-lib/i18n.ts`, `content-lib/ordering.ts`,
`content-lib/divya-desam-spotlight.ts`, `lib/preferences.ts`,
`lib/ui-strings.ts`, and every `*-context.ts` file) directly. Only the
React Native-specific plumbing (AsyncStorage, `useColorScheme`,
`expo-router`, haptics) has a web-specific equivalent (`lib/storage.ts`,
`components/providers/*`). See `mobile/README.md` for mobile's own
detail; the split of what's shared vs. platform-specific between the
two is documented in each new web file's doc comment, tracing back to
its mobile source.

## Content pipeline

```
content/  →  content-lib/ (schemas + loader + search + i18n)  →  app/ (web) or mobile/app/
```

`content/` is the single source of truth (JSON, validated by
`content-lib/schemas/`). It currently holds:

- **107** Divya Desam records covering **108** temples (one record
  covers a combined two-shrine site)
- **4** Books, **162** chapters total: *A Brief Insight to
  Visishtadvaita Philosophy* (55 chapters), *Sri Rama Charithram* (7),
  *Srimad Bhagavata Kathasagaram* (31), *JAYA: A Journey of the
  Mahabharata* (69)
- **1** Knowledge record

Neither runtime reads `content/` directly — both go through
`content-lib/`, and never hardcode content. See `content-lib/README.md`
for the schema/loader contract.

## Getting started

**Website:**
```
npm install
npm run dev            # http://localhost:3000
npm run test:content    # content-lib + schema tests
npm run test:app        # app-layer tests
npm run typecheck
```

**Mobile (the real target — see `mobile/README.md` for full detail):**
```
cd mobile
npm install
npx expo start          # scan the QR code with Expo Go on your phone
node --test tests/*.test.ts
```

**After changing anything under `content/`:** the website picks it up
automatically (reads the directory live), but the mobile app does not —
its content is a build-time snapshot. Always run:
```
node mobile/scripts/generate-content-manifest.ts
```
after adding, editing, or removing content, or the change won't appear
in the mobile app.

## Directory map

| | |
|---|---|
| `app/`, `components/`, `lib/` | Website (Next.js) |
| `mobile/` | Mobile app (Expo) — see its own README |
| `content/` | The validated content itself (JSON) |
| `content-lib/` | Schemas, loader, search, i18n — shared by both runtimes |
| `content-extraction/` | Historical, read-only import pipeline used to bring source material into `content/` |
| `scripts/` | Import/build tooling that produces `content/` and its published artifacts |
| `source-material/` | Source PDFs/books and their import reports |
| `tests/` | `tests/content/` (content-lib), `tests/app/` (website), `tests/e2e/` (reserved, not yet built) |

## Sharing this repo with a collaborator

The repo is a single unit — there's no way to grant access to just
`mobile/` without splitting it into its own repo. Add collaborators via
GitHub Settings → Collaborators and teams → Add people, with **Write**
access for someone contributing code. For a quick UI/UX review session
with no code access needed, `npx expo start --tunnel` from `mobile/`
shares a live QR code they can open in Expo Go on their own phone.
