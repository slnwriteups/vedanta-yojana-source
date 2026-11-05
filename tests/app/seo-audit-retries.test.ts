import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { spawn } from "node:child_process";

// The live SEO health check (seo-health.yml) audits ~540 pages on GitHub
// Pages, which now and then answers one of them with a 503 or drops the
// connection. A single attempt turned those blips into "site is failing"
// issues; the audit now retries transient failures and reports only a
// page that keeps failing.

function runAudit(origin: string): Promise<{ status: number | null; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/seo-audit.ts", "--url", origin], {
      env: { ...process.env, SEO_AUDIT_RETRY_DELAYS_MS: "10,10,10" },
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stdout += chunk));
    child.on("close", (status) => resolve({ status, stdout }));
  });
}

test("live audit retries transient 503s and dropped connections, and still reports a page that keeps failing", async (t) => {
  const paths = Array.from({ length: 120 }, (_, i) => `/page-${i}/`);
  const failuresLeft = new Map<string, number>([
    ["/page-3/", 2], // 503 twice, then fine
    ["/page-7/", 1], // connection dropped once, then fine
  ]);
  const alwaysFailing = "/page-11/";
  let origin = "";

  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/robots.txt") {
      res.end(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml`);
      return;
    }
    if (url === "/sitemap.xml") {
      res.end(`<urlset>${paths.map((p) => `<url><loc>${origin}${p}</loc></url>`).join("")}</urlset>`);
      return;
    }
    if (url === alwaysFailing) {
      res.statusCode = 503;
      res.end("unavailable");
      return;
    }
    const left = failuresLeft.get(url) ?? 0;
    if (left > 0) {
      failuresLeft.set(url, left - 1);
      if (url === "/page-7/") {
        req.socket.destroy();
        return;
      }
      res.statusCode = 503;
      res.end("unavailable");
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<html><head><title>${url}</title><meta name="description" content="A page about ${url}."><link rel="canonical" href="${origin}${url}"></head>` +
        `<body><main><h1>Guide</h1>${"Temple history and travel information. ".repeat(15)}</main></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const result = await runAudit(origin);

  assert.equal(failuresLeft.get("/page-3/"), 0, "the 503 page was asked again");
  assert.equal(failuresLeft.get("/page-7/"), 0, "the dropped page was asked again");
  const errorLines = result.stdout.split("\n").filter((line) => line.startsWith("ERROR"));
  assert.ok(!errorLines.some((line) => line.includes("/page-3/")), result.stdout);
  assert.ok(!errorLines.some((line) => line.includes("/page-7/")), result.stdout);
  assert.ok(errorLines.some((line) => line.includes(alwaysFailing) && line.includes("HTTP 503")), result.stdout);
  assert.equal(result.status, 1);
});
