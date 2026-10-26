import fs from "node:fs";
import path from "node:path";

/**
 * SEO health check -- the "bot" half of docs/SEO.md. Re-checks the things
 * that decide whether search engines can find and index the site, so a
 * regression is caught by a machine rather than noticed months later as
 * a traffic drop.
 *
 * Two modes, same checks:
 *
 *   node scripts/seo-audit.ts --dir out
 *     Audits a built static export. Run by ci.yml on every push, so a
 *     change that would break indexing fails CI before it can deploy.
 *
 *   node scripts/seo-audit.ts --url https://vedantayojana.org
 *     Audits the live site over HTTP, including redirects and the
 *     www/http variants. Run by seo-health.yml weekly and after every
 *     deploy; that workflow turns a failure into a GitHub issue.
 *
 * `--report <file>` also writes the findings as Markdown (used for the
 * issue body and the job summary). Exits 1 when any ERROR is found;
 * WARNINGs are reported but never fail the run.
 *
 * Standard library only, no network access in --dir mode.
 */

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

/** HTML weight per page. The Home page was once 16 MB; these stop that recurring. */
const PAGE_BYTES_ERROR = 1_500_000;
const PAGE_BYTES_WARN = 750_000;
const TITLE_WARN_LENGTH = 90;
const DESCRIPTION_WARN_LENGTH = 200;
/** A sitemap that suddenly shrinks this much usually means a content loader broke. */
const MIN_SITEMAP_URLS = 100;
const LIVE_CONCURRENCY = 8;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const DIR = arg("dir");
const URL_BASE = arg("url")?.replace(/\/+$/, "");
const REPORT = arg("report");

if (!DIR === !URL_BASE) {
  console.error("Usage: node scripts/seo-audit.ts (--dir <out> | --url <https://origin>) [--report <file.md>]");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

type Level = "ERROR" | "WARNING";
interface Finding {
  level: Level;
  check: string;
  where: string;
  detail: string;
}
const findings: Finding[] = [];
function report(level: Level, check: string, where: string, detail: string) {
  findings.push({ level, check, where, detail });
}

// ---------------------------------------------------------------------------
// Fetching: one interface over the built directory and the live site
// ---------------------------------------------------------------------------

interface Fetched {
  status: number;
  location?: string;
  body: string;
  bytes: number;
}

/** Maps a sitemap <loc> (absolute or root-relative) to its path on the site. */
function pathOf(loc: string): string {
  return /^https?:\/\//.test(loc) ? new URL(loc).pathname : loc;
}

const NOT_FOUND: Fetched = { status: 404, body: "", bytes: 0 };

/**
 * Sitemap URLs come from a file this script downloaded or read, so they are
 * confined before use: in --dir mode to files inside the built directory
 * (no "../" escapes), live to the audited origin (never another host).
 */
async function get(sitePath: string): Promise<Fetched> {
  if (DIR) {
    const root = path.resolve(DIR);
    let decoded: string;
    try {
      decoded = decodeURIComponent(sitePath);
    } catch {
      return NOT_FOUND;
    }
    let file = path.resolve(root, `.${decoded}`);
    if (sitePath.endsWith("/")) file = path.join(file, "index.html");
    if (file !== root && !file.startsWith(root + path.sep)) return NOT_FOUND;
    if (!fs.existsSync(file)) return NOT_FOUND;
    const data = fs.readFileSync(file);
    return { status: 200, body: data.toString("utf8"), bytes: data.length };
  }
  const target = new URL(sitePath, `${URL_BASE}/`);
  if (target.origin !== new URL(URL_BASE!).origin) return NOT_FOUND;
  // redirect: "manual" -- a redirect IS the finding for a sitemap URL.
  const response = await fetch(target, {
    redirect: "manual",
    headers: { "User-Agent": "vedanta-yojana-seo-audit (+https://github.com/slnwriteups/vedanta-yojana-source)" },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    location: response.headers.get("location") ?? undefined,
    body: buffer.toString("utf8"),
    bytes: buffer.length,
  };
}

// ---------------------------------------------------------------------------
// HTML helpers -- a handful of regexes over Next.js's own predictable output
// ---------------------------------------------------------------------------

function decodeEntities(text: string): string {
  return text
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function head(html: string): string {
  const end = html.indexOf("</head>");
  return end === -1 ? html : html.slice(0, end);
}

function metaContent(html: string, attr: "name" | "property", key: string): string | undefined {
  const tag = html.match(new RegExp(`<meta[^>]*${attr}="${key}"[^>]*>`, "i"))?.[0];
  const content = tag?.match(/content="([^"]*)"/)?.[1];
  return content === undefined ? undefined : decodeEntities(content);
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function checkRobots(): Promise<void> {
  const robots = await get("/robots.txt");
  if (robots.status !== 200) {
    report("ERROR", "robots.txt", "/robots.txt", `HTTP ${robots.status}`);
    return;
  }
  if (/^\s*disallow:\s*\/\s*$/im.test(robots.body)) {
    report("ERROR", "robots.txt", "/robots.txt", "Disallows the whole site");
  }
  const sitemapLine = robots.body.match(/^\s*sitemap:\s*(\S+)/im)?.[1];
  if (URL_BASE && sitemapLine !== `${URL_BASE}/sitemap.xml`) {
    report("ERROR", "robots.txt", "/robots.txt", `Sitemap line is ${sitemapLine ?? "missing"}, expected ${URL_BASE}/sitemap.xml`);
  }
}

async function loadSitemap(): Promise<string[]> {
  const sitemap = await get("/sitemap.xml");
  if (sitemap.status !== 200) {
    report("ERROR", "sitemap", "/sitemap.xml", `HTTP ${sitemap.status}`);
    return [];
  }
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeEntities(m[1].trim()));
  if (locs.length < MIN_SITEMAP_URLS) {
    report("ERROR", "sitemap", "/sitemap.xml", `Only ${locs.length} URLs (expected at least ${MIN_SITEMAP_URLS})`);
  }
  for (const loc of locs) {
    if (URL_BASE && !loc.startsWith(`${URL_BASE}/`)) {
      report("ERROR", "sitemap", loc, `Not on ${URL_BASE}`);
    }
    if (!loc.endsWith("/")) {
      report("ERROR", "sitemap", loc, "No trailing slash -- this URL redirects (trailingSlash: true)");
    }
  }
  const duplicates = locs.filter((loc, i) => locs.indexOf(loc) !== i);
  for (const loc of new Set(duplicates)) report("WARNING", "sitemap", loc, "Listed more than once");
  return locs;
}

const titles = new Map<string, string[]>();

async function checkPage(loc: string): Promise<void> {
  const sitePath = pathOf(loc);
  let page: Fetched;
  try {
    page = await get(sitePath);
  } catch (error) {
    report("ERROR", "reachable", loc, `Request failed: ${(error as Error).message}`);
    return;
  }
  if (page.status >= 300 && page.status < 400) {
    report("ERROR", "reachable", loc, `Redirects (HTTP ${page.status}) to ${page.location ?? "?"} -- the sitemap should list the final URL`);
    return;
  }
  if (page.status !== 200) {
    report("ERROR", "reachable", loc, `HTTP ${page.status}`);
    return;
  }

  const html = page.body;
  const h = head(html);

  if (page.bytes > PAGE_BYTES_ERROR) {
    report("ERROR", "page weight", loc, `${(page.bytes / 1e6).toFixed(1)} MB of HTML (limit ${(PAGE_BYTES_ERROR / 1e6).toFixed(1)} MB) -- slow pages rank lower`);
  } else if (page.bytes > PAGE_BYTES_WARN) {
    report("WARNING", "page weight", loc, `${(page.bytes / 1e6).toFixed(2)} MB of HTML`);
  }

  const title = decodeEntities(h.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").trim();
  if (!title) report("ERROR", "title", loc, "Missing <title>");
  else {
    if (title.length > TITLE_WARN_LENGTH) report("WARNING", "title", loc, `${title.length} characters -- search results cut it off`);
    titles.set(title, [...(titles.get(title) ?? []), loc]);
  }

  const description = metaContent(h, "name", "description");
  if (!description) report("WARNING", "description", loc, "No meta description");
  else if (description.length > DESCRIPTION_WARN_LENGTH) report("WARNING", "description", loc, `${description.length} characters`);

  const canonical = h.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (!canonical) report("ERROR", "canonical", loc, "No canonical link");
  else if (decodeEntities(canonical) !== loc) report("ERROR", "canonical", loc, `Canonical is ${canonical} -- must match the sitemap URL`);

  const robots = metaContent(h, "name", "robots") ?? "";
  if (/noindex/i.test(robots)) report("ERROR", "indexable", loc, `In the sitemap but marked "${robots}"`);

  if (!metaContent(h, "property", "og:image")) report("WARNING", "link preview", loc, "No og:image");

  // Case-insensitive, and the closing tag may carry spaces or attributes.
  for (const match of html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script[^>]*>/gi)) {
    try {
      JSON.parse(match[1]);
    } catch {
      report("ERROR", "structured data", loc, "JSON-LD block does not parse");
    }
  }

  if (!/<h1[\s>]/.test(html)) report("WARNING", "headings", loc, "No <h1>");
}

/** Live only: every other way of typing the address must land on the one canonical origin. */
async function checkHostRedirects(): Promise<void> {
  if (!URL_BASE) return;
  const canonical = new URL(URL_BASE);
  const variants = [`http://${canonical.host}/`];
  if (!canonical.host.startsWith("www.")) variants.push(`https://www.${canonical.host}/`);
  for (const variant of variants) {
    try {
      const response = await fetch(variant, { redirect: "manual" });
      const location = response.headers.get("location") ?? "";
      if (response.status !== 301 && response.status !== 308) {
        report("ERROR", "host redirect", variant, `HTTP ${response.status} -- expected a permanent redirect to ${URL_BASE}/`);
      } else if (!location.startsWith(`${URL_BASE}/`)) {
        report("ERROR", "host redirect", variant, `Redirects to ${location}, expected ${URL_BASE}/`);
      }
    } catch (error) {
      report("WARNING", "host redirect", variant, `Request failed: ${(error as Error).message}`);
    }
  }
}

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(run));
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

await checkRobots();
const locs = await loadSitemap();
await inBatches(locs, DIR ? 64 : LIVE_CONCURRENCY, checkPage);
await checkHostRedirects();
for (const [title, pages] of titles) {
  if (pages.length > 1) report("WARNING", "duplicate title", pages.join(", "), `"${title}" is used by ${pages.length} pages`);
}

const errors = findings.filter((f) => f.level === "ERROR");
const warnings = findings.filter((f) => f.level === "WARNING");
const target = DIR ? `built site in ${DIR}/` : URL_BASE!;
const summary = `${locs.length} pages checked on ${target}: ${errors.length} error(s), ${warnings.length} warning(s).`;

for (const f of findings) console.log(`${f.level}  [${f.check}] ${f.where} -- ${f.detail}`);
console.log(summary);

if (REPORT) {
  // Capped: a GitHub issue body is limited to 65,536 characters, and one
  // systemic fault (say, every sitemap URL) repeats hundreds of times.
  const MAX_ROWS = 60;
  // Cell text comes from the audited pages (titles, URLs): escape the
  // backslash first, then the pipe that would end the table cell.
  const cell = (text: string) => text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const table = (rows: Finding[]) =>
    [
      "| Check | Where | Detail |",
      "|---|---|---|",
      ...rows.slice(0, MAX_ROWS).map((f) => `| ${cell(f.check)} | ${cell(f.where)} | ${cell(f.detail)} |`),
      ...(rows.length > MAX_ROWS ? [`| … | ${rows.length - MAX_ROWS} more | see the workflow log for the full list |`] : []),
    ].join("\n");
  const sections = [`**${summary}**`];
  if (errors.length) sections.push(`### Errors -- these can stop pages being indexed\n\n${table(errors)}`);
  if (warnings.length) sections.push(`<details><summary>Warnings (${warnings.length})</summary>\n\n${table(warnings)}\n\n</details>`);
  fs.writeFileSync(REPORT, `${sections.join("\n\n")}\n`);
}

process.exit(errors.length > 0 ? 1 : 0);
