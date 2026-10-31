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

## Owner-supplied scholarly sources: source-first editorial rule

Owner direction, 31 October 2026:

- The scholarly sources supplied or explicitly designated by the owner are sufficient authority. Do not require external corroboration, another interpretation or additional approval merely because the material is unfamiliar to the agent. Check our faithful use of the source; do not re-evaluate the scholar.
- Read the relevant explanation and surrounding material first. When our draft contains an untraceable quotation, attribution or interpretation, replace that draft addition with a sufficient, faithfully attributed explanation already in the supplied sources. Do not delay an otherwise explainable name or chapter to pursue the exact wording of a dispensable citation elsewhere.
- The owner authorizes this source-based editorial correction process: settle the English first, then synchronize affected translations. A fuller explanation may be drawn from the same supplied commentary. Do not invent doctrine, conflate different scholars' interpretations without attribution or present a paraphrase as a verbatim verse. Ordinary translation continues to follow the settled English without additions or omissions.
- Supplementary information is exceptional: only when an essential point cannot be understood or responsibly explained from the supplied material. Tell the owner the precise missing point and request the specific passage needed before seeking an alternative interpretation. Do not browse elsewhere for routine corroboration.
- Record the supplied source and correction, then close the concern when supported. Do not fabricate human reviews, theological approvals or waivers. This rule does not itself authorize merges, deployments, OTA updates or announcements.

