# Vedanta Yojana — Mobile

This is a React Native + Expo app for iOS, Android, and tablet. It
was originally the sole active-development target while the Next.js
website at the repository root stayed legacy/maintenance-only; the
website has since been brought to full feature parity (see the root
README's "The two runtimes" section), so both are now co-equal targets.
(Historical note: this README once described a Phase 6A foundation with
"no real screens." That is no longer true — see below.)

## What exists today

Real, working screens under `mobile/app/(tabs)/`:

- **Home** (`index.tsx`) — entry point, three navigation sections
- **Divya Desams** — index (`divya-desams/index.tsx`, all 107 records),
  detail (`divya-desams/[slug].tsx`), and an introduction screen
  (`divya-desams/introduction.tsx`, backed by the Knowledge record)
- **Library** — index (`library/index.tsx`, all books), a book screen
  (`library/[book].tsx`), and a chapter reader
  (`library/[book]/[chapter].tsx`)
- **Search** (`search.tsx`) — offline search corpus built from
  `content-lib/search/`
- **Settings** (`settings.tsx`) — theme, reading preferences, language

Supporting providers: `LanguageProvider.tsx`, `ThemeProvider.tsx`,
`ReadingPreferencesProvider.tsx`. Reusable components under
`mobile/components/`: `ContentCard`, `ContentImage`, `DraftBadge`,
`ImageViewerModal`, `OnboardingScreen`, `ResourceLink`, `Section`,
`SettingsControls`, `SthalaPuranamWithImages`, `WelcomeScreen`.

**Translations are live here, not on the website.** `content-lib/i18n.ts`'s
`localize*()` functions are called from the Divya Desam and Library
screens, driven by `LanguageProvider`/`language-context.ts` — the
website's `app/` never calls these functions at all.

`mobile/tests/*.test.ts` (44 tests as of this writing, run via
`node --test tests/*.test.ts`, no Jest): `loader.test.ts` (content
resolution against the real manifest), `screens.test.ts` (screen-level
data wiring), `ux.test.ts` (navigation/theme/regression checks), and
`offline.test.ts` (offline search corpus, preferences validation).

## Why Expo Router (not plain React Navigation)

Expo Router is used for the navigation foundation
(`mobile/app/_layout.tsx`). Two things drove the choice:

1. **It mirrors the mental model already established by the web
   reference app.** The Next.js app uses the App Router: an `app/`
   directory, file-based routes, a root layout. Expo Router uses the
   identical convention for React Native. Someone who already
   understands `vedanta-yojana/app/divya-desams/[slug]/page.tsx` already
   understands what `vedanta-yojana/mobile/app/(tabs)/divya-desams/[slug].tsx`
   looks like, with no new routing model to learn.
2. **It is not actually a competitor to React Navigation** — Expo
   Router is a file-based routing convention built on top of React
   Navigation internally (this project's `mobile/package.json` has
   `react-native-screens`/`react-native-safe-area-context` installed as
   Expo Router's own peer dependencies, for exactly that reason). Choosing
   Expo Router gets React Navigation's actual navigator/gesture/screen
   primitives "for free," authored with the file-based convention
   instead of hand-built navigator trees.

No other navigation library was evaluated as a real alternative given
those two points.

## Content access strategy

**The single source of truth remains `/content` at the repository
root.** Nothing under `/content` is copied, mirrored, or duplicated into
`mobile/`.

The problem this had to solve: the web app's loader
(`content-lib/loader/index.ts`) reads `/content` from disk at request
time via `node:fs`. Metro (React Native's bundler) has no equivalent —
it needs statically analyzable `import` statements at bundle time, and a
React Native app has no filesystem to lazily read from at runtime the
way a Node server does.

The bridge, in three pieces:

1. **`mobile/metro.config.js`** — adds `content/`, `content-lib/`,
   `public/images/`, and `public/audio/` (all at the repo root) to
   Metro's `watchFolders`, so Metro is even allowed to see files outside
   `mobile/`. It also extends `resolver.nodeModulesPaths` to include the
   repo root's `node_modules`, because `content-lib/schemas` imports
   `zod`, and `content-lib/` is a sibling of `mobile/`, not an ancestor —
   normal upward node_modules resolution from a file inside
   `content-lib/` never reaches `mobile/node_modules` on its own. (`zod`
   is also installed directly in `mobile/package.json`, so this isn't a
   hidden runtime-only dependency on the web app's tree — it's
   belt-and-braces, verified necessary by running an actual bundle
   export and reading the exact resolution error Metro produced.)

2. **`mobile/scripts/generate-content-manifest.ts`** — a small Node
   script that enumerates the real `/content` tree once and emits
   `mobile/content-lib/manifest.generated.ts`: nothing but `import`
   statements pointing directly at the real files, plus arrays that
   reference those imported bindings. **No content is copied into the
   generated file** — it is glue code, like a lockfile. It also emits
   `mobile/content-lib/image-manifest.generated.ts` for the 230 real
   image files under `public/images/`.

   **This generated file is a build-time snapshot, not a live read.**
   Adding, editing, or removing anything under `/content` has NO effect
   on the mobile app until this script is re-run:
   ```
   node mobile/scripts/generate-content-manifest.ts
   ```
   This is the single easiest step to forget after a content change —
   the symptom is new content appearing correctly on the website but not
   in the mobile app, with no error anywhere to point at why.

3. **`mobile/content-lib/loader.ts`** — the mobile-compatible content
   access layer, with the exact same public API as the web loader:
   `loadDivyaDesams`, `loadDivyaDesam`, `loadBooks`, `loadBook`,
   `loadChapters`, `loadChapter`, `loadKnowledge`, `loadKnowledgeRecord`.
   It validates every record through the **same Zod schemas** as the web
   app (`content-lib/schemas/index.ts`, imported directly — not
   reimplemented), and reuses the same error classes
   (`content-lib/loader/errors.ts`: `ContentValidationError`,
   `DuplicateSlugError`, `DuplicateChapterOrderError`). Not-found
   semantics match the web loader exactly (`null` for a single lookup,
   `[]` for an empty collection).

   **One deliberate, disclosed difference from the web loader:** this
   module caches its parsed/validated results after the first call. The
   web loader explicitly does not cache, because a dev server's
   `/content` can change underneath it between requests. The mobile
   manifest is compiled into the app binary at build time and cannot
   change at runtime, so re-validating 160+ records through Zod on every
   call would only cost battery for no benefit. This is a correct
   adaptation to a different runtime model, not a shortcut.

### A real, worth-knowing gotcha: JSON import attributes

Every generated import looks like:

```ts
import dd_sriRangam from "../../content/divya-desams/sri-rangam.json" with { type: "json" };
```

The `with { type: "json" }` is required by **Node's** native ESM loader
(used by `node --test` for `mobile/tests/`) — without it, Node fails
immediately with `ERR_IMPORT_ATTRIBUTE_MISSING`. Metro does not require
this attribute for its own JSON handling, but it parses and ignores it
without error, so the one generated line works correctly under both
runtimes. This was verified empirically (not assumed) by running both
`node --test mobile/tests/loader.test.ts` and `npx expo export` against
the exact same generated file.

### A real TypeScript performance gotcha

`mobile/tsconfig.json` explicitly sets `"resolveJsonModule": false`,
overriding `expo/tsconfig.base`'s default of `true`, with an ambient
`declare module "*.json"` fallback in `content-lib/json-module.d.ts`.
With `resolveJsonModule` on, `tsc` infers a full precise literal type
from every imported JSON file's actual content — for 160+ imports, some
containing long prose (chapter bodies, Sthala Puranam text), this made
`tsc --noEmit` take minutes. Turning it off and typing every JSON import
`unknown` (immediately validated by the real Zod schema right after
import in `loader.ts` anyway) fixed it: `tsc --noEmit` now runs in about
a second. This does **not** affect Metro/Babel's actual JSON bundling at
runtime — that is a completely separate mechanism from `tsc`'s static
type-checking.

## Asset (image) strategy

`mobile/content-lib/image-manifest.generated.ts` maps each record's
`sourceAssetUuid` to a `require(...)` of the real file under
`public/images/` (added to `metro.config.js`'s `watchFolders`), so
Metro's own asset pipeline handles hashing, cache-busting, and bundling —
no custom image route handler is needed the way the web app's (now
removed, Vercel-specific) `app/images/[uuid]/route.ts` needed one,
because a bundled RN app has no server to route a request to in the
first place. Regenerated by the same `generate-content-manifest.ts`
script as the content manifest.

For genuine offline-first behavior at scale (230 images) rather than
bundling everything into the app binary, `expo-file-system` +
on-first-use caching remains the natural next step if download size
becomes a problem — not yet needed.

## Development commands

```
cd mobile
npm install
npx expo start                          # Expo dev server (Metro) — scan the QR code with Expo Go
npx expo start --dev-client             # for a custom dev client build (eas build --profile development / expo run:ios), not Expo Go
npx expo start --android                # (requires Android tooling)
npx expo start --ios                    # (requires Xcode/iOS tooling)
npx expo start --tunnel                 # share a live QR code with a remote reviewer, no repo access needed
npm run start:tunnel                    # dev-client + tunnel — connect from a phone on cellular data / a different network
node --test tests/*.test.ts             # test suite (Node-native, no Jest) — 44 tests
./node_modules/.bin/tsc --noEmit        # TypeScript check
node scripts/generate-content-manifest.ts   # regenerate the content + image manifest after any /content or public/images change
```

### "Unable to connect to server" on a physical device (e.g. a custom dev client build on iPad)

This is the standard React Native/Expo message meaning the device found (or
tried to find) Metro but couldn't complete the connection. Check, in order:

1. **Local Network permission.** The first time the dev client tries to
   reach Metro, iOS/iPadOS shows *"[App] Would Like to Find and Connect to
   Devices on Your Local Network"* (this is what `NSLocalNetworkUsageDescription`
   and the `NSBonjourServices: ["_dev._tcp"]` entry in `app.json` exist
   for). If that prompt was denied or dismissed, every later launch fails
   silently with this exact message. Fix: **Settings → Privacy & Security →
   Local Network** on the device and enable it for the app; if the app
   isn't listed there at all, delete and reinstall the dev client so the
   prompt fires again.
2. **Start Metro in dev-client mode**, not plain Expo Go mode: `npx expo
   start --dev-client` (see above).
3. **Confirm it's actually the same LAN**, not just the same Wi-Fi name —
   client/AP isolation on mesh routers, guest networks, or band-steered
   Wi-Fi can block device-to-device traffic under one SSID. Get the dev
   machine's LAN IP (`ifconfig | grep inet` / `ipconfig`) and load
   `http://<that-ip>:8081/status` in Safari on the device; if that fails,
   it's a network problem, not an app problem.
4. **Dev-machine firewall** blocking inbound connections to Metro's port
   8081 (macOS prompts "Do you want the application node to accept
   incoming connections?" — must be allowed).
5. **Stale cached server URL** in the dev client from a previous
   session/IP — use the launcher's "Enter URL manually" with the current
   `<dev-machine-ip>:8081`.

If none of that resolves it, `npx expo start --dev-client --tunnel`
routes around local-network issues entirely by tunneling through ngrok.

### Developing over cellular data (not just Wi-Fi)

Metro's default LAN mode requires the phone and the dev machine to be on
the same local network — a phone on cellular data is on a different
network entirely and cannot reach the dev machine's local IP no matter
what. There's no app-side setting that changes this; the fix is to run
Metro in **tunnel mode**, which exposes it through a public ngrok tunnel
instead of the LAN, so any device with an internet connection (cellular
included) can reach it:

```
npm run start:tunnel        # equivalent to: npx expo start --dev-client --tunnel
```

`@expo/ngrok` is already a devDependency so this works without an
interactive "may we install a package?" prompt. Tunnel mode is slower
than LAN (traffic round-trips through ngrok's servers) and needs the dev
machine to stay online and reachable, but otherwise the app behaves the
same — the same custom dev client build works with either LAN or tunnel,
only the URL it connects to changes.

## Relationship to the web reference app

| | Web (repo root) | Mobile (`mobile/`) |
|---|---|---|
| Framework | Next.js (App Router) | Expo + Expo Router |
| Content access | `content-lib/loader` (Node `fs`, request-time) | `mobile/content-lib/loader.ts` (Metro-bundled, build-time, cached) |
| Schemas | `content-lib/schemas` | **the same files**, imported directly |
| Search | `content-lib/search` (browser-side prebuilt index) | **the same files**, imported directly, offline corpus |
| Translations (i18n) | not wired up (data exists, no UI calls it) | live — `content-lib/i18n.ts` used by Divya Desam/Library screens |
| SEO/sitemap/robots | yes | not applicable |
| Status | still maintained, but legacy/frozen for new features | the real target for new feature work |

Nothing in `content-lib/schemas/`, `content-lib/loader/`,
`scripts/migration/`, `content-extraction/`, or `/content` is modified to
support this app — everything reusable is imported directly, per the
content/code separation rule (see `content-lib/README.md`).

## Shipping

Not yet submitted to either app store. Needs an Apple developer account
($99/yr) and a Google Play developer account ($25 once) before an EAS
build can be submitted. Until then, distribution is via Expo Go
(`npx expo start`) or an EAS internal-distribution build shared directly
with testers/collaborators.
