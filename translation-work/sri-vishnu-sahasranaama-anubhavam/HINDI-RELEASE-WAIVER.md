# Hindi edition: owner release decision

**Release date:** 2026-10-31
**Covers:** the Hindi edition of *Sri Vishnu Sahasranaama Anubhavam*: 116 chapters, the book title and description, and 4 part titles (PR #139).

## Waived by the owner for this release

The owner released the Hindi edition **without** the following:

- **Independent chapter-by-chapter linguistic review.** None was performed.
- **Theological approval.** No approval was recorded through the translation engine.

The owner explicitly accepted the editorial risk of doing so.

This waiver is **not** a review or a certification. No review or approval records were created, and the engine's own records still show every Hindi chapter as `linguistic review: none; theological approval: none`. The waiver applies to this Hindi edition only. It does not carry over to any other translation.

## What did pass

The mechanical checks:

- **Translation engine:** `check --book=sri-vishnu-sahasranaama-anubhavam --langs=hi --require` reported 0 blocking errors.
- **Hindi-only change:** a guard confirmed that every changed content file differs from `main` only by Hindi that was previously missing. No English, Tamil, Kannada, Telugu or existing Hindi text was altered.

## Still open

The 39 entries in `source-concerns.json` remain open and unresolved. They are:

- quoted Tamil phrases, transliterated and awaiting verification against the authoritative texts;
- possible problems in the English source;
- conventions for the owner to confirm.

None of these has been altered or marked as resolved.
