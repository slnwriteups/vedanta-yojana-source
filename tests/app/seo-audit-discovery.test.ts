import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("audit catches missing directory anchors and content hidden only in scripts", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vy-seo-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const origin = "https://example.test";
  const paths = ["/divya-desams/", "/divya-desams/sri-rangam/", ...Array.from({length: 98}, (_, i) => `/book-${i}/`)];
  const writePage = (url: string, body: string) => {
    const folder = path.join(dir, url);
    fs.mkdirSync(folder, {recursive: true});
    fs.writeFileSync(path.join(folder, "index.html"), `<html><head><title>${url}</title><link rel="canonical" href="${origin}${url}"></head><body><main><h1>Guide</h1>${body}</main></body></html>`);
  };
  fs.writeFileSync(path.join(dir, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml`);
  fs.writeFileSync(path.join(dir, "sitemap.xml"), `<urlset>${paths.map(p => `<url><loc>${origin}${p}</loc></url>`).join("")}</urlset>`);
  for (const p of paths) writePage(p, "Temple history and travel information. ".repeat(15));
  writePage(paths[0], '<a href="/divya-desams/sri-rangam/">Srirangam</a>');
  const audit = () => spawnSync(process.execPath, ["scripts/seo-audit.ts", "--dir", dir], {encoding: "utf8"});
  assert.equal(audit().status, 0);
  writePage(paths[0], '<button>Srirangam</button><script>"<a href=\\"/divya-desams/sri-rangam/\\">Srirangam</a>"</script>');
  let result = audit();
  assert.equal(result.status, 1);
  assert.match(result.stdout, /temple discovery/);
  writePage(paths[0], '<a href="/divya-desams/sri-rangam/">Srirangam</a>');
  writePage(paths[1], `<script>${"story".repeat(500)}</script>`);
  result = audit();
  assert.equal(result.status, 1);
  assert.match(result.stdout, /rendered content/);
});
