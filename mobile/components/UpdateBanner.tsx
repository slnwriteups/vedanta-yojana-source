import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, typography, useTheme } from "../theme";
import type { UpdateInfo } from "../services/updateCheckService.ts";
import { downloadAndInstallApk } from "../services/apkInstallerService.ts";

/**
 * Shown only when checkForUpdate() (services/updateCheckService.ts)
 * finds a newer build published than the one currently running --
 * renders nothing otherwise, and never appears more than once per
 * session once dismissed.
 *
 * Tapping triggers in-app download and launches the native Android
 * package installer prompt ("Do you want to update this app?"),
 * upgrading the app with one tap while preserving all reading data.
 */
export function UpdateBanner({ update, onDismiss }: { update: UpdateInfo; onDismiss: () => void }) {
  const theme = useTheme();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handlePress = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      await downloadAndInstallApk(update.downloadUrl, (percent) => {
        setDownloadProgress(percent);
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.accent }]}>
      <Pressable
        onPress={handlePress}
        disabled={isDownloading}
        style={styles.textArea}
        accessibilityRole="button"
        accessibilityLabel={`Update available: version ${update.latestVersion}. Tap to install.`}
      >
        <Text style={[styles.title, { color: theme.colors.surface }]}>
          Update available: v{update.latestVersion}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.surface }]}>
          {isDownloading
            ? `Downloading update… ${downloadProgress}%`
            : "Tap to download and install"}
        </Text>
        {update.notes ? (
          <Text style={[styles.notes, { color: theme.colors.surface }]}>
            {update.notes}
          </Text>
        ) : null}
      </Pressable>

      {isDownloading ? (
        <ActivityIndicator color={theme.colors.surface} size="small" style={styles.spinner} />
      ) : (
        <Pressable
          onPress={onDismiss}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel="Dismiss update notice"
          style={styles.dismiss}
        >
          <Text style={[styles.dismissText, { color: theme.colors.surface }]}>✕</Text>
        </Pressable>
      )}
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
  notes: {
    fontSize: typography.small,
    opacity: 0.9,
    marginTop: 2,
    lineHeight: 18,
  },
  spinner: {
    paddingHorizontal: spacing.xs,
  },
  dismiss: {
    paddingHorizontal: spacing.xs,
  },
  dismissText: {
    fontSize: typography.body,
    fontWeight: "700",
  },
});
