import test from "node:test";
import assert from "node:assert/strict";
import { isAnnouncementReadLink } from "../content-lib/announcement-links.ts";

test("announcement reading actions stay native for absolute and relative feed links", () => {
  for (const prefix of ["https://vedantayojana.org/whats-new/", "https://vedantayojana.org/whats-new", "/whats-new/", "/whats-new"]) {
    assert.equal(isAnnouncementReadLink(`${prefix}#deepavali`, "deepavali"), true);
  }
});

test("book, download, other-notice and external links retain their own destinations", () => {
  for (const href of ["/library/book", "https://github.com/owner/releases/latest", "https://example.com/whats-new/#deepavali", "/whats-new/#other", "/whats-new", "/whats-new/#%ZZ"]) {
    assert.equal(isAnnouncementReadLink(href, "deepavali"), false, href);
  }
});
