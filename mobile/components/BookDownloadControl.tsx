import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { useLanguage } from "../language-context.ts";
import { translateUi, useT } from "../ui-strings.ts";
import {
  deleteBook,
  downloadBook,
  isBookAvailable,
  isBookDownloading,
  subscribeToBookChanges,
} from "../services/bookOfflineService.ts";

type BookDownloadStatus = "not-downloaded" | "downloading" | "available" | "error";

/** A saved copy wins over an in-flight download: a background re-sync of a saved book keeps it readable throughout. */
function currentStatus(bookSlug: string): BookDownloadStatus {
  if (isBookAvailable(bookSlug)) return "available";
  return isBookDownloading(bookSlug) ? "downloading" : "not-downloaded";
}

/**
 * A single book's download state and controls, shown at the top of the
 * Library book screen (LibraryBookScreen, [book].tsx) above its chapter
 * list. Mirrors PasuramResource.tsx's status-machine shape (not-
 * downloaded/downloading/available/error, each with its own local
 * useState) applied to a whole book instead of one PDF.
 *
 * This button is never the ONLY way to obtain a book -- [book].tsx also
 * triggers the identical downloadBook() the moment a person taps any
 * chapter of a book that isn't downloaded yet (read-online-then-
 * download), so reading doesn't require finding and pressing this
 * button first when online. What this component still owns exclusively
 * is explicit OFFLINE-availability status and control: pressing
 * Download here (or the same fetch firing from a chapter tap) is the
 * one thing that ever contacts the network for this feature, and
 * Remove Offline Copy is the one way to delete a local copy -- nothing
 * on this screen ever downloads merely because it was opened.
 *
 * The screen needs nothing back from it: a chapter tap checks
 * bookOfflineService itself for whether that chapter is saved.
 */
export function BookDownloadControl({ bookSlug }: { bookSlug: string }) {
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const [status, setStatus] = useState<BookDownloadStatus>(() => currentStatus(bookSlug));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Follows downloads this control didn't start itself -- a chapter tap
  // on the screen below, or the background re-sync -- so it never offers
  // Download for a book that is already saved, or sits idle while one is
  // in progress. A failure of its own download is set by handleDownload()
  // after this has run, so the error and Try Again still show.
  useEffect(() => {
    setStatus(currentStatus(bookSlug));
    return subscribeToBookChanges((changedSlug) => {
      if (changedSlug === bookSlug) setStatus(currentStatus(bookSlug));
    });
  }, [bookSlug]);

  async function handleDownload() {
    setStatus("downloading");
    setErrorMessage(null);
    const result = await downloadBook(bookSlug);
    if (result.success) {
      setStatus("available");
    } else {
      setStatus("error");
      setErrorMessage(result.error ?? null);
    }
  }

  function handleRemove() {
    deleteBook(bookSlug);
    setStatus("not-downloaded");
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
