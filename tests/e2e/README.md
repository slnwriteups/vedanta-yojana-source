# /tests/e2e

End-to-end tests (Playwright), per the Phase 5A testing plan — home, Divya
Desam index/detail, library, chapter, knowledge, search, mobile navigation.

**Status: scaffolded.** `@playwright/test` is installed and configured in
`/playwright.config.ts` (Chromium only). The only spec is Playwright's
`example.spec.ts`, which tests playwright.dev, not this site. Replace it with
real route tests as the routes land.

Run with `npm run test:e2e` (first run: `npx playwright install chromium`).
