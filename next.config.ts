import type { NextConfig } from "next";

/**
 * The sub-path the site is served under, supplied by the deployment
 * rather than hardcoded. Empty ("") on every current target -- GitHub
 * Pages serves from the vedantayojana.org custom domain root
 * (public/CNAME, set in .github/workflows/deploy-pages.yml), and so do
 * Vercel (kept as a fallback) and local `next dev`.
 *
 * Kept as an env-driven variable rather than deleted outright: a stray
 * basePath on a root-served deployment 404s the entire site, so this
 * stays available as an escape hatch for a future project-page-style
 * deployment without code changes -- see the prior custom-domain
 * migration, which only touched the workflow's env vars and added a
 * CNAME file.
 *
 * `next/link` and `next/router` apply this prefix automatically; raw
 * `<img src>` and `fetch()` URLs do NOT, which is why it is read again
 * at runtime by components/shared/RecordImages.tsx (via
 * lib/image-file.ts), components/search/SearchClient.tsx and
 * lib/site.ts. NEXT_PUBLIC_ vars are inlined into the bundle at build
 * time, so those reads see the same value this one does.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Next.js 16 auto-writes AI-agent rule files into the repo root on every
  // `next dev`/`next build`. Disabled: an unrequested, repeatedly
  // self-regenerating file outside this phase's (or any phase's) scope.
  agentRules: false,

  // Fully static HTML/CSS/JS into out/ -- GitHub Pages serves files only,
  // with no Node.js runtime available for SSR or route handlers.
  output: "export",

  // Omitted entirely when empty: Next.js rejects basePath: "".
  ...(BASE_PATH ? { basePath: BASE_PATH } : {}),

  // Emits out/about/index.html rather than out/about.html. GitHub Pages
  // resolves directory URLs to index.html reliably; extensionless files
  // are the case that produces surprise 404s.
  trailingSlash: true,

};

export default nextConfig;
