import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { pasuramFilenameByUrl } from "../mobile/content-lib/pasuram-manifest.generated.ts";
import { looksLikeCompletePdf } from "../mobile/services/pasuramLatestCore.ts";
import { pasuramMirrorRelativePath } from "../lib/pasuram-mirror.ts";

/**
 * Fills out/pasurams/ with the website's copy of every Pasuram/Stotram
 * PDF (see lib/pasuram-mirror.ts), downloaded fresh from Prapatti.com so
 * the site carries Prapatti's latest corrections. Run by
 * .github/workflows/deploy-pages.yml after `npm run build`, on every
 * deploy and on a daily schedule.
 *
 * If a file can't be downloaded (Prapatti unreachable, an error page, a
 * cut-off download), the copy bundled with the app under
 * mobile/assets/pasurams/ is used instead, so the site never loses a
 * Pasuram. Also writes out/pasurams/index.json -- the SHA-256 of each
 * served file -- which public/sw.js compares against the copies a
 * reader has kept, to refresh the ones that changed.
 *
 *   node scripts/sync-pasuram-mirror.ts            # fetch from Prapatti
 *   node scripts/sync-pasuram-mirror.ts --bundled  # local build, no network
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "out", "pasurams");
const BUNDLED_DIR = path.join(ROOT, "mobile", "assets", "pasurams");
/** Kept low on purpose: Prapatti.com is a volunteer-run site. */
const CONCURRENCY = 2;
const TIMEOUT_MS = 20000;
const ATTEMPTS = 2;

async function download(url: string): Promise<Uint8Array | null> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "VedantaYojana-site-build (+https://vedantayojana.org)" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (looksLikeCompletePdf(bytes)) return bytes;
      }
    } catch {
      // retry, then fall back to the bundled copy
    }
  }
  return null;
}

async function main(): Promise<void> {
  const bundledOnly = process.argv.includes("--bundled");
  if (!fs.existsSync(path.join(ROOT, "out"))) {
    throw new Error("out/ not found -- run `npm run build` first.");
  }
  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  const urls = Object.keys(pasuramFilenameByUrl);
  const hashes: Record<string, string> = {};
  const fallbacks: string[] = [];
  let next = 0;

  async function worker(): Promise<void> {
    while (next < urls.length) {
      const url = urls[next++];
      const relative = pasuramMirrorRelativePath(url);
      if (!relative) throw new Error(`No mirror path for ${url} -- extend lib/pasuram-mirror.ts.`);

      let bytes = bundledOnly ? null : await download(url);
      if (!bytes) {
        bytes = new Uint8Array(fs.readFileSync(path.join(BUNDLED_DIR, pasuramFilenameByUrl[url])));
        fallbacks.push(url);
      }

      const target = path.join(ROOT, "out", relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
      hashes[relative] = crypto.createHash("sha256").update(bytes).digest("hex");
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const sorted = Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), files: sorted })
  );

  const fresh = urls.length - fallbacks.length;
  console.log(`Pasuram mirror: ${urls.length} file(s) -- ${fresh} fresh from Prapatti.com, ${fallbacks.length} from the bundled copy.`);
  if (!bundledOnly && fallbacks.length > 0) {
    for (const url of fallbacks.slice(0, 20)) console.warn(`  used bundled copy: ${url}`);
    // Make it visible in the Actions run without failing the deploy.
    if (process.env.GITHUB_ACTIONS) {
      console.log(`::warning::${fallbacks.length} Pasuram PDF(s) could not be fetched from Prapatti.com; served the bundled copy.`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
