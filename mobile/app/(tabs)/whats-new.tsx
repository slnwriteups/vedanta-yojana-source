import { ScrollView, StyleSheet, Text } from "react-native";
import { WhatsNewList } from "../../components/WhatsNewList";
import { useAnnouncements } from "../../services/announcementsService.ts";
import { layout, spacing, typography, useTheme } from "../../theme";
import { useT } from "../../ui-strings.ts";

/**
 * Every announcement, newest first -- the app's counterpart of the
 * website's /whats-new/ page. Opening it marks the announcements read,
 * clearing their "New" badges on Home.
 *
 * A hidden tab (`href: null` in (tabs)/_layout.tsx) rather than a screen
 * outside the tab group, so the tab bar stays put like everywhere else
 * in the app; its title and back button are set there too.
 */
export default function WhatsNewScreen() {
  const theme = useTheme();
  const t = useT();
  const announcements = useAnnouncements();

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: layout.tabBarClearance }]}
    >
      <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{t("whatsNewSubtitle")}</Text>
      <WhatsNewList announcements={announcements} markSeen />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPadding,
    gap: spacing.lg,
  },
  subtitle: {
    fontSize: typography.body,
  },
});
