import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { useLanguage } from "../language-context.ts";
import { translateUi, useT } from "../ui-strings.ts";
import { deleteBook, downloadBook, isBookAvailable } from "../services/bookOfflineService.ts";

type BookDownloadStatus = "not-downloaded" | "downloading" | "available" | "error";

/**
 * A single book's download state and controls, shown at the top of the
 * Library book screen (LibraryBookScreen, [book].tsx) above its chapter
 * list. Mirrors PasuramResource.tsx's status-machine shape (not-
 * downloaded/downloading/available/error, each with its own local
 * useState) applied to a whole book instead of one PDF -- see that
 * component's own doc comment for the offline-first opening principle
 * this follows: a downloaded book's chapters open from local storage
 * with zero network contact, and downloading only ever happens from an
 * explicit tap here, never automatically just because this screen opened
 * (Phase 10's "Do not automatically download books" requirement).
 *
 * `onAvailabilityChange` reports every status transition up to the
 * screen, which uses it to gate whether chapter rows are tappable --
 * this component owns the download machinery, the screen owns what
 * "available" unlocks.
 */
export function BookDownloadControl({
  bookSlug,
  onAvailabilityChange,
}: {
  bookSlug: string;
  onAvailabilityChange: (available: boolean) => void;
}) {
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const [status, setStatus] = useState<BookDownloadStatus>(() => {
    const available = isBookAvailable(bookSlug);
    return available ? "available" : "not-downloaded";
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDownload() {
    setStatus("downloading");
    setErrorMessage(null);
    const result = await downloadBook(bookSlug);
    if (result.success) {
      setStatus("available");
      onAvailabilityChange(true);
    } else {
      setStatus("error");
      setErrorMessage(result.error ?? null);
    }
  }

  function handleRemove() {
    deleteBook(bookSlug);
    setStatus("not-downloaded");
    onAvailabilityChange(false);
  }

  if (status === "available") {
    return (
      <View style={[styles.card, { borderColor: theme.colors.border }]}>
        <Text style={[styles.statusText, { color: theme.colors.muted }]}>{t("bookAvailableOffline")}</Text>
        <Pressable
          onPress={handleRemove}
          accessibilityRole="button"
          accessibilityLabel={translateUi("bookRemoveOffline", language)}
          hitSlop={spacing.sm}
        >
          <Text style={[styles.removeText, { color: theme.colors.muted }]}>{t("bookRemoveOffline")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderColor: theme.colors.border }]}>
      <Text style={[styles.hint, { color: theme.colors.muted }]}>{t("bookDownloadToRead")}</Text>

      {status === "not-downloaded" ? (
        <Pressable
          onPress={handleDownload}
          accessibilityRole="button"
          accessibilityLabel={translateUi("bookDownloadButton", language)}
          style={[styles.button, { backgroundColor: theme.colors.accent }]}
        >
          <Text style={styles.buttonText}>{t("bookDownloadButton")}</Text>
        </Pressable>
      ) : null}

      {status === "downloading" ? (
        <View style={styles.progressRow}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={[styles.statusText, { color: theme.colors.muted }]}>{t("bookDownloading")}</Text>
        </View>
      ) : null}

      {status === "error" ? (
        <View style={styles.progressRow}>
          <Text style={[styles.statusText, { color: theme.colors.foreground }]} numberOfLines={2}>
            {t("bookDownloadFailed")}
            {errorMessage ? `: ${errorMessage}` : ""}
          </Text>
          <Pressable
            onPress={handleDownload}
            accessibilityRole="button"
            accessibilityLabel={translateUi("bookTryAgain", language)}
            style={[styles.button, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={styles.buttonText}>{t("bookTryAgain")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  hint: {
    fontSize: typography.body,
  },
  button: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  buttonText: {
    color: "#fff",
    fontSize: typography.body,
    fontWeight: "700",
  },
  progressRow: {
    gap: spacing.sm,
  },
  statusText: {
    fontSize: typography.small,
  },
  removeText: {
    fontSize: typography.small,
    textDecorationLine: "underline",
  },
});
