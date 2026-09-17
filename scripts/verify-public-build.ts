import fs from "node:fs";
import path from "node:path";

/**
 * Verifies that a built `out/` directory is safe to publish to the public
 * deploy repository, before anything crosses that boundary.
 *
 * This is the single authoritative implementation of the public-output
 * security gate -- .github/workflows/deploy-preview-repo.yml runs this
 * exact script; it is also runnable locally (`node
 * scripts/verify-public-build.ts [dir]`, default `out`) so there is never
 * a second, slightly-different copy of these checks living only in CI.
 *
 * Exits 0 and prints nothing but a summary if every check passes. Exits 1
 * and prints every violation found (with concrete paths) otherwise. Never
 * publishes anything itself -- the workflow only runs its publish step if
 * this script's exit code is 0.
 *
 * Deliberately contains no secrets, no network calls, and no dependency
 * on this being run inside GitHub Actions specifically.
 */

// ---------------------------------------------------------------------------
// Checks 1-2: forbidden content -- internal migration/provenance fields and
// legacy Firebase configuration must never appear as literal data in any
// output file. `needsReview` is deliberately NOT checked: it is a real,
// intentional public field (DraftBadge), unlike the four checked here.
// ---------------------------------------------------------------------------

const FORBIDDEN_INTERNAL_FIELDS = [
  "sourcePageId",
  "extractionConfidence",
  "sourceAssetUuid",
  "sourceOriginalName",
];

// "sourceAssetUuid" is the one field above with a real, intentional public
// exception: books/<slug>.json (scripts/build-book-payloads.ts's output)
// is a downloadable, machine-readable payload the mobile app fetches
// directly, and mobile/services/bookOfflineCore.ts's getOfflineBookImageUri
// resolves a chapter image by looking up that same payload's own
// images[].sourceAssetUuid in its imageFiles map -- there is no
// pre-resolved URL to hand it instead, unlike every HTML page's own
// images (see lib/image-file.ts's resolveImageHref), which is why this
// field never needed an exception before that feature existed. Unlike
// sourcePageId/extractionConfidence/sourceOriginalName, a bare UUID
// carries no migration/provenance information on its own.
const SOURCE_ASSET_UUID_EXCEPTION_TOP_DIR = "books";

// Matched case-insensitively (see below) -- "firebase" alone already
// covers both "firebase" and "Firebase" without listing them separately.
const FORBIDDEN_FIREBASE_STRINGS = ["firebase", "aizasy", "vedanta-yojana-f7948"];

// ---------------------------------------------------------------------------
// Check 3: secret-like files must never exist anywhere under out/, by name
// alone -- these should never be produced by `next build` in the first
// place, but a corrupted/misconfigured public/ could in principle leak one
// through verbatim. `.nojekyll` (added by the workflow just before this
// script runs) matches none of these patterns and is always allowed.
// ---------------------------------------------------------------------------

function isForbiddenSecretLikeFile(filename: string): boolean {
  if (filename === ".env") return true;
  if (/^\.env\..+/.test(filename)) return true;
  return /\.(map|pem|key|jks|keystore|p12|p8)$/.test(filename);
}

// ---------------------------------------------------------------------------
// Check 4: legacy SAP/AppGyver export + content-extraction pipeline
// material must never appear in the public artifact -- none of it is
// needed by the production build (confirmed separately: no build script
// reads content-extraction/), so its presence here would only mean it was
// copied in by mistake.
// ---------------------------------------------------------------------------

function isLegacyExportPath(relativePath: string): boolean {
  const segments = relativePath.split(path.sep);
  if (segments.includes("content-extraction")) return true;
  if (segments.includes("_generated")) return true;
  const filename = segments[segments.length - 1];
  if (/^m?-?page\.Page\d+\.html$/.test(filename)) return true;
  if (filename === "nodered.min.js") return true;
  return false;
}

// ---------------------------------------------------------------------------
// Check 5: source directories must never appear at the top level of out/ --
// a normal `next build` never produces a directory with any of these
// names (none of the app's real routes collide with them), so finding one
// here means something outside the intended `npm run build` output was
// copied in.
// ---------------------------------------------------------------------------

const FORBIDDEN_TOP_LEVEL_SOURCE_DIRS = [
  "app",
  "components",
  "content",
  "content-lib",
  "lib",
  "mobile",
  "scripts",
  "tests",
  ".github",
];

// ---------------------------------------------------------------------------
// Check 6: internal documentation. public/README.md is legitimate source
// (documents the /public directory for developers) and is NOT modified by
// this script or the workflow's build step -- but it has no function on
// the live site and must not cross into the public deploy artifact. The
// workflow deletes out/README.md immediately after build, before this
// script runs; this check is a safety net in case the script is ever run
// without that step.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sanity checks -- catastrophic-build-failure detection, not route-count
// coupling. Two deliberately loose floors instead of an exact page count:
// content grows over time (more temples/chapters), so hard-coding the
// current page count would make this check brittle for entirely benign
// reasons. Both floors are chosen to sit comfortably below today's real
// output (349 pages, 311MB) while still catching a build that silently
// produced only a handful of pages or near-empty output.
// ---------------------------------------------------------------------------

const MIN_TOTAL_SIZE_BYTES = 50 * 1024 * 1024; // 50MB; real build is ~311MB
const MIN_INDEX_HTML_COUNT = 50; // real build has ~349; a handful would mean a broken build

const REQUIRED_FILES = ["index.html", "robots.txt", "sitemap.xml"];
const REQUIRED_NON_EMPTY_DIRS = ["_next", "images", "book-covers", "icons", "nav-icons", "audio"];

interface Violation {
  check: string;
  detail: string;
}

function walk(dir: string, onFile: (absPath: string, relPath: string) => void, base = dir): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs);
    if (entry.isDirectory()) {
      walk(abs, onFile, base);
    } else if (entry.isFile()) {
      onFile(abs, rel);
    }
  }
}

function dirIsNonEmpty(dir: string): boolean {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
  return fs.readdirSync(dir).length > 0;
}

function totalSizeBytes(dir: string): number {
  let total = 0;
  walk(dir, (abs) => {
    total += fs.statSync(abs).size;
  });
  return total;
}

function main(): number {
  const target = process.argv[2] ?? "out";
  const violations: Violation[] = [];

  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.error(`FAIL: build output directory "${target}" does not exist.`);
    return 1;
  }

  // --- Sanity checks -------------------------------------------------------

  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(target, file))) {
      violations.push({ check: "sanity", detail: `missing required file: ${file}` });
    }
  }

  for (const dir of REQUIRED_NON_EMPTY_DIRS) {
    if (!dirIsNonEmpty(path.join(target, dir))) {
      violations.push({ check: "sanity", detail: `missing or empty required directory: ${dir}/` });
    }
  }

  const sizeBytes = totalSizeBytes(target);
  if (sizeBytes < MIN_TOTAL_SIZE_BYTES) {
    violations.push({
      check: "sanity",
      detail: `total output size ${(sizeBytes / 1024 / 1024).toFixed(1)}MB is below the ${MIN_TOTAL_SIZE_BYTES / 1024 / 1024}MB catastrophic-failure floor`,
    });
  }

  let indexHtmlCount = 0;
  walk(target, (_abs, rel) => {
    if (path.basename(rel) === "index.html") indexHtmlCount++;
  });
  if (indexHtmlCount < MIN_INDEX_HTML_COUNT) {
    violations.push({
      check: "sanity",
      detail: `only ${indexHtmlCount} index.html files found, below the ${MIN_INDEX_HTML_COUNT}-page catastrophic-failure floor`,
    });
  }

  // --- Check 5: forbidden top-level source directories ----------------------

  for (const dir of FORBIDDEN_TOP_LEVEL_SOURCE_DIRS) {
    if (fs.existsSync(path.join(target, dir))) {
      violations.push({
        check: "source-directory",
        detail: `source directory "${dir}/" must not appear in the public artifact`,
      });
    }
  }

  // --- Check 6: internal documentation ---------------------------------------

  if (fs.existsSync(path.join(target, "README.md"))) {
    violations.push({
      check: "internal-documentation",
      detail: "README.md must not appear in the public artifact (internal /public directory documentation)",
    });
  }

  // --- Checks 1, 2, 3, 4: per-file content and filename scan -----------------

  const forbiddenFieldBuffers = FORBIDDEN_INTERNAL_FIELDS.map((s) => ({
    label: s,
    buf: Buffer.from(s),
  }));

  walk(target, (abs, rel) => {
    const filename = path.basename(rel);

    if (isForbiddenSecretLikeFile(filename)) {
      violations.push({ check: "secret-like-file", detail: rel });
    }

    if (isLegacyExportPath(rel)) {
      violations.push({ check: "legacy-export", detail: rel });
    }

    const content = fs.readFileSync(abs);
    const topDir = rel.split(path.sep)[0];

    for (const { label, buf } of forbiddenFieldBuffers) {
      if (label === "sourceAssetUuid" && topDir === SOURCE_ASSET_UUID_EXCEPTION_TOP_DIR) continue;
      if (content.includes(buf)) {
        violations.push({ check: "internal-field", detail: `"${label}" found in ${rel}` });
      }
    }

    const lower = content.toString("latin1").toLowerCase();
    for (const needle of FORBIDDEN_FIREBASE_STRINGS) {
      if (lower.includes(needle)) {
        violations.push({ check: "firebase", detail: `"${needle}" found in ${rel}` });
      }
    }
  });

  // --- Report ----------------------------------------------------------------

  if (violations.length > 0) {
    console.error(`FAIL: ${violations.length} violation(s) found in "${target}":\n`);
    for (const v of violations) {
      console.error(`  [${v.check}] ${v.detail}`);
    }
    return 1;
  }

  console.log(`PASS: "${target}" verified clean (${(sizeBytes / 1024 / 1024).toFixed(1)}MB, ${indexHtmlCount} pages).`);
  return 0;
}

process.exit(main());
