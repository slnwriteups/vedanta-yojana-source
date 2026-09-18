import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadDivyaDesams } from "../content-lib/loader.ts";
import { allPasuramResourceUrls } from "../content-lib/pasuram-resources.ts";
import { getPasuramFileName } from "../services/pasuramResourceId.ts";

/**
 * Emits mobile/assets/pasurams-archive.generated.zst (one solid-
 * compressed archive of every bundled Pasuram PDF) and
 * mobile/content-lib/pasuram-manifest.generated.ts (the static import
 * Metro bundles that archive through, plus the url -> filename lookup
 * table and an integrity manifest, all read at runtime by
 * services/pasuramArchive.ts).
 *
 * Why an archive instead of bundling all 432 loose PDFs as individual
 * Metro assets (the previous approach, commit 9b152a4): measured,
 * real-Android-APK-affecting size. The 432 PDFs are already internally
 * deflate-compressed (XeTeX/dvipdfmx output), so packaging them
 * individually into the APK's own zip container compresses them again
 * for approximately zero further gain -- a real `gradlew
 * assembleRelease` measured 69.14MB with all 432 raw PDFs bundled
 * individually, essentially baseline + the exact 30.22MB raw payload.
 *
 * A SOLID archive (all files concatenated into one continuous stream,
 * then compressed as a single unit) can additionally exploit
 * cross-file redundancy an independently-compressed-per-file container
 * cannot: these 432 documents share boilerplate structure, embedded
 * font programs (Noto/CM/Times subsets), and PDF object scaffolding.
 * Measured on the real corpus: qpdf's lossless stream recompression
 * (--recompress-flate --compression-level=9, verified byte-for-byte
 * text- and page-count-identical to the originals) shrinks the raw
 * corpus 30.22MB -> ~29.0MB, and solid `zstd --ultra -22` on top of
 * that shrinks it further to ~13.45MB -- a floor confirmed against
 * gzip, plain zstd, and xz at multiple levels, not a guess.
 *
 * `zstd` (not `xz`, despite xz measuring marginally smaller) because
 * `fzstd` -- a tiny (65KB), zero-dependency, pure-JS DECODE-ONLY
 * library -- can decompress a zstd stream on-device with no native
 * module; no equivalent pure-JS xz decoder was found. Encoding only
 * ever happens here, once, at generation time, on a dev machine, so
 * needing the real `zstd` and `qpdf` CLI tools installed to run this
 * script (not needed at app runtime) is an acceptable one-time cost --
 * same tradeoff generate-content-manifest.ts already makes for image
 * tooling.
 *
 * `tar --format=ustar` specifically (not the default archive mode):
 * verified empirically (via `xxd` against a real archive from this exact
 * command) to emit plain POSIX ustar headers with no PAX extended-header
 * entries, since every filename here is a short `<32-hex-chars>.pdf`
 * well under ustar's 100-byte name field. services/pasuramTar.ts's
 * parser only implements that plain layout -- it would need real PAX
 * support if this ever emitted long names.
 *
 * Run manually after any change to mobile/assets/pasurams/ or the
 * content corpus's pasuram-pdf resources, same convention as
 * generate-content-manifest.ts:
 *
 *   node mobile/scripts/generate-pasuram-archive.ts
 */

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_ROOT = path.join(MOBILE_ROOT, "assets", "pasurams");
const ARCHIVE_OUTPUT = path.join(MOBILE_ROOT, "assets", "pasurams-archive.generated.zst");
const MANIFEST_OUTPUT = path.join(MOBILE_ROOT, "content-lib", "pasuram-manifest.generated.ts");
/**
 * A single `import` of the binary archive, split into its own file --
 * Node cannot parse a `.zst` (or any binary Metro asset) import at all,
 * so tests/pasuram-archive.test.ts (and any other plain-`node --test`
 * code) must be able to import the pure-data manifest above without
 * transitively pulling this one in. Same split as content-lib/
 * manifest.generated.ts vs. image-manifest.generated.ts.
 */
const ASSET_OUTPUT = path.join(MOBILE_ROOT, "content-lib", "pasuram-archive-asset.generated.ts");

function sha256OfFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function main(): void {
  const urls = allPasuramResourceUrls(loadDivyaDesams());
  const filenames: string[] = [];
  let missing = 0;

  for (const url of urls) {
    const filename = getPasuramFileName(url);
    if (!fs.existsSync(path.join(ASSETS_ROOT, filename))) {
      missing += 1;
      console.warn(`  warning: no bundled PDF for ${url} -- expected ${filename} under mobile/assets/pasurams/`);
      continue;
    }
    filenames.push(filename);
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "pasuram-archive-build-"));
  const optimizedDir = path.join(workDir, "optimized");
  fs.mkdirSync(optimizedDir);

  console.log(`Optimizing ${filenames.length} PDF(s) with qpdf (lossless stream recompression)...`);
  const fileHashes: Record<string, string> = {};
  for (const filename of filenames) {
    const source = path.join(ASSETS_ROOT, filename);
    const optimized = path.join(optimizedDir, filename);
    execFileSync("qpdf", [
      "--compress-streams=y",
      "--object-streams=generate",
      "--recompress-flate",
      "--compression-level=9",
      source,
      optimized,
    ]);
    fileHashes[filename] = sha256OfFile(optimized);
  }

  const tarPath = path.join(workDir, "pasurams.tar");
  console.log("Building a plain ustar archive...");
  execFileSync("tar", ["--format=ustar", "-cf", tarPath, "-C", optimizedDir, ...filenames]);

  console.log("Compressing solidly with zstd --ultra -22 (this can take a minute)...");
  execFileSync("zstd", ["--ultra", "-22", "-T0", "-f", "-o", ARCHIVE_OUTPUT, tarPath]);

  fs.rmSync(workDir, { recursive: true, force: true });

  const archiveVersion = sha256OfFile(ARCHIVE_OUTPUT);
  const archiveRelative = path.relative(path.dirname(ASSET_OUTPUT), ARCHIVE_OUTPUT);

  const urlToFilename: string[] = [];
  const fileHashEntries: string[] = [];
  for (const url of urls) {
    const filename = getPasuramFileName(url);
    if (!(filename in fileHashes)) continue;
    urlToFilename.push(`  ${JSON.stringify(url)}: ${JSON.stringify(filename)},`);
  }
  for (const filename of filenames) {
    fileHashEntries.push(`  ${JSON.stringify(filename)}: ${JSON.stringify(fileHashes[filename])},`);
  }

  const manifestOutput = `/**
 * AUTO-GENERATED by mobile/scripts/generate-pasuram-archive.ts.
 * Do not edit by hand -- regenerate instead.
 *
 * Pure data only -- deliberately no binary asset import here (see
 * pasuram-archive-asset.generated.ts for that), so this file stays
 * loadable under plain \`node --test\` (tests/pasuram-archive.test.ts
 * imports it directly). ${missing} url(s) referenced by the content
 * corpus had no matching bundled PDF and were skipped (see the
 * generator's own warning output).
 */

/** SHA-256 of the bundled archive file itself -- changes whenever the archive's contents change, so services/pasuramArchive.ts can detect a stale on-device unpack (e.g. after an app update) and redo it. */
export const PASURAM_ARCHIVE_VERSION = ${JSON.stringify(archiveVersion)};

/** Prapatti resource URL -> the local filename it unpacks to (see PASURAM_DIRECTORY_NAME in services/pasuramResourceId.ts). */
export const pasuramFilenameByUrl: Record<string, string> = {
${urlToFilename.join("\n")}
};

/** Expected SHA-256 of each archived (qpdf-optimized) PDF's bytes, keyed by filename -- lets the unpack step verify integrity instead of trusting the decompression blindly. */
export const pasuramFileHashes: Record<string, string> = {
${fileHashEntries.join("\n")}
};
`;

  const assetOutput = `/**
 * AUTO-GENERATED by mobile/scripts/generate-pasuram-archive.ts.
 * Do not edit by hand -- regenerate instead.
 *
 * The single import below is the one thing Metro actually bundles into
 * the app for Pasurams: a solid zstd archive of every optimized PDF (see
 * the generator script's own doc comment for why). services/
 * pasuramArchive.ts unpacks it into app-private storage once, on first
 * need, using fzstd (pure JS, no native module) and services/
 * pasuramTar.ts's ustar parser. Split into its own file, separate from
 * pasuram-manifest.generated.ts's pure data, because plain Node cannot
 * parse a binary Metro asset import at all.
 */
import pasuramArchiveAsset from "${archiveRelative.startsWith(".") ? archiveRelative : `./${archiveRelative}`}";

export { pasuramArchiveAsset };
`;

  fs.mkdirSync(path.dirname(MANIFEST_OUTPUT), { recursive: true });
  fs.writeFileSync(MANIFEST_OUTPUT, manifestOutput, "utf8");
  fs.writeFileSync(ASSET_OUTPUT, assetOutput, "utf8");

  const archiveSizeMb = (fs.statSync(ARCHIVE_OUTPUT).size / 1024 / 1024).toFixed(2);
  console.log(
    `Generated ${path.relative(path.join(MOBILE_ROOT, ".."), ARCHIVE_OUTPUT)} (${archiveSizeMb}MB), ` +
      `${path.relative(path.join(MOBILE_ROOT, ".."), MANIFEST_OUTPUT)}, and ` +
      `${path.relative(path.join(MOBILE_ROOT, ".."), ASSET_OUTPUT)}: ${filenames.length} Pasuram PDF(s) archived (${missing} missing).`
  );
}

main();
