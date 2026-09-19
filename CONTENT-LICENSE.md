# Content Licensing

This repository contains two very different kinds of material, licensed
differently. Reading the [LICENSE](LICENSE) file alone is not enough to
know what you're allowed to do with everything in this repository —
read this document too.

## Software

The application source code — the Next.js website, the Expo mobile
app, `content-lib/`, build scripts, tests, and configuration — is
licensed under the **MIT License** (see [LICENSE](LICENSE)). You may
use, modify, and redistribute the *software* under those terms.

This covers, for example: `app/`, `components/`, `lib/`, `mobile/`,
`content-lib/`, `scripts/`, `tests/`, and the schemas and loaders that
define how content is structured and rendered.

## Original Content — All Rights Reserved

The MIT License covers the software. It does **not** extend to the
original creative and devotional works that software renders. Unless a
specific file explicitly states otherwise, the following remain the
copyrighted property of Vishnu Sreenivas, all rights reserved:

- The four published books and their chapters (*A Brief Insight to
  Visishtadvaita Philosophy*, *Sri Rama Charithram*, *Srimad Bhagavata
  Kathasagaram*, *JAYA: A Journey of the Mahabharata*) and any future
  books added to the Library
- The Divya Desam temple write-ups and their Tamil/Kannada/Hindi
  translations (`content/divya-desams/`)
- The Knowledge section content (`content/knowledge/`)
- The personal narrative in [README.md](README.md#the-journey)
- Original manuscripts and source drafts (`source-material/Books/`)
- Book cover artwork (`public/book-covers/`)

The MIT License granting permission to use the *code* does not grant
permission to reproduce, redistribute, or create derivative works from
these books, translations, or writings. Using the open-source software
to build a *different* application does not carry a license to *this
application's original content* along with it.

## Third-Party Material

Some material in this repository was not created by the author and
remains subject to its own original license or copyright, not MIT and
not "all rights reserved" by the author:

- **`nodered.min.js`** (repository root) bundles IBM's JSONata project
  (© IBM Corp., under its own open-source license) as part of the
  legacy application export described below. Not authored by this
  project.
- **Font files inside the legacy export**
  (`_next/static/chunks/fonts/*.ttf` — Ionicons, MaterialCommunityIcons,
  FontAwesome, Google Fonts such as Montserrat/Poppins/Lato/Open Sans,
  and others) are third-party fonts/icon sets, each under their own
  license (typically the SIL Open Font License). Not authored by this
  project.
- **`_next/`, `page.Page*.html`, `m-page.Page*.html`, `index.html`,
  `404.html`** are the compiled output of a retired third-party no-code
  platform (SAP Build Apps / AppGyver) that hosted an earlier version
  of this application. The framework code within them is third-party;
  the application configuration and content it renders is the author's
  own. Kept for historical/provenance reasons — see
  `content-extraction/README.md`.

This project does not claim ownership of the above, and does not
relicense it under MIT.

## Flagged: Unclear Provenance

The following material's ownership could not be conclusively
established from repository metadata alone during the September 2026
licensing audit, and is **not** assigned a license here. It should not
be treated as either MIT-licensed or as content the author can freely
grant others rights to, until its origin is confirmed:

- **`source-material/108-divyadesam-2nd-edition.pdf`** and
  **`source-material/Books/108 Divyadesam 2nd Edition.pdf`** — a
  reference book titled distinctly from any of the author's own four
  published books. Its authorship and copyright holder are not stated
  anywhere in this repository.
- **At least 10 of the 194 Divya Desam images** in
  `content/divya-desams/*.json` carry an asset ID containing `-book-`
  (for example `tiruayodhi-ayodhya-book-1`, `tiruvenkatam-book-5`),
  indicating they were extracted from a physical book scan rather than
  photographed or created by the author. Given the file above, these
  most likely originate from that same third-party reference book. The
  provenance of the remaining ~184 Divya Desam images was not
  independently verifiable from repository metadata during this audit.

## Summary

| Material | License |
|---|---|
| Application source code | MIT ([LICENSE](LICENSE)) |
| Books, translations, Divya Desam write-ups, the README story | All Rights Reserved (Vishnu Sreenivas) |
| Bundled third-party code/fonts (legacy export, `nodered.min.js`) | Their own original licenses |
| The reference PDF and ~10 book-sourced Divya Desam images | Unclear — not licensed here; do not assume permission |

If you are unsure whether something in this repository is covered by
the MIT License, assume it is not unless it is source code, and ask.
