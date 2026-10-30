# Working on Vedanta Yojana

## What's New announcements: ask the owner first

`content/announcements.json` is the "What's New" list shown on the website
home page, `/whats-new/`, and in the app (home card and its What's New
screen). Readers see it, so it holds only changes they would notice: new
books, posts or translations, new features, new app releases. Fixes,
refactors, performance and SEO work, tests, CI and other behind-the-scenes
changes never go in it.

After making any change in this repository:

1. Decide whether a reader would notice it.
2. If they would, **ask the owner before adding an announcement**. Show
   the exact title and body you propose, and add it only once they approve,
   using their wording if they change it. If they would not notice it, don't
   ask and don't add one.
3. Never add, edit or remove an announcement without the owner's approval.

Entry format (see `content-lib/announcements.ts`; `npm run test:content`
validates it):

```json
{
  "id": "2026-10-18-blogs-in-the-library",
  "date": "2026-10-18",
  "platforms": ["app", "website"],
  "title": "Short, plain headline",
  "body": "One or two sentences, written for readers rather than developers.",
  "link": { "href": "/library", "label": "Open the Library" }
}
```

- `date` is the day readers get the change: the deploy date for the website,
  or the release/OTA date for the app.
- `platforms` lists where it applies: `"app"`, `"website"` or both.
- `appPlatforms` is optional: `["android"]` or `["ios"]` limits an `"app"`
  entry to that app (for example, an APK to install). The app hides it on
  the other platform; the website still lists it, tagged Android or iOS.
  Never put `"android"` or `"ios"` in `platforms` itself: older installed
  apps would reject the whole list.
- `link` is optional. Use a site path (the same routes exist in the app) or a
  full `https://` URL.
- `translations` (`ta`/`kn`/`hi`/`te`, with any of `title`, `body`,
  `linkLabel`) is optional. Untranslated fields fall back to English.

The website picks up a new entry on its next deploy. Installed apps fetch
`https://vedantayojana.org/announcements.json` on launch, so they see it
from that same deploy, with no app update.

## Translations and transliterations

Before translating or transliterating anything into Tamil, Kannada, Hindi or
Telugu (books, chapters, Divya Desams, announcements, interface strings),
read `docs/TRANSLATION-GUIDE.md` and follow it, together with that
language's glossary in `docs/translation-glossaries/`. To translate a whole
book, use the scripted workflow in `docs/TRANSLATION-WORKFLOW.md`.
