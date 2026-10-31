"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ANNOUNCEMENTS_LAST_SEEN_KEY,
  formatAnnouncementDate,
  isNewAnnouncement,
  isValidLastSeenDate,
  localizeAnnouncement,
  type Announcement,
} from "@/content-lib/announcements.ts";
import { useLanguage } from "@/lib/language-context";
import { readJSON, writeJSON } from "@/lib/storage";
import { useT } from "@/lib/ui-strings";

/**
 * The What's New list -- web half of mobile/components/WhatsNewList.tsx.
 * Used twice: the Home card (`limit` set, a "See all updates" link) and
 * the full /whats-new/ page (`markSeen`, which records the newest date as
 * read so the "New" badges clear).
 *
 * The announcements arrive as props, read at build time, so the text is
 * in the static HTML for search engines; only the reader's language and
 * the "New" badges are applied after mount. Badges start hidden -- they
 * depend on this browser's storage and today's date, neither of which
 * the pre-rendered HTML can know.
 */
export function WhatsNewList({
  announcements,
  limit,
  markSeen = false,
  compact = false,
}: {
  announcements: Announcement[];
  limit?: number;
  markSeen?: boolean;
  /** Date and title (linking to the full What's New page), plus the announcement's own link when it has one. */
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const t = useT();
  // undefined = not read yet (no badges); null = never opened the list.
  const [lastSeen, setLastSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    readJSON(ANNOUNCEMENTS_LAST_SEEN_KEY, isValidLastSeenDate).then((stored) => {
      if (cancelled) return;
      setLastSeen(stored);
      // Opening the full list marks everything in it read -- from the next
      // visit on. This visit keeps showing which ones were new.
      const newest = announcements[0]?.date;
      if (markSeen && newest && (stored === null || newest > stored)) void writeJSON(ANNOUNCEMENTS_LAST_SEEN_KEY, newest);
    });
    return () => {
      cancelled = true;
    };
  }, [announcements, markSeen]);

  const shown = useMemo(
    () => (limit === undefined ? announcements : announcements.slice(0, limit)).map((a) => localizeAnnouncement(a, language)),
    [announcements, limit, language]
  );

  if (compact) {
    return (
      <ul role="list" className="space-y-3">
        {shown.map((announcement) => (
          <li key={announcement.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
            <time dateTime={announcement.date} className="w-24 flex-none text-sm text-[var(--muted)] tabular-nums">
              {formatAnnouncementDate(announcement.date)}
            </time>
            <div className="min-w-0 flex-1">
              <Link href="/whats-new" className="font-medium hover:underline">
                {announcement.title}
              </Link>
              {/* The announcement's own link (an app download, a new page) is kept
                  even in the short list, so a notice that needs acting on can be
                  acted on from Home. */}
              {announcement.link ? (
                <div>
                  <AnnouncementLink {...announcement.link} />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul role="list" className="space-y-3">
      {shown.map((announcement) => (
        <li
          key={announcement.id}
          id={announcement.id}
          className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
          {markSeen && announcement.body.length > 1000 ? <ExitAnnouncementButton /> : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <time dateTime={announcement.date}>{formatAnnouncementDate(announcement.date)}</time>
            {announcement.platforms.map((platform) => (
              <span key={platform} className="rounded-full border border-[var(--border)] px-2 py-0.5">
                {t(platform === "app" ? "whatsNewAppTag" : "whatsNewWebsiteTag")}
              </span>
            ))}
            {lastSeen !== undefined && isNewAnnouncement(announcement, lastSeen) ? (
              <span className="rounded-full bg-[var(--highlight)] px-2 py-0.5 font-semibold text-[var(--on-highlight)]">
                {t("whatsNewNewBadge")}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 font-semibold">{announcement.title}</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-[var(--muted)]">{announcement.body}</p>
          {announcement.link ? <AnnouncementLink {...announcement.link} /> : null}
          {markSeen && announcement.body.length > 1000 ? <ExitAnnouncementButton /> : null}
        </li>
      ))}
    </ul>
  );
}

function ExitAnnouncementButton() {
  return (
    <Link href="/" className="my-3 inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:underline">
      <span aria-hidden="true">←</span>&nbsp;Back to Home
    </Link>
  );
}

function AnnouncementLink({ href, label }: { href: string; label: string }) {
  const className = "mt-2 inline-block text-sm font-semibold text-[var(--accent)] hover:underline";
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {label} <span aria-hidden="true">→</span>
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label} <span aria-hidden="true">↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

