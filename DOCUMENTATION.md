# Vedanta Yojana — Engineering Documentation

## Scope and evidentiary standard

This document is a technical and historical record of the Vedanta Yojana
project: what it is, how it is built, how it evolved, and how it can be
reproduced and maintained. It is written for engineers — developers,
technical reviewers, and future maintainers who have no prior exposure to
this repository or to the development sessions that produced it.

Every factual claim below falls into one of four evidentiary categories,
labeled explicitly wherever the distinction matters:

- **CONFIRMED** — directly verified against a file, commit, or command
  output in this repository at the time of writing, with a citation
  (path, commit hash, or command).
- **PROBABLE** — strongly implied by repository evidence but not directly
  observed (e.g., inferred from a config change without a corroborating
  test log).
- **INVESTIGATED / RULED OUT** — a factor that project history shows was
  examined during troubleshooting and determined not to be the root
  cause.
- **REPORTED BY PROJECT OWNER, NOT INDEPENDENTLY VERIFIABLE** — asserted
  by the person who did the work firsthand, describing events from a
  development session with no artifact trail in the repository (transient
  terminal output, local machine state, physical-device tests). These are
  included because they are part of the project's real history and the
  project owner is a direct witness to them, but they carry a different
  evidentiary weight than a citable file or commit, and are marked as
  such rather than silently presented as independently confirmed.

Where a specific claim could not be placed in any of these categories
with confidence, this document says so explicitly rather than filling
the gap with plausible-sounding detail.

---

## 1. Development model

**Vedanta Yojana was designed and built by a first-time application
developer, working with an AI system (Claude, via Claude Code) as the
primary development and engineering assistant.** This is stated
explicitly and is not a detail to be softened into generic language like
"AI-assisted development." It is a defining characteristic of how this
codebase came to exist, and it shapes how the rest of this document
should be read — as a record of an iterative human-AI development
process, not as the output of an experienced solo engineer or a
traditional team.

### Division of responsibility

| | Owned by the developer | Owned by the AI |
|---|---|---|
| Project vision and purpose | ✓ | |
| Requirements and priorities | ✓ | |
| Content decisions (what books, what translations, what quality bar) | ✓ | |
| Translation standards and approval | ✓ | |
| Architectural direction (what to build next) | ✓ | |
| Final acceptance of any change | ✓ | |
| Testing decisions (what to verify, when to accept a build) | ✓ | |
| Software architecture exploration and proposals | | ✓ |
| Code generation and modification | | ✓ |
| Debugging, root-cause investigation, dependency analysis | | ✓ |
| Build-failure interpretation | | ✓ |
| Translation drafting and mechanical QC | | ✓ |
| Documentation generation | | ✓ |
| Command-line operation (git, npm, gradle, adb, gh) | | ✓ |

The AI was not an autonomous engineer operating without oversight. Every
commit in this repository's history represents a change the developer
requested, reviewed at some level, and accepted into the project — the
AI proposed, implemented, and validated; the developer directed and
approved. The workflow that produced this repository is described in
detail in Section 6.

---

## 2. What the application is

Vedanta Yojana is a content application presenting Hindu devotional and
philosophical material — Divya Desam temple records, translated
scripture and philosophy books, and a general knowledge/introduction
record — across two runtimes:

- A **Next.js website**, the original and now legacy/maintenance-only
  runtime, deployed to Vercel from the repository root.
- An **Expo (React Native) mobile app** for iOS and Android, under
  `mobile/`, which per the project's own documentation is "the real,
  active target" for new feature work (`mobile/README.md`).

Both runtimes read from a single shared content layer rather than
maintaining independent copies of any editorial material.

### Why the project exists — CONFIRMED

The content did not originate as new authorship. It was recovered from a
legacy SAP Build Apps (a no-code platform) export that exists at the
repository root (`_next/`, `page.Page*.html`, `nodered.min.js`, and
related files) — a working but unmaintainable application whose actual
content (108 Divya Desam temple pages, 56 philosophy/scripture article
pages, 217 images, and 552 external resource links) was compiled and
buried inside a single 14.4MB minified JavaScript bundle
(`_next/static/chunks/pages/_app-72a25e792e2e05f2.js`), per
`content-extraction/README.md`. That content had no independently
readable, versionable, or maintainable form outside the legacy runtime.

The project's founding technical objective — confirmed by the existence
and design of `content-extraction/` — was to recover that content into
clean, structured, schema-validated JSON that could survive independently
of the SAP Build Apps runtime, and then build a real, maintainable
application on top of it. `content-extraction/` is explicitly a
**read-only migration artifact**: every script in it only reads the
legacy export; nothing in the current application touches the legacy
export directly.

The specific motivation for *why this particular content* — Divya Desam
temple records, Vedantic philosophy, and itihasa/purana translations —
was chosen for revival is **REPORTED BY PROJECT OWNER, NOT INDEPENDENTLY
VERIFIABLE**: it reflects the project owner's own devotional and cultural
interest, not a fact reconstructible from repository artifacts alone.

---

## 3. Technology stack — CONFIRMED

All versions below were read directly from the installed dependency
manifests (`package.json`, `mobile/package.json`, `mobile/package-lock.json`,
`mobile/android/gradle/wrapper/gradle-wrapper.properties`) and, where
noted, cross-checked against the actual installed package in
`node_modules`.

### Website (repository root)

| Component | Version | Notes |
|---|---|---|
| Next.js | 16.3.0 | App Router |
| React / React DOM | 19.2.8 | |
| TypeScript | 7.0.2 | |
| Zod | ^4.4.3 | Content schema validation |
| Node.js | 24 (`.nvmrc`) | Active shell verified at `v24.3.0` |

### Mobile (`mobile/`)

| Component | Version | Notes |
|---|---|---|
| Expo SDK | ~53.0.27 | |
| Expo Router | ~5.1.11 | File-based navigation, see §5.3 |
| React Native | 0.79.6 | |
| React | 19.0.0 | |
| Hermes | enabled (`hermesEnabled=true`, `mobile/android/gradle.properties`) | JS engine |
| New Architecture | enabled (`newArchEnabled=true`) | TurboModules/Fabric |
| Zod | ^4.4.3 | Same schema package as the website, imported directly |
| TypeScript | ~5.8.3 | |
| patch-package | ^8.0.1 | See §7.3 |
| Gradle (wrapper) | 8.13 (`gradle-wrapper.properties`) | |
| glob (resolved, used by expo-modules-autolinking) | 10.5.0 (`mobile/node_modules/glob/package.json`) | See §7.3 |
| expo-modules-autolinking | 2.1.15 | Patched, see §7.3 |

### Android native build environment — CONFIRMED

| Component | Value | Source |
|---|---|---|
| Gradle | 8.13 | `mobile/android/gradle/wrapper/gradle-wrapper.properties` |
| JDK pinned for the Gradle daemon | OpenJDK 17 (Homebrew, `/opt/homebrew/opt/openjdk@17`) | `mobile/android/gradle.properties`, `org.gradle.java.home` |
| Native project generation | Expo prebuild (`expo-root-project` Gradle plugin; `mobile/android/build.gradle` contains no hand-authored `compileSdkVersion`/`buildToolsVersion` values — they are supplied by the Expo plugin) | `mobile/android/build.gradle` |
| React Native architectures targeted | `armeabi-v7a, arm64-v8a, x86, x86_64` | `mobile/android/gradle.properties` |

The choice of each of these technologies, and why alternatives were or
were not considered, is discussed in Section 8.

---

## 4. Repository architecture — CONFIRMED

```
vedanta-yojana/
├── app/, components/, lib/         Website (Next.js, App Router) — legacy/maintenance
├── mobile/                          Mobile app (Expo/React Native) — the active target
│   ├── app/                         Expo Router routes (file-based)
│   ├── components/                  Mobile-specific UI components
│   ├── content-lib/                 Mobile content bridge (generated manifest + loader)
│   ├── android/                     Expo-prebuilt native Android project
│   ├── patches/                     patch-package patches applied on every npm install
│   ├── scripts/                     generate-content-manifest.ts and similar tooling
│   └── tests/                       Node-native test suite (no Jest)
├── content/                         The validated content layer (JSON) — single source of truth
│   ├── divya-desams/                107 Divya Desam temple records
│   ├── library/                     4 books, organized as book.json + chapters/*.json
│   ├── knowledge/                   1 standalone knowledge/introduction record
│   ├── _provenance/                 Migration provenance metadata (source page mapping)
│   └── _unresolved/                 Content that could not be confidently migrated
├── content-lib/                     Shared schemas, loader, search, and i18n — used by both runtimes
│   ├── schemas/                     Zod schemas (single source of truth for validation + types)
│   ├── loader/                      Reads /content, validates every file, returns typed objects
│   ├── search/                      Framework-agnostic search (no node:fs — runs on mobile too)
│   └── i18n.ts                      localize*() — applies translations[language] over the English base
├── content-extraction/              Read-only recovery pipeline from the legacy SAP Build export
├── scripts/                         Migration/import tooling that built /content
├── source-material/                 Source PDFs/books and their import reports
├── tests/                           Website test suite (content-lib + app layer)
└── DOCUMENTATION.md                 This file
```

The content/code separation rule stated in `content-lib/README.md` is
architecturally load-bearing, not a style preference: `app/` and
`components/` (website) and `mobile/app/` (mobile) are only ever supposed
to receive typed, validated content objects produced by `content-lib/` —
never to read `/content` directly, and never to contain hardcoded
recovered content.

---

## 5. System architecture

### 5.1 Content pipeline (both runtimes)

```
content/  (JSON, Git-tracked, hand/AI-edited)
    ↓  read + validated by
content-lib/  (Zod schemas + loader — shared, unmodified between runtimes)
    ↓  consumed by
app/  (website)          or          mobile/app/  (Expo Router)
    ↓                                     ↓
Next.js build / Vercel              Metro bundle / Gradle / APK
    ↓                                     ↓
Browser                              Android/iOS device
```

Neither runtime is permitted to read `/content` directly; both go
through `content-lib/`. This is enforced structurally on the website by
Next.js's bundler, which refuses to bundle `node:fs` into a Client
Component — an accidental client-side import of the loader fails the
build on its own, without a separate lint rule (`content-lib/README.md`).

### 5.2 Website runtime — CONFIRMED (`content-lib/README.md`, `content-lib/loader/index.ts`)

The website's loader (`content-lib/loader/index.ts`) reads `/content`
from disk with `node:fs` **at request time**, synchronously. There is no
caching layer beyond what synchronous reads of small JSON files naturally
imply — content volume has not yet justified one. This means a content
edit is visible on the website immediately, without a rebuild.

Public API (identical function signatures used by both runtimes):

```ts
loadDivyaDesams(): DivyaDesam[]        loadDivyaDesam(slug): DivyaDesam | null
loadBooks(): Book[]                     loadBook(slug): Book | null
loadChapters(bookSlug): Chapter[]       loadChapter(bookSlug, slug): Chapter | null
loadKnowledge(): Knowledge[]            loadKnowledgeRecord(slug): Knowledge | null
```

Not-found convention: every single-record lookup returns `null` (never
`undefined`, never throws); every collection lookup returns `[]` for an
empty or nonexistent directory. Thrown errors are reserved for genuine
content defects — malformed JSON, a schema failure, a duplicate slug, or
a duplicate chapter `order` within one book — and always identify the
offending file path (`content-lib/loader/errors.ts`).

Slug-based lookups never build a filesystem path from caller-supplied
input; a requested slug is matched in memory against each record's own
already-validated `slug` field, and a malformed/malicious slug (e.g.
`"../../etc/passwd"`) is rejected by a format check before any filesystem
access occurs.

### 5.3 Mobile runtime — CONFIRMED (`mobile/README.md`, `mobile/metro.config.js`)

The mobile app cannot use the website's approach, because Metro (React
Native's bundler) has no runtime filesystem to lazily read `/content`
from the way a Node server does — it needs statically analyzable `import`
statements resolved at **bundle time**. The mobile content bridge is
three pieces, all confirmed present in the repository:

1. **`mobile/metro.config.js`** extends Metro's `watchFolders` to include
   `content/`, `content-lib/`, `public/images/`, and `public/audio/` at
   the repository root — by default Metro only sees files under
   `mobile/`, so without this, any import reaching above `mobile/` fails
   to resolve. It also extends `resolver.nodeModulesPaths` to include the
   repo root's `node_modules`, because `content-lib/schemas` imports
   `zod`, and `content-lib/` is a sibling of `mobile/` rather than an
   ancestor — ordinary upward `node_modules` resolution from a file
   inside `content-lib/` never reaches `mobile/node_modules`. The file's
   own comments record that this was **verified empirically**: without
   the added resolver path, `npx expo export` fails with `Unable to
   resolve module zod from .../content-lib/schemas/shared.ts`, reporting
   that it checked only `content-lib`'s own immediate `node_modules`, not
   the repository root's. `zod` is also installed directly in
   `mobile/package.json` as a belt-and-braces measure, not as a hidden
   dependency on the website's tree.

2. **`mobile/scripts/generate-content-manifest.ts`** enumerates the real
   `/content` tree once and emits `mobile/content-lib/manifest.generated.ts`
   — a file containing only `import` statements pointing at the real
   content files, plus arrays referencing those imports. **No content is
   copied**; the generated file is glue code, comparable to a lockfile.
   It also emits `mobile/content-lib/image-manifest.generated.ts`,
   mapping each record's `sourceAssetUuid` to a `require(...)` of the
   real image file under `public/images/`, so Metro's own asset pipeline
   (hashing, cache-busting, bundling) handles images without a custom
   route handler.

   This generated manifest is a **build-time snapshot, not a live read**.
   Editing, adding, or removing anything under `/content` has no effect
   on the mobile app until the script is re-run — the failure mode when
   this step is forgotten is silent: new content appears correctly on
   the website but not in the mobile app, with no error to point at why.
   This was hit in practice and fixed in commit `9634f56`
   ("Regenerate mobile content manifest for the 3 new Library books") —
   the manifest had not picked up three newly added books because it is
   a static snapshot, not a live filesystem read.

3. **`mobile/content-lib/loader.ts`** is the mobile-compatible content
   access layer, exposing the identical public API as the website loader
   and validating every record through the **same Zod schemas**
   (imported directly from `content-lib/schemas/index.ts`, not
   reimplemented) and the same error classes. The one deliberate,
   disclosed difference: this loader **caches** its parsed/validated
   results after the first call, because the mobile manifest is compiled
   into the app binary at build time and cannot change at runtime — the
   website loader explicitly does not cache, because its `/content` can
   change underneath it between requests on a dev server. This is
   documented in `mobile/README.md` as a deliberate adaptation, not an
   oversight.

Two additional build-specific gotchas are documented in
`mobile/README.md` and are reproduced here because they materially
affect anyone touching the content bridge:

- **JSON import attributes**: every generated import uses
  `with { type: "json" }` (e.g. `import dd_sriRangam from
  "../../content/divya-desams/sri-rangam.json" with { type: "json" }`).
  Node's native ESM loader (used by `node --test` for `mobile/tests/`)
  requires this attribute and fails immediately with
  `ERR_IMPORT_ATTRIBUTE_MISSING` without it. Metro does not require the
  attribute for its own JSON handling but parses and ignores it without
  error — so one generated line works correctly under both runtimes.
  Verified by running both `node --test mobile/tests/loader.test.ts` and
  `npx expo export` against the same generated file.
- **`tsconfig.json` performance**: `mobile/tsconfig.json` explicitly sets
  `"resolveJsonModule": false`, overriding `expo/tsconfig.base`'s default
  of `true`. With it on, `tsc` infers a full precise literal type from
  every imported JSON file's actual content; across 160+ content imports,
  some containing long prose bodies, this made `tsc --noEmit` take
  minutes. Every JSON import is instead typed `unknown` and immediately
  validated by the real Zod schema in `loader.ts`. This reduced
  `tsc --noEmit` to about a second and has no effect on Metro/Babel's
  actual JSON bundling at runtime, which is a separate mechanism from
  `tsc`'s static type-checking.

### 5.4 Why Expo Router, not plain React Navigation — CONFIRMED (`mobile/README.md`)

Two reasons are recorded as having actually driven the decision:

1. It mirrors the routing model already established by the Next.js
   reference app — an `app/` directory, file-based routes, a root
   layout — so a developer who understands the website's
   `app/divya-desams/[slug]/page.tsx` already understands what
   `mobile/app/(tabs)/divya-desams/[slug].tsx` looks like, without
   learning a second routing model.
2. Expo Router is not a competitor to React Navigation; it is a
   file-based routing convention built on top of it (`mobile/package.json`
   installs `react-native-screens`/`react-native-safe-area-context` as
   Expo Router's own peer dependencies). Choosing Expo Router gets React
   Navigation's navigator/gesture/screen primitives "for free," authored
   via the file-based convention.

No other navigation library is recorded as having been evaluated as a
real alternative.

### 5.5 Mobile route map — CONFIRMED (directory listing)

```
mobile/app/_layout.tsx                                  root layout
mobile/app/(tabs)/_layout.tsx                            tab navigator
mobile/app/(tabs)/index.tsx                               Home
mobile/app/(tabs)/divya-desams/_layout.tsx
mobile/app/(tabs)/divya-desams/index.tsx                  Divya Desams — index (107 records)
mobile/app/(tabs)/divya-desams/[slug].tsx                 Divya Desams — detail
mobile/app/(tabs)/divya-desams/introduction.tsx            Divya Desams — introduction (Knowledge record)
mobile/app/(tabs)/library/_layout.tsx
mobile/app/(tabs)/library/index.tsx                        Library — index (all books)
mobile/app/(tabs)/library/[book].tsx                        Library — book screen
mobile/app/(tabs)/library/[book]/[chapter].tsx                Library — chapter reader
mobile/app/(tabs)/search.tsx                                Offline search (content-lib/search/)
mobile/app/(tabs)/settings.tsx                              Theme, reading preferences, language
```

Supporting providers (`mobile/`): `LanguageProvider.tsx`,
`ThemeProvider.tsx`, `ReadingPreferencesProvider.tsx`. Shared components:
`ContentCard`, `ContentImage`, `DraftBadge`, `ImageViewerModal`,
`OnboardingScreen`, `ResourceLink`, `Section`, `SettingsControls`,
`SthalaPuranamWithImages`, `WelcomeScreen`.

**Translations are live only on mobile, not on the website.**
`content-lib/i18n.ts`'s `localize*()` functions, which overlay a record's
`translations[language]` field-by-field onto its English base, are
called from the mobile Divya Desam and Library screens via
`LanguageProvider`. The website's `app/` never calls these functions —
the i18n data exists in `/content` for both runtimes, but only the
mobile UI currently surfaces it.

### 5.6 Content data model — CONFIRMED (direct inspection of representative records)

Two record shapes coexist in `/content`, validated by separate Zod
schemas (`content-lib/schemas/book.ts`, `chapter.ts`, `divya-desam.ts`,
`knowledge.ts`, all built on shared primitives in `shared.ts`):

**Book/Chapter** (`content/library/<book-directory>/book.json` +
`chapters/*.json`):

```json
{
  "title": "string",
  "slug": "string",
  "order": "number",
  "status": "draft | published",
  "migration": {
    "sourcePageId": "string",
    "extractionConfidence": "high | medium | low",
    "needsReview": "boolean"
  },
  "body": "string (source-language prose)",
  "images": ["..."],
  "translations": {
    "ta": { "title": "string", "body": "string" },
    "kn": { "title": "string", "body": "string" },
    "hi": { "title": "string", "body": "string" }
  }
}
```

A book's identity for every lookup is its **validated `slug` field**
inside `book.json`, never the directory name — the loader never infers
or rewrites a slug from a directory, which is what allows two book
directories with a colliding slug to be correctly detected and rejected
as a duplicate-slug error rather than silently prevented from coexisting
in the first place (`content-lib/README.md`). Chapters are ordered by
their own `order` field, never by filename; duplicate `order` values
within one book throw rather than silently picking a winner.

**Divya Desam** (`content/divya-desams/<slug>.json`), a richer shape:
`slug`, `displayName`, `status`, `migration`, `templeInformation`,
`sthalaPuranam`, `azhwarPasuram`, `shrines`, `images`, `resources`,
`relatedContent`, `translations` (fields confirmed by direct inspection
of `content/divya-desams/sri-rangam.json` and `tirupperai.json`).

Schema-level guarantees enforced by `content-lib/schemas/` and stated
explicitly in `content-lib/README.md`: `status` defaults to `"draft"`
everywhere (no schema defaults to `"published"`); extraction confidence
never influences `status`; every optional field really is optional
(tolerating legitimate source gaps such as a Divya Desam with no
`sthalaPuranam`); image `alt` text is never fabricated
(`alt: string | null`, `altStatus` defaults to `"needs-review"`); and the
same image asset may legitimately appear on more than one record.

### 5.7 Current content inventory — CONFIRMED (direct count, 2026-08-21)

| Collection | Count | Location |
|---|---|---|
| Divya Desam records | 107 | `content/divya-desams/` |
| JAYA: A Journey of the Mahabharata | 69 chapters | `content/library/jaya/` |
| Sri Rama Charithram | 7 chapters | `content/library/sri-rama-charithram/` |
| Srimad Bhagavata Kathasagaram | 31 chapters | `content/library/srimad-bhagavata-kathasagaram/` |
| A Brief Insight to Visishtadvaita Philosophy | 51 chapters | `content/library/untitled-recovered-book-pending-editorial-title/` |
| Knowledge records | 1 | `content/knowledge/` |
| **Total** | **266 content records** | |

The Visishtadvaita book originally migrated with 55 chapters; 4 were
later identified as misplaced and removed (commit `0ada4a7`, "Remove 4
misplaced chapters from A Brief Insight to Visishtadvaita Philosophy,
finalize status to published"), leaving the current 51. Some existing
project documentation (`content-lib/README.md`, `content/README.md`)
still states the pre-existing figures of 55 chapters and 162 total
chapters — those files were not updated at the time this document was
written and should not be treated as current; the counts above are a
direct, current recount.

---

## 6. The AI-assisted development workflow

The commit history and commit messages in this repository are consistent
with an iterative loop, not one-shot code generation:

```
Developer states a requirement or reports a problem
        ↓
AI investigates the relevant code/config/build output
        ↓
AI proposes an approach (occasionally more than one, for the developer to choose)
        ↓
Developer approves / redirects
        ↓
AI implements the change
        ↓
Build and/or test run (npm test, tsc, gradlew, expo export, etc.)
        ↓
   ┌─── failure ───┐
   ↓               ↓
AI diagnoses    success
error output        ↓
   ↓            Developer reviews the actual change
AI revises          ↓
   ↓            Git commit (with a message documenting what and why)
   └──────┐         ↓
          └──→  Push to the shared remote
```

This pattern is directly visible in commit messages that describe not
just a change but the investigation behind it — for example, commit
`d741ac3` ("Library audit: flag 3 chapters whose source is genuinely
incomplete") describes re-verifying 55 chapter bodies byte-for-byte
against their extraction source, re-running a 17-chapter PDF
correspondence check, and explicitly recording one finding it
investigated and *chose to leave unchanged* (a pixel-identical image
shared correctly by two unrelated chapters) rather than "fixing" it
against a false assumption. Commit `5033638` (the autolinking fix,
detailed in §7.3)
similarly documents a specific chain of ruled-out hypotheses before
reaching a confirmed root cause, rather than presenting the fix as
self-evident.

The translation work documented in Section 9
follows the same loop at a per-chapter granularity: translate → run a
mechanical validation script (paragraph-count parity, a regex check for
a known gloss-duplication bug) → report status → commit in small batches
→ push → periodically run a broader consistency pass across completed
work.

What this workflow is **not**: the AI did not operate unsupervised
against a backlog, did not choose what to build next on its own
initiative, and did not merge or publish its own work without the
developer's session being the one to invoke each action. Every git push
in this project's history occurred as part of a session directed by the
project owner.

---

## 7. Android build pipeline and troubleshooting history

This section documents the Android native build chain and the specific
problems encountered getting a working debug and release build. Each
subsection states its evidentiary category up front.

### 7.1 Build pipeline overview — CONFIRMED

```
TypeScript/TSX source (mobile/app/, mobile/components/)
        ↓  Metro (dev server, or `expo export`/`export:embed` for a release bundle)
JavaScript bundle (Hermes bytecode at runtime)
        ↓
React Native / Expo native modules, autolinked into the Android project
        ↓  Gradle (8.13, JDK 17 pinned)
        ↓  ./gradlew assembleDebug   or   ./gradlew assembleRelease
APK (mobile/android/app/build/outputs/apk/debug/ or .../release/)
        ↓  adb install, or sideload
Android device
```

The native Android project under `mobile/android/` is Expo-generated
(`expo prebuild`), not hand-authored, and is not committed to the
repository (`mobile/.gitignore`); the `mobile/android/...` paths in this
document refer to that locally generated project: `mobile/android/build.gradle`
applies the `expo-root-project` plugin and contains no explicit
`compileSdkVersion`/`buildToolsVersion` — those are supplied by the
plugin rather than pinned in this repository.

### 7.2 JDK / Gradle compatibility — CONFIRMED

**Problem.** Gradle 8.13 (this project's wrapper version) does not
support arbitrarily new JDKs. The failure mode for an unsupported JDK is
a class-file version mismatch.

**Root cause, as recorded directly in `mobile/android/gradle.properties`:**

> "Pin the JDK Gradle 8.13 actually supports. Without this, Gradle
> resolves whatever `java` is first on PATH/`java_home`, which on this
> machine is Homebrew's `openjdk@24` (unsupported by Gradle 8.13,
> `Unsupported class file major version 68`) rather than `openjdk@17`."

**Fix, CONFIRMED in the same file:**

```properties
org.gradle.java.home=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
```

This pins the Gradle daemon's JVM explicitly, independent of whatever
`java` resolves to on the developer machine's `PATH`/`JAVA_HOME`. This is
a project-level, repository-committed fix — any machine that clones this
repository and has `openjdk@17` installed at that Homebrew path will
build correctly regardless of what other JDKs are also installed.

### 7.3 The `expo-modules-autolinking` hang — CONFIRMED

This is the most significant build-pipeline defect encountered and fixed
in this project's history, and it is documented here in full technical
detail because the fix is non-obvious and could otherwise be reverted by
a future dependency upgrade without anyone understanding why it exists.

**Symptom.** Android builds (`./gradlew assembleDebug` and the autolinking
commands Gradle depends on, `react-native-config` and `resolve`) hung
indefinitely — no forward progress, no error, no timeout.

**Root cause, as recorded in commit `5033638`'s message:**

`expo-modules-autolinking@2.1.15`'s `fileUtils.js` used the streaming
form of the `glob` package (`glob.stream()`) consumed with a
`for await (...)` loop to scan each dependency's `android/` directory
for autolinking purposes. Under this project's specific dependency tree
(`glob` resolved to version **10.5.0** — confirmed directly at
`mobile/node_modules/glob/package.json`), this consistently hung with
near-zero CPU usage and no output.

**Investigation, per the fix commit's own description (INVESTIGATED /
RULED OUT):** the commit message states the hang was confirmed via a
Node diagnostic report to be an unresolved Promise with no pending libuv
handles, and that the hang occurred *"regardless of Node version, Gradle
presence, disk space, or `UV_THREADPOOL_SIZE`."* This means each of those
four factors was specifically tested as a candidate explanation and
ruled out — the hang was not caused by an old/new Node runtime, was not
specific to a particular Gradle invocation, was not caused by low disk
space, and was not fixed by increasing libuv's thread-pool size (a
plausible hypothesis for a stalled async filesystem operation, tested
and eliminated).

Two further specifics reported by the project owner from this
investigation session are **REPORTED BY PROJECT OWNER, NOT INDEPENDENTLY
VERIFIABLE** from repository artifacts alone (they describe transient
local-machine state and terminal output that leaves no file trace): that
disk utilization on the development machine was at approximately 98% of
an APFS volume with roughly 9.6 GB free at the time, that a subsequent
cleanup recovered approximately 39.4 GB (leaving roughly 49 GB free),
and that macOS Spotlight indexing (`mdworker` activity) was independently
investigated as a possible contributor to system-level slowness during
the same troubleshooting window. Both are consistent with — but not
proof of — the commit message's own statement that disk space was
investigated and ruled out as the hang's cause: the hang persisted
regardless of available disk space, which is exactly what a large
cleanup that did *not* fix the problem would demonstrate. Neither disk
space nor Spotlight is the confirmed root cause; the confirmed root
cause is the `glob.stream()`/`for await` code path itself.

**Fix, CONFIRMED via `git show 5033638`:** `mobile/patches/expo-modules-autolinking+2.1.15.patch`,
applied automatically after every `npm install` via `patch-package`
(`"postinstall": "patch-package"` in `mobile/package.json`), rewrites two
functions in `node_modules/expo-modules-autolinking/build/fileUtils.js`
to use the array-returning `glob()` API instead of `glob.stream()`:

```diff
-    const globStream = glob_1.glob.stream(globPattern, { ...options, withFileTypes: false });
+    const files = await (0, glob_1.glob)(globPattern, { ...options, withFileTypes: false });
     const cwd = options?.cwd !== undefined ? `${options.cwd}` : process.cwd();
     const results = [];
-    for await (const file of globStream) {
+    for (const file of files) {
```

(applied to both `globMatchFunctorAllAsync` and
`globMatchFunctorFirstAsync` in that file). This preserves identical
matching semantics — the same glob pattern, the same result set — while
removing the stream/async-iterator lifecycle that was hanging.

**Why `patch-package` rather than any of the alternatives:**

| Alternative | Why not used |
|---|---|
| Downgrade/upgrade `expo-modules-autolinking` | Not recorded as tried; the defect is in a specific code path unrelated to the package's version-appropriateness for the Expo SDK in use — changing the version was not needed once the actual code path causing the hang was identified. |
| Fork and depend on a patched package | Adds a permanent external maintenance burden (a separate package to publish and keep in sync) for a two-function change. |
| Manually edit `node_modules` after each install | Not durable — `node_modules` is not committed, and any fresh `npm install` (a new clone, CI, a teammate's machine) would silently lose the fix and reintroduce the hang with no error message pointing at why. |
| `patch-package` (selected) | The patch file itself is committed (`mobile/patches/`), applied automatically via the `postinstall` script on every `npm install`, and fails loudly if the patched package's source no longer matches what the patch expects (protecting against a silent, stale patch after a future dependency upgrade). |

**Validation, CONFIRMED in the commit message:** both real autolinking
commands (`react-native-config`, `resolve`) were verified to complete in
approximately 3 seconds after the patch (previously never completing),
and `./gradlew assembleDebug` was verified to succeed end to end.

### 7.4 Metro / release bundle resolution — CONFIRMED

A second, distinct build-pipeline defect involved Metro's module
resolution for the content bridge described in
§5.3. As recorded directly in
`mobile/metro.config.js`'s comments, running `npx expo export` (the
release-bundle export path) without the `resolver.nodeModulesPaths`
extension failed with:

```
Unable to resolve module zod from .../content-lib/schemas/shared.ts
```

because Metro's default upward `node_modules` resolution from a file
inside `content-lib/` (a sibling of `mobile/`, not an ancestor) never
reaches `mobile/node_modules`. The fix — extending
`config.resolver.nodeModulesPaths` to explicitly include the repository
root's `node_modules` alongside `mobile/`'s own — is confirmed present
in the shipped `metro.config.js` and is stated in its comments to have
been verified empirically by re-running `expo export` against the fix,
not merely assumed to work.

The broader `watchFolders` extension (content, content-lib, images,
audio — see §5.3) is the same category of
fix: Metro only bundles/watches files under its configured
`watchFolders`, and without this configuration, any release bundle
attempting to import content from outside `mobile/` would fail to
resolve, not merely a dev-server import.

### 7.5 Debug and release APKs — CONFIRMED (build outputs) / REPORTED (device testing)

Both build variants exist in the working tree (not committed — excluded
by `mobile/.gitignore`'s `/android` rule, which excludes the entire
Expo-generated native project directory from version control, consistent
with treating it as a regenerable build artifact rather than source):

| Variant | Path | Size |
|---|---|---|
| Debug | `mobile/android/app/build/outputs/apk/debug/app-debug.apk` | 145 MB |
| Release | `mobile/android/app/build/outputs/apk/release/app-release.apk` | 116 MB (122,059,005 bytes) |

Both were successfully built end to end, which by itself CONFIRMS the
JDK/Gradle fix (§7.2), the
autolinking fix (§7.3),
and the Metro resolution fix (§7.4)
all hold in combination — a release build specifically requires the
`export:embed`/bundle step that the Metro fix addresses, in addition to
the Gradle/autolinking chain the debug build alone would exercise.

Installation and interactive testing on a physical Android device
(reported as a Samsung Galaxy S10, via `adb install`) is **REPORTED BY
PROJECT OWNER, NOT INDEPENDENTLY VERIFIABLE** — there is no artifact in
the repository (a test log, a screenshot, a recorded `adb logcat`
session) that independently confirms which physical device was used or
what was observed on it. The existence of a successfully built,
non-trivially-sized release APK is consistent with, but does not by
itself prove, a successful on-device launch.

### 7.6 Distribution

Neither an Apple developer account nor a Google Play developer account
has been set up (`mobile/README.md`, "Shipping" section) — the app is
not yet submitted to either app store, and no `eas.json` exists in the
repository, meaning no EAS (Expo Application Services) build
configuration has been created either. Current distribution of the
release build is via a GitHub Release
(`https://github.com/slnwriteups/vedanta-yojana/releases/tag/mobile-v1.0.0`),
carrying `app-release.apk` as a downloadable binary asset — chosen over
committing the APK to the repository because both build variants exceed
GitHub's 100 MB per-file limit for a normal git blob, and because build
artifacts are not meant to live in version-controlled history in the
first place.

**Update (2026-09-24):** distribution has since settled on GitHub only.
The app is not going on Google Play or any other app store. Official
APKs are published on
[`vedanta-yojana-releases`](https://github.com/slnwriteups/vedanta-yojana-releases/releases)
(current: v16, 1.0.3), and content and JavaScript fixes reach installed
apps through EAS over-the-air updates. See
[docs/APK-VERIFICATION.md](docs/APK-VERIFICATION.md).

---

## 8. Engineering decisions

| Decision | Rationale | Alternatives considered | Status |
|---|---|---|---|
| Expo (React Native) for the mobile app, rather than a native Android/iOS codebase | Single codebase for iOS + Android + tablet; reuses the website's content-lib schemas/loader directly; Expo Router mirrors the website's App Router mental model (§5.4) | Not recorded as evaluated — no alternative framework's trial or rejection is established in project history | Active, primary target |
| Content stored as Git-tracked JSON, validated by Zod schemas shared between both runtimes | Single source of truth; no format-specific tooling; schema violations fail loudly with a file path rather than silently rendering wrong data | MDX/Markdown/YAML with frontmatter — explicitly named in `content-lib/README.md` as "not yet here," a distinct future decision if ever adopted | Current, deliberate |
| Metro `watchFolders` + generated static-import manifest, rather than copying content into `mobile/` | Preserves a single source of truth (no duplicated editorial content to keep in sync); the manifest is glue code, not a content copy (§5.3) | Not recorded as evaluated | Active |
| `patch-package` for the autolinking fix, rather than a fork or a version change | Durable across fresh installs; fails loudly if the underlying package changes incompatibly; smallest possible surface area for a two-function fix (§7.3) | Fork-and-publish; manual `node_modules` edit — both explicitly rejected in the reasoning captured in §7.3 | Active |
| `org.gradle.java.home` pinned to JDK 17 in a committed `gradle.properties` | Makes the build reproducible on any machine with that JDK installed, independent of what else is on `PATH`/`JAVA_HOME` (§7.2) | Not recorded as evaluated (e.g., a `.tool-versions`/`jenv`-based approach) | Active |
| GitHub Release (not a repository commit, not Git LFS) for APK distribution | APKs exceed GitHub's 100 MB per-blob limit; build artifacts are regenerable and do not belong in permanent git history | Git LFS — considered when this decision was made in-session; rejected for this project's scale given the added storage-quota and clone-behavior overhead relative to a Release asset | Active |
| Translations stored as a `translations` object on the same content record, not as separate files/collections | Keeps a chapter's English source and its Tamil/Kannada/Hindi translations co-located and validated by one schema; `i18n.ts`'s `localize*()` overlays translations onto the base record non-mutating and field-by-field | Not recorded as evaluated | Active |
| Divya Desam translation quality as the benchmark for all subsequent translated content | It was the first content translated to completion and reviewed to a high bar; used as the calibration reference for tone and fidelity in every book translated afterward (§9) | Not applicable — established by precedent, not by comparison against an alternative benchmark | Active standard |

---

## 9. Content engineering and translation

The translation work is treated in this project as a content-engineering
process with the same rigor as code — with source-of-truth discipline,
mechanical validation, checkpointed commits, and a dedicated review pass
— not as ordinary prose translation.

```
English source (content/*.json body)
        ↓
Translation drafted directly, chapter by chapter (Tamil, Kannada, Hindi)
        ↓
Mechanical validation: paragraph-count parity against the source;
regex check for the gloss-duplication bug (below)
        ↓
Chapter-level QC checklist (13 points, see below)
        ↓
Git checkpoint: commit + push after every 3 completed chapters
        ↓
Full book-level review, after the final chapter
        ↓
Cross-book QC pass, across every translated book/collection
```

### 9.1 Source languages — CONFIRMED (direct project rule, enforced throughout)

Translations are produced in **Tamil, Kannada, and Hindi only.**
**There is no Telugu translation component in this project.** This is
enforced not only as a target-language rule but as a script-purity rule:
Telugu and Kannada share visually similar Unicode ranges for some
independent vowel signs, which is a realistic place for a single
character to leak from one script into the other unnoticed. A
cross-book scan of all 265 translated chapter/entry files (JAYA, Sri
Rama Charithram, Srimad Bhagavata Kathasagaram, the Visishtadvaita book,
and Divya Desams) for any character in the Telugu Unicode block found
exactly one instance — a single Telugu vowel sign (U+0C48) inside an
otherwise-correct Kannada word in `content/divya-desams/tirupperai.json`,
corrected to the equivalent Kannada vowel sign (U+0CC8) in commit
`7f681e5`. No other instance was found anywhere in the corpus.

**Update (2026-09-23):** this rule no longer holds. Telugu was added as
a fifth translation language in `2c52bef` (interface, all Divya Desams,
and all Library chapters), and Telugu Pasurams followed in `a6786b1`.
The script-purity concern above still applies, now in both directions:
Telugu text must not leak into Kannada, and Kannada must not leak into
Telugu.

### 9.2 Shloka and pasuram handling — CONFIRMED (project rule, applied throughout)

Sanskrit shlokas, Upanishad mahavakyas, and Tamil pasurams/riddle-verses
quoted inside a chapter body are never translated line-by-line. Instead:

- The verse is **transliterated** into the target script — native Tamil
  script or Kannada script for those languages; for Hindi, Sanskrit
  verses already given in Devanagari in the English source are left
  as-is (no re-transliteration needed, since Devanagari is already
  Hindi's script).
- Any English prose explaining the verse's *meaning* is translated
  normally.
- No missing verse is invented, and no transliteration is silently
  replaced with an English-language rendering of the Sanskrit content
  itself.

An example spanning both cases in one chapter: chapter 51 of the
Visishtadvaita book ("Conclusion") closes with a Thiruppallandu pasuram
(Tamil, given in the English source in Roman transliteration) and two
Sanskrit dedication shlokas (given in the English source already in
Devanagari) — the pasuram was rendered into native Tamil script, Kannada
script, and Devanagari; the Sanskrit shlokas were script-converted for
Tamil and Kannada and left in their original Devanagari for Hindi.

### 9.3 Source fidelity and the Divya Desams benchmark

Two standing principles govern translation quality:

- **The English source material is the authority for content.** No
  unsupported information is added; the source is never silently
  corrected or rewritten to read better — content-level defects in the
  source itself (see the Lorem Ipsum extraction defect below) are
  corrected only against the *original* source (the source PDF), never
  invented.
- **The existing Divya Desams translations are the quality benchmark**,
  not a content template. The bar they set is: faithful to source,
  natural readable prose (not excessively ornate or "literary"), no
  invented explanations, no dropped content. Later books follow the
  English source's own structure and voice, not the Divya Desam
  records' structure.

### 9.4 Known translation-defect pattern: gloss duplication

A recurring translation-quality risk, checked mechanically after every
chapter: an English source phrase of the form "word (Sanskrit gloss)"
can be mistranslated into a nonsensical self-duplicate — the translated
word followed by the *same translated word* in parentheses, instead of
the translated word followed by the transliterated Sanskrit term. This
is checked via the regex `(\S+)\s*\(\s*\1\s*\)` against every translated
body immediately after drafting. The full 51-chapter Visishtadvaita book
returned zero hits for this pattern across all three target languages.

### 9.5 Known source-content defect: extraction placeholder text

Two chapters in the Visishtadvaita book carried a real content-integrity
defect inherited from the original PDF-to-JSON extraction: an opening
paragraph followed by dozens of literal repeated `"Lorem ipsum dolor sit
amet"` placeholder paragraphs, flagged by the migration pipeline's own
`migration.needsReview` field. This was caught and fixed by reading the
original source PDF (`source-material/Books/A Brief Insight to
Visishtadvaita Philosophy.pdf`) directly via `pdftotext -layout` and
replacing the placeholder text with the real content before translating
— never translating the placeholder text as-is, and never silently
skipping the chapter:

- `guru-parampara.json` (chapter 12) — corrected against source page
  content around the "Guru Parampara" section heading.
- `charama-shlokams.json` (chapter 47) — the real content turned out to
  already be present in the JSON, immediately followed by six junk
  placeholder paragraphs, which were removed.

A prior audit (commit `d741ac3`, 2026-08-16 — before this book had been
reduced to 51 chapters) had already identified this same defect class:
three chapters in the Visishtadvaita book at the time — `charama-shlokams`,
`guru-parampara`, and a third chapter, `srimad-bhagavatham` (order 168,
its own Sanskrit-invocation opening followed by the same placeholder
pattern) — sitting on source pages the original extraction pipeline
itself had already flagged `containsPlaceholderText: true`, a signal the
migration transform had never actually wired into `needsReview` at the
time. `srimad-bhagavatham.json` was later deleted outright, not
corrected, as one of the 4 chapters removed in commit `0ada4a7`
(§5.7) — three days after the audit and before the translation work in
this document began, which is why it is not among the 51 chapters
translated. It should not be confused with *Srimad Bhagavata
Kathasagaram*, the unrelated, separate 31-chapter book added later
(§5.7, §10).

### 9.6 Checkpoint discipline and the 13-point QC checklist

Chapters were translated and committed in batches of 3, with never more
than 3 chapters left uncommitted at once. Before a chapter counts as
"done," it is checked against 13 criteria: translation completeness,
source fidelity, grammar, spelling, punctuation, terminology
consistency, transliteration correctness, shloka/pasuram handling
(§9.2), formatting, natural readability, no content omissions, correct
file location, and valid JSON.

### 9.7 Book-level and cross-book review

After the Visishtadvaita book's final chapter, a dedicated pass checked
all 51 chapters for: remaining placeholder text, stale `needsReview`
metadata flags, duplicated translation passages between chapters, and
recurrence of the gloss-duplication pattern (§9.4). One stale metadata
flag was found (on `guru-parampara`, left set after its content had
already been corrected) and cleared in commit `46deb88`.

A subsequent cross-book pass scanned all 265 chapter/entry files across
every translated book and the Divya Desams for Telugu-script leaks
(§9.1) and for cross-book terminology drift. One substantive finding:
the Tamil word for "moksha" appears in two different legitimate spellings
across the corpus — மோக்ஷம் (a Sanskritized transliteration) and
மோட்சம் (a native Tamil phonetic rendering) — mixed within individual
books rather than cleanly split by book, appearing in JAYA, Srimad
Bhagavata Kathasagaram, Divya Desams, and the Visishtadvaita book alike.
Both are standard, interchangeable usage in Tamil religious writing.
Reviewed directly with the project owner, who elected to leave this as
natural variation rather than force a corpus-wide standardization
touching 150+ occurrences across already-published books.

### 9.8 Translation checkpoint history — CONFIRMED (git log)

The table below covers the Visishtadvaita book, the most recently
completed translation work at the time of writing. Earlier translation
checkpoints for the other three books (Divya Desams, Sri Rama
Charithram, Srimad Bhagavata Kathasagaram, JAYA) are visible in the
broader project timeline in Section 10.

| Chapters | Commit | Notes |
|---|---|---|
| 1–3 | `b0ad186` | |
| 4–6 | `548885e` | |
| 7–9 | `1c09468` | |
| 10–12 | `f070886` | Ch. 12 source-corrected against the original PDF (§9.5) |
| 13–15 | `c3fb841` | |
| 16–18 | `dedb8b8` | |
| 19–21 | `1928efc` | |
| 22–24 | `aa85873` | |
| 25–27 | `cbec458` | |
| 28–30 | `d4ec11a` | |
| 31–33 | `2a20111` | |
| 34–36 | `ddc8b04` | |
| 37–39 | `4724398` | |
| 40–42 | `0cbc5df` | |
| 43–45 | `0de90b1` | |
| 46–48 | `60f01da` | Ch. 47 source-corrected against the original PDF (§9.5) |
| 49–51 | `d7ec1cc` | Book complete |
| — | `46deb88` | Book-level review: stale `needsReview` flag cleared |
| — | `7f681e5` | Cross-book QC: Telugu-character leak fixed (§9.1) |
| — | `d0a0908` | Prior version of this documentation file |

---

## 10. Project timeline

Reconstructed directly from `git log` (154 total commits at the time of
writing). Dates are commit dates as recorded by git, not necessarily the
date work was performed (a squashed or re-based history can shift these
— see the note on early commits below).

| Date | Milestone |
|---|---|
| 2025-07-27 to 2025-07-29 | Earliest repository history (`Fresh repo with updated files`, `Committing changes before rebase`, `Clean push with all current files` ×2) — consistent with initial repository setup / history rewriting, not attributable to a specific feature |
| 2025-10-18, 2025-10-23 | `Clean push: SAP Build export`, `Force refresh: overwrite with new SAP Build export` — the legacy no-code app export (root of `content-extraction/`, §2) enters the repository |
| 2026-08-12 | Mobile app foundation begins: Phase 6A ("establish Expo mobile architecture and content bridge") and Phase 6B ("implement core mobile screens and content rendering") |
| 2026-08-13 | Phase 6C (mobile UX refinement — design system, tabs, dark mode); 108 Divyadesam 2nd-edition source added; Phase 6D (performance, offline architecture, reading experience); Phase 6E (source material, multi-shrine Divya Desam structure); several Divya Desam data-quality fixes (image misattribution, duplicate images, text-corruption audit) |
| 2026-08-14 to 2026-08-16 | Further Divya Desam data-quality fixes; all 107 Divya Desam records published; a Library audit flags source-incomplete chapters (§9.5); the legacy app's original launch screen restored on both platforms |
| 2026-08-17 | Mobile reading-comfort/settings/translation-system pass; full Divya Desam translation into Tamil, Kannada, and Hindi begins and completes across a rapid sequence of small batched commits |
| 2026-08-19 | Three new Library books added: Sri Rama Charithram, Srimad Bhagavata Kathasagaram, JAYA: A Journey of the Mahabharata; mobile content manifest regenerated (§5.3); documentation updated; 4 misplaced chapters removed from the Visishtadvaita book, finalizing it at 51 chapters (§5.7); a paragraph-rendering bug fixed; Sri Rama Charithram translated |
| 2026-08-20 | Srimad Bhagavata Kathasagaram translated; mobile UI/UX redesign and content cleanup; app chrome localized into Tamil/Kannada/Hindi; Sanskrit shlokas in Tamil translations corrected to transliteration instead of Devanagari; JAYA translation begins (69 chapters, translated in a long same-day sequence of per-chapter and small-batch commits) |
| 2026-08-21 | JAYA translation completes; the `expo-modules-autolinking` hang diagnosed and patched (§7.3); the Visishtadvaita book translated in full (51 chapters, checkpointed every 3 — §9.8); book-level and cross-book QC passes; this documentation file first written |
| 2026-08-23 | This document rewritten to its current form; a GitHub Release (`mobile-v1.0.0`) published with the Android release APK attached (§7.6) |

The 2025-07 through 2025-10 commits predate any feature work visible in
this history and are consistent with initial repository/version-control
setup rather than a specific development milestone; this document does
not assign them a more specific purpose than what their own messages
state.

---

## 11. Reproducibility

### 11.1 Prerequisites — CONFIRMED

- Node.js 24 (`.nvmrc` at the repository root; the mobile app's own
  `package.json` does not pin a separate Node version)
- npm (verified against `11.4.2` in the development environment this
  document was written in; not independently pinned by the repository)
- For Android builds: OpenJDK 17 (Homebrew path expected at
  `/opt/homebrew/opt/openjdk@17`, per §7.2 — adjust
  `mobile/android/gradle.properties`'s `org.gradle.java.home` if your
  JDK 17 lives elsewhere or you are not on macOS/Homebrew)
- Android SDK/platform tools for `adb` and device installation
- `gh` (GitHub CLI) only if reproducing the release-publishing step

### 11.2 Website

```
npm install
npm run dev              # http://localhost:3000
npm run test:content     # content-lib + schema tests
npm run test:app         # app-layer tests
npm run typecheck
npm run build             # production build
```

### 11.3 Mobile — development

```
cd mobile
npm install               # runs patch-package automatically via postinstall (§7.3)
npx expo start             # Expo dev server (Metro) — scan the QR code with Expo Go
npx expo start --android   # requires Android tooling
npx expo start --ios       # requires Xcode/iOS tooling
npx expo start --tunnel    # share a live QR code with a remote reviewer
node --test tests/*.test.ts               # test suite (Node-native, no Jest)
./node_modules/.bin/tsc --noEmit          # TypeScript check
node scripts/generate-content-manifest.ts  # regenerate content + image manifest after any /content or public/images change — see §5.3 for why this is easy to forget
```

### 11.4 Android — debug build

```
cd mobile/android
./gradlew assembleDebug
# output: mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### 11.5 Android — release build

```
cd mobile/android
./gradlew assembleRelease
# output: mobile/android/app/build/outputs/apk/release/app-release.apk
```

No separate manual bundling step is needed: `mobile/android/app/build.gradle`
sets `bundleCommand = "export:embed"`, so the React Native Gradle
plugin's `createBundleReleaseJsAndAssets` task invokes
`npx expo export:embed` automatically as part of `assembleRelease` —
this is the exact command whose Metro/resolver fix is documented in
§7.4. Running `npx expo export:embed` by hand first is only useful for
isolating a bundling failure from a native/Gradle failure while
debugging.

### 11.6 Installing on a physical device

```
adb devices                  # confirm the device is visible and authorized
adb install path/to/app-debug.apk      # or app-release.apk
```

### 11.7 Known troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Unsupported class file major version 68` during a Gradle build | Gradle 8.13 resolved an unsupported JDK (e.g. `openjdk@24`) | Confirm `org.gradle.java.home` in `mobile/android/gradle.properties` points at a real JDK 17 install on your machine (§7.2) |
| Android build (or `react-native-config`/`resolve` autolinking commands) hangs indefinitely with no output | The unpatched `expo-modules-autolinking@2.1.15` `glob.stream()` hang (§7.3) | Run `npm install` inside `mobile/` so `postinstall` applies `mobile/patches/expo-modules-autolinking+2.1.15.patch`; if it was skipped (e.g. `--ignore-scripts`), run `npx patch-package` manually |
| `npx expo export` fails with `Unable to resolve module zod from .../content-lib/schemas/shared.ts` | Metro's resolver did not include the repository root's `node_modules` (§7.4) | Confirm `mobile/metro.config.js`'s `config.resolver.nodeModulesPaths` still includes the repo root |
| New/edited content under `/content` doesn't appear in the mobile app, but does on the website | The mobile content manifest is a build-time snapshot, not live (§5.3) | Run `node mobile/scripts/generate-content-manifest.ts` |
| `tsc --noEmit` in `mobile/` takes minutes | `resolveJsonModule` re-enabled, causing full literal-type inference over 160+ JSON content imports (§5.3) | Confirm `mobile/tsconfig.json` still sets `"resolveJsonModule": false` |

### 11.8 The dependency patch, explained for maintainers

`mobile/patches/expo-modules-autolinking+2.1.15.patch` exists because of
a confirmed, reproducible hang in that exact package version under this
project's dependency tree (§7.3). It is applied automatically by
`patch-package` via the `"postinstall": "patch-package"` script in
`mobile/package.json` on every `npm install` — no manual step is
required in the ordinary case. If `expo-modules-autolinking` is ever
upgraded past `2.1.15`, `patch-package` will fail loudly (rather than
silently applying a stale patch) if the target file no longer matches
what the patch expects; at that point, re-verify whether the upstream
`glob.stream()` code path has changed or been fixed before deciding
whether the patch is still needed.

---

## 12. Current state and known limitations

- The website (repository root) is legacy/maintenance-only; new feature
  work targets the mobile app (`mobile/README.md`, confirmed by the
  project's own stated direction).
- Translations (`content-lib/i18n.ts`) are wired into the mobile UI only;
  the data exists in `/content` for the website too, but no website UI
  currently calls the localization functions.
- The mobile app is not yet submitted to either app store; no `eas.json`
  exists; distribution is currently via a GitHub Release
  (`mobile-v1.0.0`) or direct Expo Go / EAS internal-distribution sharing
  (§7.6).
- For genuine offline-first image handling at scale (230+ images),
  `mobile/README.md` identifies `expo-file-system` with on-first-use
  caching as the natural next step, not yet implemented — images are
  currently bundled directly into the app binary via Metro's asset
  pipeline.
- `content-lib/README.md` and `content/README.md` contain stale content
  counts (55/162 chapters, from before the 4-chapter Visishtadvaita
  correction and the addition of three more Library books) that were not
  updated as part of this documentation pass; §5.7 above gives the
  current, directly recounted figures. Updating those two files is
  flagged here as outstanding maintenance work, not performed as part of
  this rewrite (out of scope: this pass covers `DOCUMENTATION.md` only).
- The Tamil மோக்ஷம்/மோட்சம் spelling variation (§9.7) is a deliberate,
  reviewed decision to leave as-is, not an unnoticed inconsistency.

---

## 13. Editorial self-review

Performed as a separate pass after drafting, checking this document
against the standard it was written to meet:

**Technical accuracy.** Every version number, file path, commit hash,
and command in this document was read directly from the repository or
its installed dependencies at the time of writing (§3, §4, §7) rather
than assumed. Commands in §11 match the scripts actually defined in
`package.json`/`mobile/package.json` and the `mobile/README.md`
commands already in use in this project.

**Historical accuracy.** The project timeline (§10) is built entirely
from `git log` output, not narrative reconstruction. Every commit hash
cited elsewhere in this document was independently confirmed to exist
and to say what this document claims it says (`git show <hash>`), not
copied from a prior draft without re-verification. No date, decision, or
motivation is stated more specifically than the evidence supports — see
the four-tier evidentiary framework in the Scope section and its
application throughout §7 in particular.

**Completeness.** Development process (§6, §10), the AI-assisted
workflow specifically (§6), architecture (§4, §5), the translation
process (§9), the error/fix history (§7), git history (§9.8, §10), build
and reproduction instructions (§11), and current limitations (§12) are
each covered as their own section.

**Professional quality.** Written in the register of engineering
documentation — structured sections, tables, precise terminology,
citations to specific files/commits/line-level diffs — without
conversational filler, marketing language, or reader-directed
reassurance ("this is easy," "don't worry").

**Reproducibility.** §11 gives a developer with no prior context enough
to install, run, build, and troubleshoot both runtimes, cross-referenced
back to the architecture/troubleshooting sections that explain *why*
each step is necessary.

Two things this review deliberately did **not** do, and why: it did not
independently verify every command in §11 by executing it fresh in this
session (several — `expo start`, a full `assembleRelease` — are
long-running and were already exercised to produce the existing APK
artifacts referenced in §7.5), and it did not update the stale counts in
`content-lib/README.md`/`content/README.md` noted in §12, since that is
a change to different files outside this rewrite's stated scope.

---

## 14. Cross-generational UI/UX design pass (2026-08-23)

### 14.1 Design philosophy

Vedanta Yojana's interface targets one coherent experience across a
genuinely wide age range — Gen Z through readers in their 60s and
older — rather than a modern default with an accessibility mode bolted
on, or a plain/legacy default with a "modern" mode layered over it.
This is universal design, not two products: **one interface, adaptive
controls** (text size, theme, language), **not** a separate "senior
mode." Concretely, this means the default experience must already be
clear, high-contrast, and predictable — personalization exists to let a
reader tune it further, not to compensate for a default that only works
for one audience.

The standard the interface is held to, restated precisely because it
governs every decision in §14.4: modern enough that a younger reader
chooses to keep using it; clear enough that an older reader never feels
lost; comfortable enough to read for an hour; refined enough to feel
like a deliberately designed digital library, not a generic app
scaffold, a generic "spiritual app," or a decorative temple website.

### 14.2 Inspection methodology

Per this pass's own instruction not to implement a design review
blindly, every recommendation was checked against the actual repository
before any code changed: `theme.ts` (the design-token system),
`ThemeProvider.tsx`, `ReadingPreferencesProvider.tsx`,
`content-lib/preferences.ts` (font-scale steps and their validation),
the chapter reader (`app/(tabs)/library/[book]/[chapter].tsx`), the
Library book/index screens, the Search screen, the Divya Desam detail
screen, the bottom-tab navigator (`app/(tabs)/_layout.tsx`), and the
shared components most reused across the app (`ContentCard`,
`Section`, `SettingsControls`, `DraftBadge`, `ResourceLink`,
`WelcomeScreen`) — plus the content schemas (`content-lib/schemas/`)
and real content data, to determine which review recommendations were
actually supported by the content model rather than assumed.

Two numeric checks were run directly rather than eyeballed:

- **Color contrast** — computed WCAG contrast ratios from the exact hex
  values in `theme.ts` for every foreground/background pairing in both
  color schemes. All seven pairs checked clear AA (4.5:1) for normal
  text; several clear AAA (7:1). Full numbers in the table below. No
  contrast change was made — none was needed.

| Pair | Ratio | AA (4.5:1) |
|---|---|---|
| Light foreground/background | 16.19:1 | PASS |
| Light muted/background | 5.72:1 | PASS |
| Light accent/background | 8.07:1 | PASS |
| Light accent/surface | 8.43:1 | PASS |
| Dark foreground/background | 15.18:1 | PASS |
| Dark muted/background | 6.77:1 | PASS |
| Dark accent/background | 7.42:1 | PASS |

- **Content-model support for structured verse presentation** — checked
  `content-lib/schemas/chapter.ts` directly: chapter `body` is a single
  free-form string, with no separate fields for verse/transliteration/
  meaning/commentary. This is the deciding fact behind the DEFERRED
  verdict on §14.4's shloka-presentation item below.

### 14.3 Device testing status

**First attempt: blocked, not skipped.** The Samsung Galaxy S10
referenced in this review's instructions was not reachable from this
machine when this pass began: `adb devices` returned an empty device
list repeatedly (including after `adb kill-server && adb start-server`),
and macOS's own USB device enumeration (`system_profiler SPUSBDataType`)
showed no Samsung/Android device connected either. This was reported to
the project owner immediately on discovery rather than silently worked
around, and every finding from that phase was labeled CODE-VERIFIED /
NOT DEVICE-VERIFIED accordingly.

**Second attempt, same day: connected and verified.** The device was
reconnected later in the same working session. `adb devices -l`
confirmed a real device (`RF8N725NPHW`, `model:SM_G973U` — the Galaxy
S10's model number, Android 12 / SDK 31, 1080×2280 effective
resolution). What followed was real, interactive, on-device testing —
not a resumed code review:

1. The currently-installed app was the **release** build from
   2026-08-21 (confirmed via `adb shell dumpsys package` — no
   `debuggable` flag, timestamp matched `app-release.apk`), which
   predates every change in this pass. Installed the **debug** build
   instead (`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`)
   and started Metro (`npx expo start --localhost`) with
   `adb reverse tcp:8081 tcp:8081`, so the device loads live JS
   reflecting the actual current source — not a rebuilt native binary,
   which was unnecessary since nothing in this pass touches native code.
2. The device was locked (a security bouncer) when first reached; this
   was reported to the project owner rather than attempted to be
   bypassed, and testing resumed once they unlocked it.
3. Every screenshot in this section is a real `adb exec-out screencap`
   capture of the actual framebuffer — not a simulator, not a mockup.
   Several interactions (`adb shell input tap`/`swipe`) were also used
   to functionally exercise controls, not just view static screens — see
   the Search touch-target finding below, verified by tapping a
   previously-dead zone and confirming real navigation occurred.

iOS was still not tested, for the same reason it never can be from this
environment — no iOS hardware or simulator is available here — and
every iOS-related item keeps its CODE-VERIFIED / NOT DEVICE-VERIFIED
label.

Automated checks were re-run after every code change made during this
device session, not only once at the start: `tsc --noEmit` (clean
throughout) and `node --test tests/*.test.ts` (47/47 pass, unchanged
count) on mobile; `npm run test:content` (320/320 pass) on the website
for the one shared-file change (`content-lib/text-format.ts`,
`components/shared/LongFormSection.tsx`).

### 14.4 Decision matrix

Each recommendation from the review is classified below. Per the
review's own request, this deliberately does **not** implement every
suggestion — restraint was treated as part of the standard, not a
shortfall against it.

**Book title missing from the reader header**
Status: **IMPLEMENTED**
Reason: Direct code inspection confirmed a real gap: the reader showed
the chapter title and "Chapter X of Y" but never the book title
anywhere on screen — a reader returning to a backgrounded app or
following a deep link had no way to tell which book they were reading.
This is exactly §11's "what book / what chapter / where in book"
requirement, and it was previously only two-thirds met.
Evidence: `mobile/app/(tabs)/library/[book]/[chapter].tsx`, commit
`254e696`. Uses the same `loadBook`/`localizeBook` pair already used
identically by the book-detail screen; the mobile loader caches parsed
records (§5.3), so this adds no meaningful cost. **DEVICE-VERIFIED**
(Galaxy S10): confirmed live on both "Artha Panchakam" (Visishtadvaita
book) and "Gajendra Moksham" (Srimad Bhagavata Kathasagaram) — the
book title now shows as a small muted label above the chapter title in
both cases.

**Chapter-pager title truncation risk at large font scale**
Status: **IMPLEMENTED**, then **corrected on-device**
Reason: The Previous/Next chapter pager capped the *target chapter's own
title* at `numberOfLines={1}`. At a long title combined with a large
font-scale setting, this risks an ellipsis hiding which chapter is
about to open — the exact "typography must reflow, not clip" failure
this pass calls out by name. First widened to 2 lines.
Evidence: `mobile/app/(tabs)/library/[book]/[chapter].tsx`, commit
`254e696` (1→2 lines), corrected in commit `684b898` (2→3 lines).
**DEVICE-VERIFIED**: at the app's own "Extra Large" font-scale setting
(already active on the test device from a prior session — a real
reader's real setting, not a contrived worst case), the 2-line version
still truncated a real chapter title ("The aathma, as mentioned and
described by the Bhagavad Gita") with an ellipsis. This is exactly the
category of gap this pass was designed to catch — a fix that looked
sufficient from source alone but wasn't, caught only by looking at the
actual screen. Bumped to 3 lines, force-reloaded the app, re-scrolled
to the same pager, and confirmed the full title now renders with no
truncation.

**Search result rows below the app's own 44pt touch-target standard**
Status: **IMPLEMENTED**
Reason: This was found during inspection, not proposed by the review —
and it is a real regression against a standard *this app already
enforces everywhere else*. `ContentCard`, the chapter pager buttons,
settings pill groups, and search filter chips all enforce
`layout.minTouchTarget` (44pt) via `minHeight`. Search's result rows
did not: they were tappable only through a bare `<Text onPress>` on the
title line, with no `Pressable` wrapper and no `minHeight` — an actual
hit area of roughly one line of 16sp text, well under 44pt.
Evidence: `mobile/app/(tabs)/search.tsx`, commit `6af486b`. The whole
row (title, type/book metadata, excerpt) is now wrapped in one
`Pressable` with `minHeight: layout.minTouchTarget`. **DEVICE-VERIFIED,
functionally, not just visually**: searched "moksham," then deliberately
tapped the result row's *metadata line* ("CHAPTER · SRIMAD BHAGAVATA
KATHASAGARAM") rather than the title text — the exact area that was a
dead zone before this fix — and confirmed it navigated into the
"Gajendra Moksham" chapter correctly.

**Welcome screen's primary button label not immediately legible**
Status: **IMPLEMENTED**
Reason: Found in the *previous* audit turn, acted on in this pass. The
one interactive control on the app's very first screen had
"Jñānayātrām Pravartaya" (Sanskrit transliteration) as its own visible
label, with the actual plain-English affordance relegated to a smaller
caption underneath — a critical, unfamiliar action whose own label
didn't carry its meaning, for a reader of any age or generation.
Evidence: `mobile/components/WelcomeScreen.tsx`, commit `234f205`. The
button's own label is now "Begin"; "Jñānayātrām Pravartaya" moved to
the caption position, so the Sanskrit invocation is preserved on the
screen exactly as before — nothing about the screen's content, imagery,
tagline, or audio changed. Also unified the button's interaction
pattern (`Pressable` + a light haptic) with the rest of the app; this
was the one remaining `TouchableOpacity` in the codebase.
**DEVICE-VERIFIED**: cleared the app's local storage
(`adb shell pm clear`) specifically to see this once-per-install screen
again, and confirmed on-screen exactly as designed — "Begin" as the
button's own clear label, "Jñānayātrām Pravartaya" preserved as a
caption beneath it.

**Autoplaying welcome-screen audio, no separate skip control**
Status: **REJECTED (reviewed, not changed)**
Reason: This was flagged as a real residual risk in the previous audit
turn, but implementing a change here in this pass was deliberately
rejected. It reverses a previously reasoned, documented decision
(commit `98937c5`'s message states explicitly: *"No 'Skip Audio' button
-- with real audio now wired up there's nothing for it to skip past"*)
without new evidence that it is actually causing a problem for readers,
and the exposure is small — the audio stops the instant the one visible
button on the screen is tapped, not an indefinite or looping
interruption. Overturning a documented past decision on the strength of
a hypothetical, without a device to confirm how disruptive (or not) it
actually feels, does not meet this pass's own bar of "meaningful
benefit" over "checklist completeness."
Evidence: `mobile/components/WelcomeScreen.tsx` (unchanged in this
regard), commit `98937c5`'s message.

**Quick in-reader "Aa" appearance control**
Status: **DEFERRED**
Reason: Checked the actual navigation mechanics before deciding: tapping
the Settings tab while mid-chapter, adjusting text size/theme, then
tapping back to the Library tab does **not** reset the reading
position — the per-tab `tabPress` listener in `app/(tabs)/_layout.tsx`
only pops a tab's stack to root when that tab was *already* focused at
the moment of the tap, so returning from Settings preserves the exact
chapter and scroll state. The existing "one tab away" path is therefore
lower-friction than it first appears, and is state-preserving. Adding a
dedicated in-reader control would introduce a new UI pattern (a
popover or bottom sheet) and a real cross-platform testing surface —
this pass's own instructions specifically caution that a bottom sheet
needs verifying "naturally on Android AND iOS" — which cannot be
responsibly verified with no device reachable on either platform right
now. Revisit once device testing (Android at minimum) is available.
Evidence: `mobile/app/(tabs)/_layout.tsx` lines 101–105, 116–120.

**Additional reading themes (Sepia/Paper/Slate)**
Status: **NOT NECESSARY**
Reason: `theme.ts`'s own design-intent comment already states the light
palette is deliberately warm and paper-like (`background: "#fbfaf7"`,
explicitly "not SaaS," no pure white), and dark mode is a genuine
second palette, not an inverted light one (§5, §8 of this document).
The specific benefit a "Sepia" reading theme would add over the
existing warm light theme was not established, and adding a third,
reading-specific palette is real design and contrast-verification work
this pass's own instructions warn against taking on speculatively
("three meaningful options are better than seven cosmetic ones" —
the existing System/Light/Dark set is exactly three). No reader
complaint or usability gap motivated this change.
Evidence: `theme.ts` lines 11–47.

**Book-spine-inspired card redesign**
Status: **ALREADY SUBSTANTIALLY ACHIEVED**
Reason: `ContentCard.tsx` already carries a restrained, non-literal
"spine" cue — a 4pt colored left-edge stripe per book/section
(`tintColor`), a rounded card, and an already-minimal shadow
(`shadows.ts`: iOS `shadowOpacity: 0.08`, Android `elevation: 2`) —
without resembling a literal physical book, which this pass's own
instructions explicitly warn against ("avoid... excessive
skeuomorphism," "avoid... heavy shadows"). A more literal redesign
risks violating the instruction it would be implementing.
Evidence: `mobile/components/ContentCard.tsx`, `mobile/shadows.ts`.

**Book-card metadata (author, chapter count, etc.)**
Status: **PARTIALLY ALREADY EXISTS / candidate for a future, deliberate
addition**
Reason: Chapter count is already shown on every Library index card
(`chapterCountLabel`). `author` genuinely exists in the content schema
and *is* populated identically across all four books
(`"Vishnu Sreenivas"`, confirmed by reading every `book.json` directly)
but is not currently surfaced in the UI. Unlike the fixes above, this
is a content-presentation decision (whether and how to credit
authorship on every book card) rather than a usability defect, and was
left to the project owner to decide rather than added unilaterally.
Evidence: `content/library/*/book.json` (`author` field, all four
files), `content-lib/schemas/book.ts` line 49,
`mobile/app/(tabs)/library/index.tsx`.

**Structured shloka/verse presentation (original / transliteration /
meaning / commentary as distinct visual blocks)**
Status: **DEFERRED — blocked by the content model, not by design
effort**
Reason: `content-lib/schemas/chapter.ts` confirms `body` is a single
free-form string with no structural separation between a quoted verse,
its transliteration, and its prose meaning. Visually distinguishing
these would require either a content-model change (a real, separate
migration effort touching every translated chapter, out of scope for a
UI pass) or fragile runtime pattern-matching on prose to guess which
lines are verse versus explanation — which risks misclassifying
ordinary prose as verse or vice versa, directly conflicting with this
project's standing rule that the source material is never rewritten or
reinterpreted. Correctly deferred, not silently dropped: documented
here as a real future enhancement contingent on a content-model
decision, which is outside a reversible-UI-fix's scope.
Evidence: `content-lib/schemas/chapter.ts` lines 32–43.

**Contextual glossary (tap-to-define terms)**
Status: **REJECTED — no glossary content exists**
Reason: Searched the entire content model directly
(`content/knowledge/introduction.json`'s own field list, a repository-
wide search for anything glossary-shaped) — no controlled glossary of
terms exists anywhere in this project's content. Per this pass's own
explicit instruction, a glossary is not to be invented to satisfy the
review, and no definition may be fabricated. Documented here as a
legitimate future enhancement, contingent on a glossary actually being
authored as content first.
Evidence: repository-wide search, `content/knowledge/introduction.json`.

**Chapter navigation sheet (tap chapter context to open a full
navigator)**
Status: **DEFERRED**
Reason: The existing Previous/Next pager (full chapter titles, not
arrows) plus edge-swipe already provides complete chapter-to-chapter
navigation with clear, familiar labels — no navigation gap was found
that a sheet would close. Adding one is a new UI surface with its own
cross-platform (Android/iOS) presentation behavior to verify, which
cannot be responsibly done with no device reachable. Revisit if the
book-title-in-header addition (implemented above) turns out to be
insufficient context once it can actually be tested on a phone.

**Reading time estimate**
Status: **ALREADY EXISTS, already computed from real text volume, not
fashion**
Reason: `estimateReadingMinutes` (`content-lib/text-format.ts`) is
already shown in the reader alongside "Chapter X of Y," derived
directly from the chapter's actual word count — not a fabricated or
decorative figure. No change needed; verified the existing
implementation actually measures real content rather than assuming it
does.

**Progress indicator**
Status: **ALREADY EXISTS, already non-gamified**
Reason: A thin, book-tinted scroll-position bar plus the "Chapter X of
Y" position label were already present before this pass — pure
orientation, no points/streaks/badges anywhere in the codebase
(confirmed by inspection; no such mechanic exists to remove).

**Haptics**
Status: **ALREADY EXISTS, already restrained**
Reason: `expo-haptics` is already a dependency and already used
purposefully — one light impact per meaningful action (card taps,
pager navigation, settings changes), not on every touch. This pass's
one haptics-related change was consistency, not addition: the welcome
screen's button was the sole remaining interactive element still using
`TouchableOpacity` with no haptic at all; it now matches the rest of
the app (§14.4, welcome-screen fix above).

**Icons + labels, refined ("critical/unfamiliar actions need labels;
familiar navigation may be icon-only if accessibly labeled")**
Status: **ALREADY EXISTS**
Reason: Re-checked against this pass's more nuanced version of the
principle specifically. Every tab-bar icon ships with its own visible
text label (React Navigation's default, not suppressed anywhere in
`app/(tabs)/_layout.tsx`). Every critical action found during this and
the previous audit turn (chapter navigation, theme/font-size/language
selection, draft-status indication) already uses a full text label, not
an icon alone. No familiar-navigation icon was found missing an
accessibility label.

**Contrast standard (AA, not an arbitrary universal 7:1)**
Status: **ALREADY EXISTS / no change needed**
Reason: The previous audit turn had already computed these exact
ratios and confirmed every pair clears AA; several already clear AAA
without having been specifically targeted at that level. Recomputed
directly in §14.2 above to confirm nothing has drifted. No palette
change was made.

**Font-scale ceiling (0.9×–1.3×)**
Status: **UNVERIFIED — deliberately not changed**
Reason: Per this pass's own explicit instruction ("test the existing
maximum... increase it only after verifying layout behavior... never
solve large-text problems by clipping"), the ceiling was left exactly
as-is. The one concrete clipping risk found by code inspection at the
existing ceiling (the chapter pager's `numberOfLines={1}`) was fixed
(above). Whether 1.3× combined with OS-level accessibility scaling is
actually sufficient for a reader who needs more cannot be honestly
answered without the device this pass could not reach.

**`allowFontScaling` / OS text-scaling respect**
Status: **ALREADY EXISTS — confirmed, not assumed**
Reason: Searched the entire mobile codebase for
`allowFontScaling`/`maxFontSizeMultiplier` overrides — none exist. Every
`<Text>` in the app uses React Native's default (`allowFontScaling:
true`), so the OS-level accessibility text-size setting already
compounds with the in-app font-scale control. Confirmed by search, not
assumed from the absence of a comment saying otherwise.

**Android hardware/gesture Back behavior in the reader**
Status: **ALREADY EXISTS, verified by code — NOT DEVICE-VERIFIED**
Reason: Book Detail → Chapter uses `router.push` (a real stack push,
confirmed in `app/(tabs)/library/[book].tsx`), and chapter-to-chapter
paging (via the pager buttons or the swipe gesture) uses
`router.replace`, not push — by design, per the code's own comment, so
Back from any chapter — including after paging through several —
returns to that book's chapter list in one step, never exiting the app
or landing on an unrelated screen, and never accumulating a long stack
of visited chapters. This matches §19's requirement exactly, and predates
this design pass. The underlying mechanism (expo-router's native Stack)
is a well-established one; the actual on-device feel of the hardware
Back button and any Android gesture-nav edge cases have not been
physically confirmed.
Evidence: `mobile/app/(tabs)/library/[book].tsx` line 52 (push),
`mobile/app/(tabs)/library/[book]/[chapter].tsx` line 102 (replace).

**iOS-specific behavior (safe areas, sheet presentation, gesture
interactions)**
Status: **UNVERIFIED — no iOS hardware or simulator available in this
environment**
Reason: Nothing in this pass claims an iOS result. Existing
platform-conditional code (`shadows.ts`'s `Platform.select`, the tab
navigator's `headerTransparent`/`headerBlurEffect` handling noted in
§5) was reviewed and left as-is; no iOS-only change was made or is
claimed to have been tested.

**Performance/memory**
Status: **NO REGRESSION INTRODUCED**
Reason: Every change in this pass is additive UI (a label, a
`Pressable` wrapper, a `numberOfLines` value) using data already loaded
by the existing, cached mobile loader (§5.3) — no new dependency, no
new in-memory index, no duplicated content. `node --test`'s pass count
(47/47) is unchanged from before this pass.

**Content/translation integrity**
Status: **UNTOUCHED, by design**
Reason: No change across this entire pass (original review plus the
device session) modified any `translations` field, any chapter/book
body, or any Sanskrit/Tamil/Kannada/Hindi content. Every edit was
confined to `mobile/app/`, `mobile/components/`, and — for the
subheading fix below, which is genuinely shared presentation logic, not
content — `content-lib/text-format.ts` and
`components/shared/LongFormSection.tsx`. Verified directly: none of the
7 files touched across this pass's 6 commits are under `content/`.

**Chapter body sub-headings not visually distinguished from prose**
Status: **IMPLEMENTED — found by the project owner reading the app
live, not part of the original review**
Reason: Reported directly mid-session: "Chapter headings were not
bolded and if there were sub chapters in between, they were appearing
as continuous text, there was no differentiation at all." Traced to
`content-lib/text-format.ts`'s `paragraphsForReading`: every block gets
identical styling regardless of content, so a chapter's own internal
section labels (artha-panchakam's "Meaning:", "The Moksha Virodhi";
JAYA's embedded "PART IV: ..." markers) read as indistinguishable from
ordinary prose. Since the content model has no dedicated heading field
(chapter `body` is one free-form string), a new pure function,
`looksLikeSubheading()`, infers it presentationally — short (≤70 chars)
and not ending in sentence-terminal punctuation — validated against
real content (a 265-file frequency check, ~25% of paragraph blocks
fire, matching how much of the corpus is genuinely subsectioned) before
being wired into rendering.
Evidence: `content-lib/text-format.ts`, `mobile/components/Section.tsx`,
`components/shared/LongFormSection.tsx`, commit `a74a2b6`.
**DEVICE-VERIFIED extensively**: opened "Artha Panchakam" (chosen
specifically because it was known from the corpus-wide check to contain
many real sub-headings) and scrolled through the full chapter — "Some
of his greatest works include:", each numbered work title, "Meaning:",
"Swarupam of Parabramham," "The Swaroopa Niroopaka Gunas are five in
number:", "Gaining of Sarva Kainkaryam during Moksham," and "Phala
Stuti" all rendered bold with a clear break from the surrounding text,
exactly as intended. Also confirmed the heuristic's known trade-off
directly on-screen: short Tamil pasuram verse lines also render bold
(they can't be distinguished from a heading by this signal alone) —
confirmed this reads fine in practice, not confusing, since verse lines
already sit on their own line. Also confirmed real sentences with an
embedded colon ("Satyatvam: He is invariant at all times.") correctly
stay unbolded, since they end in a period.

**Nested-Stack screen headers overlapping the status bar**
Status: **INVESTIGATED, then IMPLEMENTED on direct report — see §14.7**
Reason: Found live on-device, not anticipated by the original review:
the header title overlapped the status bar's clock/icons on the
Library index, a book-detail screen, and the chapter reader — every
screen using a *nested* `Stack` navigator (`library/_layout.tsx`,
`divya-desams/_layout.tsx`). Tabs-level headers (Home, Search,
Settings) showed no overlap on the same device at the same time.
Root cause, confirmed via `adb shell dumpsys notification`: a dense
stack of active notifications across a dozen apps (Instagram, WhatsApp,
Messenger, YouTube, Swiggy, and others), matching exactly the crowded
icon row visible in the screenshots, expanding Samsung's status bar
taller than the height React Navigation's native-stack header
(`@react-navigation/native-stack` ~7.3.10, via `react-native-screens`
~4.11.1) reserves for it — that version has no `headerStatusBarHeight`
prop to compensate (that prop belongs to the older JS-rendered
`@react-navigation/stack`).
**This was initially left unpatched**, reasoned to be transient device
state rather than an app defect worth a workaround that might look
worse than the problem on a normal status bar. **Revisited and actually
fixed later in the same session** on direct report from the project
owner ("the back button and the chapter title are merging with the
notification shade drop down and that isnt looking good") — see §14.7
for the fix and its own device verification. The lesson kept here
deliberately: correctly diagnosing a root cause is not the same
question as whether to fix it, and an initial "leave it" call is
revisited, not defended, once it turns out to matter to the person
actually using the app.

### 14.5 Outstanding: device verification

Updated after the device session in §14.3–§14.4: the reader header,
pager, Search touch-target, welcome-screen, and sub-heading changes are
now device-verified on Android (Galaxy S10), including the one real
correction the device session itself produced (pager 2→3 lines) and one
new defect it surfaced and correctly triaged as out-of-scope (the
notification-driven status-bar overlap). What remains genuinely
outstanding:

- **Maximum *combined* (in-app Extra Large × OS-level accessibility
  large-text) font scale** was not separately tested — the device
  session tested the app's own "Extra Large" (1.3×) setting alone
  (already active from a prior session), not stacked with the Android
  system accessibility text-size setting on top of it. This is a
  meaningfully larger scale than what was verified and could still
  reveal a clipping case the current fixes don't cover.
- **Android hardware/gesture Back** in the reader was reasoned about
  from the `push`/`replace` navigation calls (§14.4) but not physically
  pressed and observed during this session — the code-level mechanism
  is confirmed real, the on-device feel is not.
- **Keyboard behavior** beyond typing a search query (e.g. keyboard
  dismissal edge cases, layout shift) was not specifically exercised.
- **The status-bar overlap's actual transience** — whether it fully
  disappears with a cleared notification tray — was diagnosed from
  `dumpsys notification` output, not confirmed by clearing notifications
  and re-screenshotting the same screen.
- **Any iOS-specific behavior at all** — no iOS hardware or simulator is
  available in this environment, full stop.
- **General "does this actually feel fast/polished/comfortable" judgment**
  over a real, extended reading session — the device testing done here
  was targeted at specific fixes, not a holistic use of the app.

### 14.6 Development-history note for this pass

Consistent with §1 of this document: every change in this section was
proposed, implemented, self-checked (`tsc`, `node --test`), and
committed by the AI assistant, directed and reviewed by the project
owner, who supplied the design standard being evaluated against and
made the explicit call (§14.4, autoplay-audio item) on at least one
judgment where the AI's recommendation was to leave existing, deliberate
behavior unchanged rather than treat an external review as
self-executing. The device-testing gap identified early in §14.3 was
surfaced immediately on discovery, not worked around or hidden behind a
plausible-sounding but untrue "tested on device" claim.

The device session itself (§14.3, second attempt) is a concrete example
of why that discipline matters rather than a formality: code review
alone had produced a pager fix (1→2 lines) that *looked* sufficient and
passed every automated check, but was proven insufficient the moment it
was actually looked at on a screen with a real reader's real font-scale
setting already active. The fix that shipped (3 lines) exists because
the device was actually used, not because the code was re-read more
carefully. Separately, the sub-heading fix in this section exists
because the project owner read the app directly and reported a specific
defect mid-session ("chapter headings were not bolded... no
differentiation at all") that neither the original design review nor
the earlier code-only audit had surfaced — human use of the actual
product, not any review document, found it. And the status-bar finding
was investigated to an actual root cause (device notification volume,
confirmed via `dumpsys`) rather than either ignored or "fixed" with an
untested guess, specifically because a physical device was available to
investigate it on — see §14.7 for what happened when the project owner
came back to say the unpatched version still wasn't good enough.
Locating problems this way — by using the thing, not just reading its
source — is treated in this project as a first-class part of the
engineering process, not a formality performed after the "real" work
of writing code is already done.

### 14.7 Continuation: table of contents and the status-bar fix

The same device session continued past §14.6 with two more pieces of
work, both prompted directly by the project owner rather than proposed
speculatively — consistent with this whole section's standard of
building only what solves an actual, observed problem.

**In-chapter table of contents.** Prompted directly: *"if there are sub
chapters, break them into standalone listings, seeing subchapters not
have a listing isnt looking good, find the best way to execute this."*
Before implementing anything, the two possible readings of "standalone
listings" were surfaced to the project owner as an explicit choice,
because they carry very different risk: splitting a chapter into real
separate Library entries would require editing `chapterOrder` and,
critically, finding equivalent split points across three
already-translated Tamil/Kannada/Hindi bodies that are not reliably
paragraph-aligned to the English source — real risk of corrupting a
translation's structure across potentially dozens of chapters. The
project owner chose the lower-risk alternative: an in-chapter jump-list,
touching no content or translation at all.

The implementation (`content-lib/text-format.ts`'s `getTableOfContents`,
`mobile/components/Section.tsx`, the chapter reader, commit `5ba98f7`)
is a stricter sibling of the `looksLikeSubheading` heuristic already
shipped in §14.4 — validated the same way, against real content, before
being wired into the UI: run against the full 158-chapter Library
corpus, refined twice (excluding list-marker lines, then excluding
comma-terminated transitional phrases) until it stopped misfiring on
the false positives that heuristic testing surfaced, then device-tested
against five real chapters spanning all four Library books, including
one (JAYA's "Ganapati, the Scribe") that had **not** been hand-checked
in advance — specifically to test whether the heuristic generalizes or
only matches cases it was tuned against. It generalized correctly.

One real bug was found and fixed only because a device was available:
the tap-to-jump scroll used `measureLayout(findNodeHandle(scrollView),
...)`, which is silently wrong under this app's New Architecture setup
(`newArchEnabled=true`) — it failed with a runtime error ("ref.measureLayout
must be called with a ref to a native component") that `tsc` and the
test suite both had no way to catch, since it's a React Native runtime
API contract, not a type-level or logic-level one. Passing the
ScrollView ref directly, instead of a node-handle number, fixed it;
re-verified with the same on-device tap-to-jump test immediately after.

**Status-bar header fix, revisited.** Prompted directly: *"the back
button and the chapter title are merging with the notification shade
drop down and that isnt looking good."* This is the same defect
documented in §14.4's "Nested-Stack screen headers overlapping the
status bar" entry, which had been investigated to a confirmed root
cause and then deliberately left unpatched. Getting a direct report
that it was still a real problem for the person using the app changed
the calculus, not the diagnosis — the root cause finding held up
unchanged; what changed was the judgment about whether it was worth
fixing.

The fix (`mobile/components/ScreenHeader.tsx`, commit `4591385`)
replaces the native-rendered header on the two affected nested Stacks
with a JS-rendered one, positioned using `useSafeAreaInsets().top` — a
live, reactive value, unlike whatever internal assumption
`react-native-screens`'s native header was making about status bar
height. This is architecture-level more robust than a one-off patch:
it holds regardless of *why* the status bar is taller than usual (a
notification count, an OEM display cutout, a future Android version),
because it asks the OS what the current inset actually is rather than
assuming a constant. Device-verified on the same phone, in the same
crowded-notification state that produced the original report (confirmed
unchanged via `dumpsys notification` immediately before retesting): the
Library index, a book-detail screen, the chapter reader, the Divya
Desams index, and a Divya Desam detail screen all show clean header
clearance, and the back button was confirmed functional on both
affected Stacks by actually tapping it.

### 14.8 A content-integrity finding, outside the UI/UX scope of this section

Reading Narasimha Avataram (Srimad Bhagavata Kathasagaram) on the
device during this same session surfaced something unrelated to
interface design: a real section of the chapter's own content — "How
Sudarshana is Manifest in Every Avataram," and a fuller account of the
Ahobila Matham's founding — was missing from the English source itself,
reported directly by the project owner with the original text supplied
to restore it. Checked via `git show` against the commit that first
added this book to the repository: the missing content was never
present in this repository's history at all — not a regression
introduced by any later edit, but a gap dating to the chapter's original
migration. Restored from the text supplied directly by the project
owner (this book's own author), consistent with this project's standing
rule that the source material is authoritative; also added the complete
Sudarshana Ashtakam (all 9 verses, Devanagari + IAST + meaning) sourced
from a real, citable text — Swami Desikan's Sudarshana Ashtakam with
annotated commentary by Oppiliappan Koil V. Sadagopan — rather than
reconstructed from memory, and translated the entire addition into
Tamil, Kannada, and Hindi to keep the four languages in parity
(commit `55a28f2`).

One detail worth recording here specifically because it demonstrates
the value of the parity-checking discipline used throughout this
project's translation work (§9): the English restoration initially
quoted one Sanskrit verse twice — once newly in Devanagari, once in the
chapter's pre-existing IAST-only form — a redundancy that went unnoticed
in English itself. All three translations correctly collapsed it to a
single rendering (there being no reason to show the same verse twice in
any target script), which is precisely what caused the paragraph-count
parity check to fail and surface the English duplication. The fix was
to correct the English to match what the translations had already
gotten right, not the reverse — a small, concrete instance of the
cross-language validation catching an error the single-language review
had missed entirely.

This was also initially planned, then corrected, as a separate detail
worth recording: the first instinct was to add the Sudarshana Ashtakam
as its own standalone Library chapter, which would have meant
renumbering `chapterOrder` and every subsequent chapter's `order` field.
That work was actually done — and then reverted — the moment the
project owner clarified: *"this isnt meant to be a separate chapter,
its a sub chapter for narasimha avataram."* The renumbering was undone
file-by-file, `book.json` restored, and the content correctly folded
into the same chapter's body instead, using the same bold-subheading
and table-of-contents mechanism built earlier in this section (§14.4,
§14.7) — which is, concretely, what "sub chapter" means throughout this
document.
