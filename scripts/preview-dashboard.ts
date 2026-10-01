import http from "node:http";
import { PAGE, loadData } from "../cloudflare/analytics-dashboard/worker.js";

/**
 * Serves the analytics dashboard locally, against the real data.
 *
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... node scripts/preview-dashboard.ts [port]
 *
 * Why this exists: the dashboard page is a string inside a Cloudflare Worker
 * behind a password, so the ordinary way to see a presentation change is to
 * deploy and look. That is a slow loop for what is a layout question, and it
 * puts an unreviewed page in front of the real URL to find out whether it
 * renders.
 *
 * It serves the EXACT page the Worker serves and calls the Worker's own
 * loadData(), so what appears here is what the deployed dashboard would show,
 * not a reimplementation that could drift from it.
 *
 * It invents nothing. Download history comes from the committed snapshots the
 * daily workflow writes; everything else comes from the same Analytics Engine
 * queries the Worker runs, using CF_ACCOUNT_ID and CF_API_TOKEN from the
 * environment. Without those two the page shows the Worker's own "not
 * connected" message -- which is the truth -- rather than substituting
 * plausible-looking numbers. A screenshot of this is a screenshot of the real
 * thing or of an honest error, never of fiction.
 */

const PORT = Number(process.argv[2]) || 8787;

const env = {
  CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID,
  CF_API_TOKEN: process.env.CF_API_TOKEN,
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (url.pathname === "/data") {
    const days = Number(url.searchParams.get("days")) || 30;
    // The Worker's own loader, unmodified: same SQL, same shape, same error
    // handling. It returns { error } when the credentials are missing, and
    // the page renders that error.
    const data = await loadData(env, days);
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(data));
    return;
  }

  if (url.pathname === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(PAGE);
    return;
  }

  response.writeHead(404).end("Not found");
});

server.listen(PORT, () => {
  console.log(`Dashboard preview on http://localhost:${PORT}/`);
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    console.log(
      "CF_ACCOUNT_ID and CF_API_TOKEN are not set, so the website and app figures will\n" +
        "report as not connected. Download history still comes from the committed\n" +
        "snapshots. No figures are invented either way.",
    );
  }
});
