import test from "node:test";
import assert from "node:assert/strict";
import {
  announcementTags,
  announcementsForApp,
  formatAnnouncementDate,
  isNewAnnouncement,
  localizeAnnouncement,
  parseAnnouncements,
  preferredAnnouncements,
  type Announcement,
} from "../../content-lib/announcements.ts";
import { loadAnnouncements } from "../../content-lib/announcements-loader.ts";

/**
 * What's New announcements (content-lib/announcements.ts): the real
 * content/announcements.json must always parse -- a bad edit fails here,
 * not on the live site or in the app -- and the shared logic both the
 * website and the app rely on behaves as documented.
 */

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: "2026-10-18-x",
  date: "2026-10-18",
  platforms: ["app", "website"],
  title: "Title",
  body: "Body",
  ...overrides,
});

test("content/announcements.json is valid, newest first, with unique ids", () => {
  const announcements = loadAnnouncements();
  assert.ok(announcements.length > 0);
  const dates = announcements.map((a) => a.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
  assert.equal(new Set(announcements.map((a) => a.id)).size, announcements.length);
});

test("every internal announcement link points at a route the website and the app both have", () => {
  const routes = ["/", "/divya-desams", "/library", "/search", "/settings", "/whats-new"];
  for (const { link } of loadAnnouncements()) {
    if (!link || !link.href.startsWith("/")) continue;
    const path = link.href.replace(/\/$/, "") || "/";
    assert.ok(
      routes.includes(path) || /^\/(divya-desams|library)\/[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(path),
      `unexpected link ${link.href}`
    );
  }
});

test("parseAnnouncements sorts newest first and keeps same-day file order", () => {
  const parsed = parseAnnouncements({
    announcements: [
      entry({ id: "a", date: "2026-01-01" }),
      entry({ id: "b", date: "2026-03-01" }),
      entry({ id: "c", date: "2026-03-01" }),
    ],
  });
  assert.deepEqual(parsed?.map((a) => a.id), ["b", "c", "a"]);
});

test("parseAnnouncements rejects the whole document on any invalid entry or duplicate id", () => {
  assert.equal(parseAnnouncements(null), null);
  assert.equal(parseAnnouncements({}), null);
  assert.equal(parseAnnouncements({ announcements: [entry({ date: "18 Oct 2026" })] }), null);
  assert.equal(parseAnnouncements({ announcements: [entry({ platforms: [] })] }), null);
  assert.equal(parseAnnouncements({ announcements: [entry({ platforms: ["tv"] })] }), null);
  assert.equal(parseAnnouncements({ announcements: [entry({ title: " " })] }), null);
  assert.equal(parseAnnouncements({ announcements: [entry(), entry()] }), null);
  assert.equal(parseAnnouncements({ announcements: [entry({ translations: { fr: { title: "x" } } })] }), null);
});

test("parseAnnouncements only accepts site paths and https links", () => {
  for (const href of ["javascript:alert(1)", "http://example.com", "data:text/html,x"]) {
    assert.equal(parseAnnouncements({ announcements: [entry({ link: { href, label: "x" } })] }), null, href);
  }
  assert.ok(parseAnnouncements({ announcements: [entry({ link: { href: "/library", label: "Library" } })] }));
  assert.ok(parseAnnouncements({ announcements: [entry({ link: { href: "https://example.com", label: "x" } })] }));
});

test("localizeAnnouncement falls back to English field by field", () => {
  const [announcement] = parseAnnouncements({
    announcements: [entry({ link: { href: "/", label: "Open" }, translations: { ta: { title: "தலைப்பு" } } })],
  })!;
  const ta = localizeAnnouncement(announcement, "ta");
  assert.equal(ta.title, "தலைப்பு");
  assert.equal(ta.body, "Body");
  assert.equal(ta.link?.label, "Open");
  assert.equal(localizeAnnouncement(announcement, "hi"), announcement);
  assert.equal(localizeAnnouncement(announcement, null), announcement);
});

test("formatAnnouncementDate", () => {
  assert.equal(formatAnnouncementDate("2026-10-08"), "8 Oct 2026");
  assert.equal(formatAnnouncementDate("2026-01-31"), "31 Jan 2026");
});

test("isNewAnnouncement: recent and unseen only", () => {
  const today = new Date("2026-10-26T12:00:00Z");
  const a = { ...entry(), date: "2026-10-18" } as Announcement;
  assert.equal(isNewAnnouncement(a, null, today), true);
  assert.equal(isNewAnnouncement(a, "2026-10-01", today), true);
  assert.equal(isNewAnnouncement(a, "2026-10-18", today), false);
  assert.equal(isNewAnnouncement({ ...a, date: "2026-08-01" }, null, today), false);
});

test("preferredAnnouncements: live wins, but never an older list than the bundled one", () => {
  const list = (id: string, date: string) => parseAnnouncements({ announcements: [entry({ id, date })] })!;
  const bundled = list("bundled", "2026-10-18");
  assert.equal(preferredAnnouncements(list("live", "2026-10-20"), null, bundled)[0].id, "live");
  assert.equal(preferredAnnouncements(list("live", "2026-10-18"), null, bundled)[0].id, "live");
  assert.equal(preferredAnnouncements(null, list("cached", "2026-09-01"), bundled)[0].id, "bundled");
  assert.equal(preferredAnnouncements(null, null, bundled)[0].id, "bundled");
  assert.deepEqual(preferredAnnouncements(null, null, null), []);
});

test("appPlatforms: optional, only android/ios, only on an app announcement", () => {
  const ok = parseAnnouncements({ announcements: [entry({ platforms: ["app"], appPlatforms: ["android"] })] });
  assert.deepEqual(ok?.[0].appPlatforms, ["android"]);
  assert.equal(parseAnnouncements({ announcements: [entry()] })?.[0].appPlatforms, undefined);
  for (const appPlatforms of [[], ["windows"], "android", ["android", 1]]) {
    assert.equal(parseAnnouncements({ announcements: [entry({ appPlatforms })] }), null, JSON.stringify(appPlatforms));
  }
  assert.equal(parseAnnouncements({ announcements: [entry({ platforms: ["website"], appPlatforms: ["ios"] })] }), null);
});

test("the real feed keeps `platforms` to app/website, so older installs keep a working feed", () => {
  // Installed apps that predate appPlatforms validate the fetched feed with
  // a parser that ignores unknown fields but rejects the whole list on any
  // `platforms` value other than "app" or "website" -- so Android/iOS-only
  // entries must use appPlatforms, never new `platforms` values.
  for (const { id, platforms } of loadAnnouncements()) {
    assert.ok(platforms.every((p) => p === "app" || p === "website"), id);
  }
});

test("announcementsForApp leaves out entries for the other operating system", () => {
  const list = parseAnnouncements({
    announcements: [
      entry({ id: "both", platforms: ["app"] }),
      entry({ id: "android", platforms: ["app"], appPlatforms: ["android"] }),
      entry({ id: "ios", platforms: ["app"], appPlatforms: ["ios"] }),
      entry({ id: "web", platforms: ["website"] }),
    ],
  })!;
  assert.deepEqual(announcementsForApp(list, "android").map((a) => a.id), ["both", "android", "web"]);
  assert.deepEqual(announcementsForApp(list, "ios").map((a) => a.id), ["both", "ios", "web"]);
});

test("announcementTags names the app build an entry is limited to", () => {
  const [limited, both] = parseAnnouncements({
    announcements: [
      entry({ id: "a", platforms: ["app", "website"], appPlatforms: ["android"] }),
      entry({ id: "b", platforms: ["app", "website"] }),
    ],
  })!;
  assert.deepEqual(announcementTags(limited), ["android", "website"]);
  assert.deepEqual(announcementTags(both), ["app", "website"]);
});
