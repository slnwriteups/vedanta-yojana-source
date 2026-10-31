import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatAnnouncementDate, type Announcement } from "../../content-lib/announcements.ts";
import { layout, spacing, typography, useTheme } from "../theme";
import { useT } from "../ui-strings.ts";
import { Section } from "./Section";

/** Native reader uses the already loaded/localized announcement, including offline. */
export function AnnouncementReader({ announcement, onClose }: {
  announcement: Announcement | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  if (!announcement) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View accessibilityViewIsModal style={[styles.screen, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close announcement" style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.accent} />
            <Text style={[styles.headerText, { color: theme.colors.accent }]}>{t("whatsNewLabel")}</Text>
          </Pressable>
        </View>
        <ScrollView key={announcement.id} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <View style={styles.reading}>
            <Text style={[styles.date, { color: theme.colors.muted }]}>{formatAnnouncementDate(announcement.date)}</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.foreground }]}>{announcement.title}</Text>
            <Section text={announcement.body} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md },
  back: { minHeight: layout.minTouchTarget, flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start" },
  headerText: { fontSize: typography.body, fontWeight: "600" },
  content: { padding: layout.screenPadding },
  reading: { width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center", gap: spacing.lg },
  date: { fontSize: typography.small },
  title: { fontSize: typography.title, fontWeight: "700" },
});
