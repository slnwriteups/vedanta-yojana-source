# /content

The application's content layer: Git-tracked JSON records that the website
and the app read (`content-lib/`).

- `divya-desams/`: one record per Divya Desam (107 records).
- `library/<book>/`: `book.json` (title, description, parts, `chapterOrder`)
  and `chapters/<slug>.json`, one per chapter or blog post.
- `knowledge/`: standalone Knowledge records.
- `announcements.json`: the "What's New" list (owner-approved entries only;
  see `CLAUDE.md`).
- `_provenance/`, `_unresolved/`: migration records, not shown to readers.

English is always the base text. Translations into Tamil, Kannada, Hindi and
Telugu live under each record's `translations.<lang>`; the rules are in
`docs/TRANSLATION-GUIDE.md` and the translation workflow in
`docs/TRANSLATION-WORKFLOW.md`. `npm run test:content` validates every record.

History: this folder began empty as the Phase 5B scaffold; the records were
migrated in Phases 5E–5H (see `DOCUMENTATION.md`).
