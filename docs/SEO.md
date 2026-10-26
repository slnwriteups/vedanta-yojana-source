# Search & discoverability

How vedantayojana.org gets into Google (and other search engines), what
the code already does, and the few steps only the site owner can take.

## What the site does on its own

Every deploy (`.github/workflows/deploy-pages.yml`) publishes:

| Piece | Where | Purpose |
|---|---|---|
| `robots.txt` | `app/robots.ts` → `lib/robots.ts` | Allows all crawling, points at the sitemap |
| `sitemap.xml` | `app/sitemap.ts` → `lib/sitemap.ts` | Every public page, in the exact trailing-slash form each is served at, so no entry redirects |
| Canonical URLs | every page's metadata | One URL per page; `www.` and `http://` already 301 to `https://vedantayojana.org/` |
| Titles & descriptions | `lib/metadata.ts` `pageMetadata()` | Descriptions are real page text, never invented |
| Link previews | Open Graph + Twitter tags, `public/og-image.png` | Proper cards when a link is shared on WhatsApp, X, Facebook, Telegram and Slack; temple pages use the temple's own photo |
| Structured data | JSON-LD on each page | `WebSite` + `Organization` (home), `HinduTemple` (each Divya Desam), `Book`/`Chapter`/`Blog`/`BlogPosting` (library), `BreadcrumbList` (every page with breadcrumbs) |
| IndexNow ping | last step of the deploy job | Tells Bing, DuckDuckGo, Yahoo, Yandex, Naver and Seznam to recrawl the sitemap right after each deploy |

Low-value pages are kept out of the index on purpose: `/settings/` and the
404 page are `noindex`.

## The SEO bot

`scripts/seo-audit.ts` re-checks everything above, so nobody has to:

- **Every push (`ci.yml`):** audits the built site. CI fails if anything
  would stop pages being indexed: a sitemap URL that redirects or doesn't
  match its canonical, a page in the sitemap marked `noindex`, broken
  structured data, a missing title or canonical, or a page over 1.5 MB of
  HTML. A bad change can't deploy unnoticed.
- **After every deploy and every Monday (`seo-health.yml`):** audits the
  live site, including real redirects and the `www.`/`http://` addresses.
  If anything fails, it opens a GitHub issue labelled `seo-health`, and
  GitHub emails you. It keeps that one issue updated and closes it by itself
  once the site passes again. **No open `seo-health` issue means all is
  well.**

Every check of the live site on `main` is also recorded in
`stats/seo-health.json` (pages checked, errors and warnings per check), the
history the private analytics dashboard charts.

Warnings (long titles, pages without a description or share image) appear
in each run's summary but never fail a build or open an issue.

Run it yourself at any time: `node scripts/seo-audit.ts --url
https://vedantayojana.org`, or `--dir out` after `npm run build`.

## One-time setup (owner only)

Google gets no automatic signal like IndexNow. It needs Search Console.

### 1. Verify the site in Google Search Console

1. Go to <https://search.google.com/search-console> and add a property.
2. Pick one method:
   - **Domain property (recommended):** add the TXT record Google shows you
     at your DNS provider for `vedantayojana.org`. This covers `www.`,
     `http://` and every subdomain, and nothing in this repository has to change.
   - **URL-prefix property, HTML tag method:** copy only the `content="…"`
     value from the tag Google shows you. Then, in GitHub, go to **Settings →
     Secrets and variables → Actions → Variables** and add a repository
     variable named `GOOGLE_SITE_VERIFICATION` with that value. Re-run
     **Deploy to GitHub Pages** and click **Verify**.
3. Under **Sitemaps**, submit `https://vedantayojana.org/sitemap.xml`.
4. Use **URL inspection** on the home page and a few key pages, such as
   `/divya-desams/` and `/divya-desams/sri-rangam/`, and click **Request
   indexing**. You don't need to do this for every page; the sitemap covers
   the rest.

### 2. Bing Webmaster Tools

At <https://www.bing.com/webmasters>, choose **Import from Google Search
Console**. That takes a single click once step 1 is done. You can also use the
meta-tag method: add its value as a repository variable named
`BING_SITE_VERIFICATION`. Bing powers DuckDuckGo, Yahoo and ChatGPT/Copilot
search results as well.

## What to watch

Check Search Console once a week for the first month, then about once a month:

- **Pages → Why pages aren't indexed.** "Discovered – currently not
  indexed" is normal for a new site and shrinks as Google gains trust. If you
  see "Page with redirect" or "Alternate page with proper canonical" for
  sitemap URLs, something has regressed.
- **Performance.** This shows which searches bring people in. If a page shows
  up a lot but rarely gets clicked, its title or description should be more specific.
- **Enhancements.** Breadcrumb structured data is reported here.
  `BlogPosting` items may warn about missing `author`/`datePublished`. That is
  expected: those fields are left out on purpose rather than invented, and the
  warning doesn't stop the pages from being indexed.

Cloudflare Web Analytics (see `ANALYTICS.md`) shows the visits that result.

## Growing traffic

Search ranking mostly comes from things outside the code:

1. **Links from places that already have readers.** Link each old Blogspot
   post to its new home under `/library/`, and put the site URL in the
   Instagram bio, the YouTube/WhatsApp channel descriptions, and the GitHub
   repositories' "Website" field. Each one is a signal Google trusts.
2. **Publish steadily.** New blog posts and newly translated chapters give
   Google a reason to come back. A regular rhythm, even one post a week,
   works better than occasional bursts.
3. **Match how people search.** People type things like "Srirangam temple
   history" and "108 Divya Desam list". Wherever it reads naturally, use those
   plain spellings in a page's opening paragraph alongside the diacritic forms
   (Sri Raṅgam).
4. **Share pages, not just the home page.** Each temple and chapter now has
   its own preview card, so a direct link spreads better than the home page.
5. **Remove first-visit barriers for people arriving from search.** Someone
   who lands on a temple page from Google first sees the full-screen welcome
   screen and then onboarding. Google counts full-screen interstitials against
   mobile results, and visitors tend to leave. Consider showing those screens
   only to people who arrive at the home page.
