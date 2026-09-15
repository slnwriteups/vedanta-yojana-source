import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, typography, useTheme } from "../theme";
import type { UpdateInfo } from "../services/updateCheckService.ts";

/**
 * Shown only when checkForUpdate() (services/updateCheckService.ts)
 * finds a newer build published than the one currently running --
 * renders nothing otherwise, and never appears more than once per
 * session once dismissed. Tapping the banner opens the download page
 * in the device's own browser; this app has no OS permission to
 * install an update over itself (only the Play Store's own installer
 * has that), so a manual re-download-and-reinstall, guided by this
 * banner, is the real mechanism -- the same one every other directly-
 * distributed Android app uses.
 */
export function UpdateBanner({ update, onDismiss }: { update: UpdateInfo; onDismiss: () => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.accent }]}>
      <Pressable
        onPress={() => Linking.openURL(update.downloadUrl)}
        style={styles.textArea}
        accessibilityRole="button"
        accessibilityLabel={`Update available: version ${update.latestVersion}. Tap to download.`}
      >
        <Text style={[styles.title, { color: theme.colors.surface }]}>Update available: v{update.latestVersion}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.surface }]}>Tap to download the latest version</Text>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={spacing.sm}
        accessibilityRole="button"
        accessibilityLabel="Dismiss update notice"
        style={styles.dismiss}
      >
        <Text style={[styles.dismissText, { color: theme.colors.surface }]}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  textArea: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: typography.body,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: typography.small,
  },
  dismiss: {
    paddingHorizontal: spacing.xs,
  },
  dismissText: {
    fontSize: typography.body,
    fontWeight: "700",
  },
});
