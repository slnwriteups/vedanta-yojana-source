# Traffic, geography, and install measurement

How this project answers two questions — *how many people install the
app* and *where in the world is the traffic coming from* — without
putting any tracking SDK, identifier, or cookie into the mobile app.

The short version: three independent, aggregate-only sources, none of
which can identify a person or a device.

| Question | Source | Geography? | Setup |
|---|---|---|---|
| Website page views | Cloudflare Web Analytics beacon (`app/layout.tsx`) | Country | [§2](#2-website-page-views) |
| Active app usage by country | Cloudflare Worker + Analytics Engine (`cloudflare/request-analytics/`) | Country | [§3](#3-app-usage-by-country) |
| APK downloads over time | Scheduled snapshot (`stats/apk-downloads.json`) | No | [§4](#4-apk-downloads-over-time) |
| Installs, uninstalls, active devices | Not available | — | See [§5](#5-no-app-store-statistics) |

## The constraint everything here is built around

`docs/privacy-policy.html` and the Privacy & data summary in `README.md`
both state publicly that the mobile app contains **no analytics or
usage-tracking services**. That claim stays true: nothing in this
document adds anything to the app. The Android and iOS builds contain no
analytics SDK, no beacon token, and no new network call.

What §3 measures is traffic the app **already generates** — its update
check and its Library catalog check, both of which have always been part
of the shipped app and are both described in the privacy policy. Counting
requests that already arrive, at the edge, without recording who made
them, is not the same thing as instrumenting the app, and the policy
wording distinguishes the two explicitly.

The website is a separate matter, and the privacy policy now says so: it
carries cookieless, aggregate page-view measurement (§2).

## 1. Prerequisite: proxy the DNS records

`vedantayojana.org` is registered with Cloudflare, but the records point
straight at GitHub Pages in **DNS-only** mode, which means no request
ever touches Cloudflare:

```
$ curl -sI https://vedantayojana.org/ | grep -i '^server\|^cf-ray'
server: GitHub.com          # no cf-ray -- not proxied
```

Section 3 does not work at all until this changes, and §2's automatic
setup option depends on it too.

1. Cloudflare dashboard → **DNS** → set the four apex `A` records
   (`185.199.108–111.153`), any `AAAA` records, and the `www` `CNAME` to
   **Proxied** (orange cloud).
2. **SSL/TLS** → **Full (strict)**. GitHub Pages already serves a valid
   certificate for the custom domain, so strict is correct today.
3. Leave GitHub's **Enforce HTTPS** setting on.

Verify with the same `curl`: a `cf-ray` header means it worked.

**The one caveat worth knowing in advance.** GitHub renews its Pages
certificate through an HTTP-01 challenge at
`/.well-known/acme-challenge/`, and proxying can interfere with that
renewal. If GitHub's certificate ever lapses, switch SSL/TLS to **Full**
(not strict) — visitors continue to see Cloudflare's own valid
certificate either way, so the failure mode is invisible to users and
reversible in one click.

## 2. Website page views

The Cloudflare Web Analytics beacon is rendered by `app/layout.tsx`,
guarded on `NEXT_PUBLIC_CF_BEACON_TOKEN`. When that variable is unset —
`next dev`, the test suite, any fork — no beacon tag is emitted at all.

To turn it on:

1. Cloudflare dashboard → **Web Analytics** → add `vedantayojana.org`.
   Choose the **manual / JS snippet** option and copy the site token.
2. In this repository: **Settings → Secrets and variables → Actions →
   Variables** → new repository variable `CF_BEACON_TOKEN`.
3. Push to `main`. `deploy-pages.yml` passes it into the build.

It is a repository *variable*, not a secret, deliberately: the token is
public by design — it is visible in the HTML of every page — and grants
nothing beyond reporting page views into this site's bucket. Storing it
as a secret would imply a confidentiality it does not have.

What it reports: page views, referrers, and a country breakdown. No
cookies, no client-side storage, no cross-site identifier.

## 3. App usage by country

`cloudflare/request-analytics/worker.js` sits on a route in front of the
two manifests the app fetches and writes one country-tagged data point
per request into Workers Analytics Engine:

- `/app-version.json` — fetched on every app launch
  (`mobile/services/updateCheckService.ts`)
- `/content-manifest.json` — fetched when the Library is opened
  (`mobile/services/libraryCatalogService.ts`)

Recorded per request: country, path, Cloudflare colo. Nothing else — no
IP, no User-Agent, no cookie, no identifier. The Worker passes every
request straight through to GitHub Pages and swallows any analytics
error, so a failure here can never suppress an update prompt.

Why Analytics Engine rather than the built-in traffic dashboard: free-plan
zone analytics is sampled and retained for days, which answers "where is
traffic from right now" but cannot produce a trend line. Analytics Engine
retains ~90 days and is queryable with SQL.

### Deploy

```
cd cloudflare/request-analytics
npx wrangler deploy
```

Routes and the dataset binding are declared in `wrangler.toml`. The routes
are scoped to exactly those two paths — not a `/*` catch-all — so the
Worker is never in the path of ordinary page views and the dataset cannot
quietly accumulate per-visitor browsing paths.

### Reading it back

Query via the SQL API
(`POST https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql`,
with an API token holding *Account Analytics: Read*):

```sql
-- App launches by country, last 7 days.
SELECT
  blob1 AS country,
  SUM(_sample_interval) AS requests
FROM vedanta_yojana_requests
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND blob2 = '/app-version.json'
GROUP BY country
ORDER BY requests DESC
```

```sql
-- Daily trend, all paths.
SELECT
  toDate(timestamp) AS day,
  blob2 AS path,
  SUM(_sample_interval) AS requests
FROM vedanta_yojana_requests
WHERE timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY day, path
ORDER BY day
```

**Always `SUM(_sample_interval)`, never `COUNT(*)`.** Analytics Engine
samples under load; counting rows undercounts by the sampling factor.

### What this can and cannot tell you

It counts **launches, not unique devices**. Telling one device from
another requires storing an identifier, which is exactly what this
project has committed not to do. Launches per day per country is a
proportional signal for active installs — a trend and a geographic
distribution, not a headcount. For an actual install count, see §5.

The app does not send its version, so per-version retention curves are
not available from this source. Adding one would be an app change and a
deliberate step toward telemetry; it has not been taken.

## 4. APK downloads over time

`.github/workflows/apk-download-stats.yml` runs
`scripts/record-apk-downloads.ts` daily and appends a snapshot to
`stats/apk-downloads.json`.

This exists because GitHub's releases API reports `download_count` as a
**running total with no history**. "How many downloads so far" is always
answerable; "how many last week" is answerable only if someone wrote the
number down each day.

- Counts `.apk` assets only — the `.sha256` checksum file that ships with
  each release is recorded per asset but excluded from the headline
  total, since verifying a download is not a second download.
- Re-running on the same date replaces that day's entry rather than
  duplicating it, so retries and manual `workflow_dispatch` runs are safe.
- The daily commit carries `[skip ci]`, which keeps it from triggering a
  full site redeploy every day.
- `stats/apk-downloads.json` is repository data, not part of the
  published site. Moving it under `public/` would publish it — a
  deliberate choice not yet made.

No geography is available from this source; GitHub does not expose it.

## 5. No app-store statistics

The Android app is distributed only through GitHub and is not listed on
Google Play or any other app store (decision recorded 2026-09-24), so
there is no store console reporting installs, uninstalls, or active
devices. §3 (app usage by country) and §4 (APK downloads over time) are
the project's sources for Android usage.
