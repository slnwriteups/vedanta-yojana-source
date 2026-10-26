import type { Metadata } from "next";
import { loadAnnouncements } from "@/content-lib/announcements-loader.ts";
import { LocalizedPageHeading } from "@/components/shared/LocalizedPageHeading";
import { LocalizedText } from "@/components/shared/LocalizedText";
import { WhatsNewList } from "@/components/whats-new/WhatsNewList";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "What's New",
  description: "New books, translations and features on the Vedanta Yojana app and website, newest first.",
  path: "/whats-new",
});

/**
 * Every announcement, newest first -- the full list behind Home's What's
 * New card, and the web counterpart of the app's whats-new screen.
 * Opening it marks the announcements read, clearing their "New" badges.
 */
export default function WhatsNewPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <LocalizedPageHeading stringKey="whatsNewLabel" />
        <LocalizedText stringKey="whatsNewSubtitle" className="prose-body text-[var(--muted)]" />
      </div>
      <WhatsNewList announcements={loadAnnouncements()} markSeen />
    </div>
  );
}
