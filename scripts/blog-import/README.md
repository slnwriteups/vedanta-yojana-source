# Blog importer (WordPress + Wix → `blog-archive/`)

Pulls every old blog post into the repo in one go, so they can be moved
into the app gradually. Nothing here touches `content/` or the app: the
archive is a staging area, the same way `content-extraction/` was for the
SAP export.

## 1. Get the inputs

**WordPress** — one export file holds every post (published, drafts,
scheduled, private):

- Self-hosted / WordPress.com: *Admin → Tools → Export → All content →
  Download Export File*. WordPress.com emails a `.zip`; unzip it (large
  sites are split into several `.xml` files — pass the folder).
- If the WordPress site is gone but you still have the account, the same
  export is under *wordpress.com → Settings → Export*.

**Wix** — Wix has no "export all" button, so the importer reads the
site's automatically generated blog sitemap (lists every published post)
plus its RSS feed, then fetches each post page. All you need is the site
address. Drafts that were never published on Wix can't be reached this
way — publish them first, or copy them by hand.

If the site blocks automated requests, open each post in a browser and
*Save Page As → Webpage, HTML only* into one folder, then use
`--wix-html-dir` instead.

## 2. Run it

```
npm run import:blogs -- --wordpress ~/Downloads/wordpress-export.xml
npm run import:blogs -- --wix-site https://www.example.com
npm run import:blogs -- --wix-html-dir ~/Downloads/wix-posts      # offline alternative
```

Flags: `--include-pages` (also WordPress static pages), `--no-images`
(keep images remote), `--delay <ms>` (pause between Wix requests),
`--out <dir>`, `--reindex`.

Re-running is safe: posts are matched to their existing folders, files
are refreshed, already-downloaded images are kept, and your migration
progress (below) is preserved.

## 3. What you get

```
blog-archive/
├── INDEX.md            checklist of every post, oldest first
├── index.json          the same, machine-readable
├── wordpress/2019-05-01-some-post/
│   ├── post.md         readable Markdown (front matter + body, local image links)
│   ├── original.html   the body exactly as the platform stored it — never edited
│   ├── post.json       metadata: dates, categories, tags, source URL, images, migration status
│   └── images/         downloaded images, full size where the platform allows
└── wix/2021-03-04-some-post/ ...
```

A post that exists on both platforms (moved from WordPress to Wix) is
flagged in `INDEX.md` / `index.json` as `possibleDuplicates`, matched by
title.

## 4. Moving posts into the app, a few at a time

Each `post.json` has a `migration` block:

```json
"migration": { "status": "archived", "notes": "" }
```

Change `status` as you go — `archived` → `in-review` → `migrated` (or
`skipped` for posts you don't want to bring over) — add a note if useful,
then `npm run import:blogs -- --reindex` to refresh the checklist.

The app does not yet have a section for blog posts (`content/knowledge/`
is currently tied to the original SAP migration and its tests), so the
step that turns an archived post into an app record is deliberately left
for when that section is designed.
