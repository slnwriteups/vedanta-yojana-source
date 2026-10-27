import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ANNOUNCEMENTS_LAST_SEEN_KEY,
  formatAnnouncementDate,
  isNewAnnouncement,
  isValidLastSeenDate,
  localizeAnnouncement,
  type Announcement,
} from "../../content-lib/announcements.ts";
import { radius, spacing, typography, useTheme } from "../theme";
import { useLanguage } from "../language-context.ts";
import { useT } from "../ui-strings.ts";
import { readJSON, writeJSON } from "../storage";

/**
 * The What's New list -- app half of components/whats-new/WhatsNewList.tsx
 * on the website, same behavior: Home shows the latest two (`limit`), the
 * whats-new screen shows all of them and, with `markSeen`, records the
 * newest date as read so the "New" badges clear from the next visit on.
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
  /** Date and title only, one row each, opening the full What's New screen. */
  compact?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { language } = useLanguage();
  const t = useT();
  // undefined = not read yet (no badges); null = never opened the list.
  const [lastSeen, setLastSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    readJSON(ANNOUNCEMENTS_LAST_SEEN_KEY, isValidLastSeenDate).then((stored) => {
      if (cancelled) return;
      setLastSeen(stored);
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

  const openLink = (href: string) => {
    if (href.startsWith("/")) router.push(href as never);
    else void Linking.openURL(href);
  };

  if (compact) {
    return (
      <View style={styles.list}>
        {shown.map((announcement) => (
          <Pressable
            key={announcement.id}
            onPress={() => router.push("/whats-new" as never)}
            accessibilityRole="link"
            style={({ pressed }) => [styles.compactRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.compactDate, { color: theme.colors.muted }]}>{formatAnnouncementDate(announcement.date)}</Text>
            <Text style={[styles.compactTitle, { color: theme.colors.foreground }]}>{announcement.title}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {shown.map((announcement) => (
        <View
          key={announcement.id}
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <View style={[styles.stripe, { backgroundColor: theme.colors.accent }]} />
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: theme.colors.muted }]}>{formatAnnouncementDate(announcement.date)}</Text>
            {announcement.platforms.map((platform) => (
              <Text key={platform} style={[styles.tag, { color: theme.colors.muted, borderColor: theme.colors.border }]}>
                {t(platform === "app" ? "whatsNewAppTag" : "whatsNewWebsiteTag")}
              </Text>
            ))}
            {lastSeen !== undefined && isNewAnnouncement(announcement, lastSeen) ? (
              <Text style={[styles.tag, styles.newTag, { backgroundColor: theme.colors.highlight, borderColor: theme.colors.highlight, color: theme.colors.onHighlight }]}>
                {t("whatsNewNewBadge")}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.title, { color: theme.colors.foreground }]}>{announcement.title}</Text>
          <Text style={[styles.body, { color: theme.colors.muted }]}>{announcement.body}</Text>
          {announcement.link ? (
            <Pressable
              onPress={() => openLink(announcement.link!.href)}
              accessibilityRole="link"
              hitSlop={spacing.sm}
              style={styles.linkButton}
            >
              <Text style={[styles.link, { color: theme.colors.accent }]}>
                {announcement.link.label} {announcement.link.href.startsWith("/") ? "→" : "↗"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  compactRow: {
    flexDirection: "row",
    gap: spacing.lg,
    minHeight: 44,
    alignItems: "baseline",
  },
  compactDate: {
    width: 92,
    fontSize: typography.small,
    fontVariant: ["tabular-nums"],
  },
  compactTitle: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: "500",
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    paddingLeft: spacing.lg + spacing.xs,
    overflow: "hidden",
    gap: spacing.xs,
  },
  stripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  meta: {
    fontSize: typography.eyebrow,
  },
  tag: {
    fontSize: typography.eyebrow,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    overflow: "hidden",
  },
  newTag: {
    fontWeight: "700",
  },
  title: {
    fontSize: typography.heading,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  body: {
    fontSize: typography.small,
    lineHeight: typography.small * 1.5,
  },
  linkButton: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  link: {
    fontSize: typography.small,
    fontWeight: "700",
  },
});
