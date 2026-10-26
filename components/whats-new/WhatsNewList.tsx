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
}: {
  announcements: Announcement[];
  limit?: number;
  markSeen?: boolean;
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

  return (
    <ul role="list" className="space-y-3">
      {shown.map((announcement) => (
        <li
          key={announcement.id}
          className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <time dateTime={announcement.date}>{formatAnnouncementDate(announcement.date)}</time>
            {announcement.platforms.map((platform) => (
              <span key={platform} className="rounded-full border border-[var(--border)] px-2 py-0.5">
                {t(platform === "app" ? "whatsNewAppTag" : "whatsNewWebsiteTag")}
              </span>
            ))}
            {lastSeen !== undefined && isNewAnnouncement(announcement, lastSeen) ? (
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 font-semibold text-[#fffaf5]">
                {t("whatsNewNewBadge")}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 font-semibold">{announcement.title}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{announcement.body}</p>
          {announcement.link ? <AnnouncementLink {...announcement.link} /> : null}
        </li>
      ))}
    </ul>
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
