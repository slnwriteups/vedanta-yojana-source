import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { layout, spacing, typography, useTheme } from "../theme";
import { useLanguage } from "../language-context.ts";
import { pasuramResourceLabel, translateUi, useT } from "../ui-strings.ts";
import {
  deleteOfflinePasuram,
  downloadPasuram,
  isPasuramAvailable,
  openOfflinePasuram,
} from "../services/pasuramOfflineService.ts";

type PasuramStatus = "not-downloaded" | "downloading" | "available" | "error";

/**
 * One Pasuram PDF's offline state and controls, replacing the plain
 * ResourceLink row this used to render (ResourceLink.tsx itself is
 * untouched -- it still renders unmodified for Maps shrine links).
 *
 * Offline-first opening: tapping an already-downloaded Pasuram calls
 * openOfflinePasuram(), which only ever inspects local storage -- no
 * fetch, no connectivity check, no contact with Prapatti. Downloading
 * is a separate, explicit action the user must take; nothing here
 * downloads automatically just because this row rendered.
 */
export function PasuramResource({ url, language: pasuramLanguage }: { url: string; language: string }) {
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const [status, setStatus] = useState<PasuramStatus>(() => (isPasuramAvailable(url) ? "available" : "not-downloaded"));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const label = pasuramResourceLabel(language, pasuramLanguage);

  async function handleDownload() {
    setStatus("downloading");
    setErrorMessage(null);
    const result = await downloadPasuram(url);
    if (result.success) {
      setStatus("available");
    } else {
      setStatus("error");
      setErrorMessage(result.error ?? null);
    }
  }

  async function handleOpen() {
    await openOfflinePasuram(url);
  }

  function handleRemove() {
    deleteOfflinePasuram(url);
    setStatus("not-downloaded");
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={status === "available" ? handleOpen : undefined}
        disabled={status !== "available"}
        accessibilityRole={status === "available" ? "button" : undefined}
        accessibilityLabel={status === "available" ? label : undefined}
        style={styles.labelWrap}
      >
        <Text style={[styles.label, { color: theme.colors.foreground }]}>{label}</Text>
      </Pressable>

      {status === "not-downloaded" ? (
        <Pressable
          onPress={handleDownload}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${translateUi("pasuramDownloadForOffline", language)}`}
          style={styles.action}
        >
          <Text style={[styles.actionText, { color: theme.colors.accent }]}>
            {t("pasuramDownloadForOffline")}
          </Text>
        </Pressable>
      ) : null}

      {status === "downloading" ? (
        <View style={styles.action}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={[styles.statusText, { color: theme.colors.muted }]}>{t("pasuramDownloading")}</Text>
        </View>
      ) : null}

      {status === "available" ? (
        <View style={styles.availableWrap}>
          <Text style={[styles.statusText, { color: theme.colors.muted }]}>{t("pasuramAvailableOffline")}</Text>
          <Pressable
            onPress={handleRemove}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${translateUi("pasuramRemoveOffline", language)}`}
            hitSlop={spacing.sm}
          >
            <Text style={[styles.removeText, { color: theme.colors.muted }]}>{t("pasuramRemoveOffline")}</Text>
          </Pressable>
        </View>
      ) : null}

      {status === "error" ? (
        <View style={styles.availableWrap}>
          <Text style={[styles.statusText, { color: theme.colors.foreground }]} numberOfLines={1}>
            {t("pasuramDownloadFailed")}
          </Text>
          <Pressable
            onPress={handleDownload}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${translateUi("pasuramTryAgain", language)}`}
          >
            <Text style={[styles.actionText, { color: theme.colors.accent }]}>{t("pasuramTryAgain")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    fontSize: typography.body,
    fontWeight: "500",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  actionText: {
    fontSize: typography.body,
    fontWeight: "600",
  },
  statusText: {
    fontSize: typography.small,
  },
  availableWrap: {
    alignItems: "flex-end",
    gap: 2,
  },
  removeText: {
    fontSize: typography.small,
    textDecorationLine: "underline",
  },
});
