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
 * distributed Android app uses. Now that EAS Update delivers JS
 * changes by itself, a banner means specifically "there is a new
 * NATIVE build" -- the one thing an update cannot deliver.
 *
 * The notes line is the manifest's own `notes` field
 * (public/app-version.json), and it is the only place a release gets
 * to say what it actually contains. It was previously fetched, typed
 * and then dropped on the floor here, which left every release
 * announcing itself with the same generic "tap to download" and
 * nothing else. Clamped to three lines: the manifest's notes are
 * capped at 400 characters by tests/app/app-version-manifest.test.ts,
 * but a banner is a banner, not a changelog.
 */
export function UpdateBanner({ update, onDismiss }: { update: UpdateInfo; onDismiss: () => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.accent }]}>
      <Pressable
        onPress={() => Linking.openURL(update.downloadUrl)}
        style={styles.textArea}
        accessibilityRole="button"
        accessibilityLabel={
          update.notes
            ? `Update available: version ${update.latestVersion}. ${update.notes} Tap to download.`
            : `Update available: version ${update.latestVersion}. Tap to download.`
        }
      >
        <Text style={[styles.title, { color: theme.colors.surface }]}>Update available: v{update.latestVersion}</Text>
        {update.notes ? (
          <Text style={[styles.notes, { color: theme.colors.surface }]} numberOfLines={3}>
            {update.notes}
          </Text>
        ) : null}
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
  notes: {
    fontSize: typography.small,
    lineHeight: typography.small * 1.35,
  },
  // The action hint sits below the notes and is deliberately quieter
  // than them: what the release contains is the reason to tap, and
  // "tap to download" is only how.
  subtitle: {
    fontSize: typography.small,
    opacity: 0.9,
  },
  dismiss: {
    paddingHorizontal: spacing.xs,
  },
  dismissText: {
    fontSize: typography.body,
    fontWeight: "700",
  },
});
