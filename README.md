# Vedanta Yojana

An original collection of Divya Desam temple records, Vedantic
philosophy texts, and full-length books (Ramayana, Bhagavatam,
Mahabharata), maintained as clean, validated, versioned content —
served today through both a website and a native mobile app.

**Website:** https://vedantayojana.org
**Android:** see [Download](#download) below.

## Key features

- **108** Divya Desams, each in English, Tamil, Kannada, and Hindi
- **4** full-length books (227 chapters) plus a Knowledge section,
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
| Android | Distributed via Google Play — see [Download](#download) |
| iOS | Not currently distributed |

## Download

The official Android distribution channel is **Google Play**:

> **Google Play** — listing link will be added here once the app is
> published.

This source repository remains the project's technical provenance and
documentation home — source code, release notes, and the commit each
release was built from — but it is not itself an Android distribution
channel. See [APK Verification Guide](docs/APK-VERIFICATION.md) for
how to confirm an installed app is genuine, and why an APK obtained
from anywhere other than Google Play (a mirror, a forwarded file)
should not be trusted on filename or appearance alone.

*The app has not yet been published on Google Play. This section will
be updated with the actual Play Store listing link once it is.*

## Security & verification summary

- The Android release is signed using this project's production
  signing credentials, managed remotely by EAS (Expo Application
  Services) — not a local development key.
- Google Play's own install-time signature verification, plus the
  published signing-certificate fingerprint, let a release be
  independently confirmed.
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
  in the audited source uploads user data anywhere. See Google Play's
  Data Safety section on the app's listing for the platform-verified
  summary of this once published.
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
| Deploy | GitHub Pages, auto-deploys from `main` | Google Play (see [Download](#download)); not yet published |
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

- **108** Divya Desams
- **4** Books, **227** chapters total: *A Brief Insight to
  Visishtadvaita Philosophy* (51 chapters), *Sri Rama Charithram* (75),
  *Srimad Bhagavata Kathasagaram* (31), *JAYA: A Journey of the
  Mahabharata* (70)
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
