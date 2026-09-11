# Vedanta Yojana

A collection of Divya Desam temple records, Vedantic philosophy texts,
and full-length books (Ramayana, Bhagavatam, Mahabharata), recovered from
a legacy app and rebuilt as clean, validated, versioned content — served
today through both a website and a native mobile app.

## The two runtimes

| | Website (repo root) | Mobile (`mobile/`) |
|---|---|---|
| Framework | Next.js (`output: "export"`, fully static) | Expo (React Native) |
| Status | **co-equal target — full feature parity** | **co-equal target — full feature parity** |
| Deploy | GitHub Pages, auto-deploys from `main` | not yet submitted to app stores |
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

- **107** Divya Desam temple records
- **4** Books, **162** chapters total: the original recovered book (55
  chapters), *Sri Rama Charithram* (7), *Srimad Bhagavata Kathasagaram*
  (31), *JAYA: A Journey of the Mahabharata* (69)
- **1** Knowledge record

Neither runtime reads `content/` directly — both go through
`content-lib/`, and never hardcode content. See `content-lib/README.md`
for the schema/loader contract, and `content-extraction/README.md` for
where the original 108-temple, 217-image dataset was recovered from.

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
| `content-extraction/` | Historical, read-only recovery pipeline from the original legacy export |
| `scripts/` | Migration/import tooling that built `content/` |
| `source-material/` | Source PDFs/books and their import reports |
| `tests/` | `tests/content/` (content-lib), `tests/app/` (website), `tests/e2e/` (reserved, not yet built) |

## Sharing this repo with a collaborator

The repo is a single unit — there's no way to grant access to just
`mobile/` without splitting it into its own repo. Add collaborators via
GitHub Settings → Collaborators and teams → Add people, with **Write**
access for someone contributing code. For a quick UI/UX review session
with no code access needed, `npx expo start --tunnel` from `mobile/`
shares a live QR code they can open in Expo Go on their own phone.
