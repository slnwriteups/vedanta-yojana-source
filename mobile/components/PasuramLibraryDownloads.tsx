import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { loadDivyaDesams } from "../content-lib/loader.ts";
import { allPasuramResourceUrls } from "../content-lib/pasuram-resources.ts";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { useLanguage } from "../language-context.ts";
import {
  pasuramDownloadAllResult,
  pasuramDownloadAllStatus,
  pasuramDownloadAllSummary,
  useT,
} from "../ui-strings.ts";
import {
  downloadAllPasurams,
  estimatedPasuramLibrarySizeMb,
  isPasuramAvailable,
  type BulkDownloadSummary,
} from "../services/pasuramOfflineService.ts";

type BulkState = "idle" | "downloading" | { summary: BulkDownloadSummary };

/**
 * The one deliberate bulk action for Pasuram PDFs -- lives in Settings,
 * not on every Divya Desam page, per the explicit design decision that
 * ~402 unique PDFs at ~84KB average (~33MB total, a sample-based
 * estimate -- see pasuramOfflineService.ts) is small enough to offer as
 * an explicit opt-in, but still real enough to deserve its own clear
 * "how much is this going to download" summary before the user commits.
 *
 * Never runs automatically. Downloads strictly one file at a time (see
 * downloadAllPasurams()), so this never bursts ~400 simultaneous
 * requests at Prapatti's server.
 */
export function PasuramLibraryDownloads() {
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const [state, setState] = useState<BulkState>("idle");
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  const urls = useMemo(() => allPasuramResourceUrls(loadDivyaDesams()), []);
  const alreadyAvailable = useMemo(
    () => (state === "idle" ? urls.filter((url) => isPasuramAvailable(url)).length : progress.completed),
    // Recomputed on every render while idle (cheap: synchronous local file
    // existence checks) so a resource downloaded from a Divya Desam page
    // is reflected here without needing its own subscription/event bus.
    [urls, state, progress.completed]
  );
  const remaining = urls.length - (state === "idle" ? alreadyAvailable : 0);
  const estimatedMb = estimatedPasuramLibrarySizeMb(urls.length);

  async function handleDownloadAll() {
    setState("downloading");
    setProgress({ completed: 0, total: urls.length });
    const summary = await downloadAllPasurams(urls, (p) => setProgress({ completed: p.completed, total: p.total }));
    setState({ summary });
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>{t("pasuramDownloadAllHeading")}</Text>
      <Text style={[styles.summary, { color: theme.colors.foreground }]}>
        {pasuramDownloadAllSummary(language, urls.length, estimatedMb)}
      </Text>

      {state === "idle" ? (
        <>
          <Text style={[styles.status, { color: theme.colors.muted }]}>
            {pasuramDownloadAllStatus(language, alreadyAvailable, remaining)}
          </Text>
          <Pressable
            onPress={handleDownloadAll}
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={styles.buttonText}>{t("pasuramDownloadAllButton")}</Text>
          </Pressable>
        </>
      ) : null}

      {state === "downloading" ? (
        <View style={styles.progressRow}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={[styles.status, { color: theme.colors.muted }]}>
            {t("pasuramDownloadAllInProgress")} {progress.completed}/{progress.total}
          </Text>
        </View>
      ) : null}

      {typeof state === "object" && "summary" in state ? (
        <Text style={[styles.status, { color: theme.colors.muted }]}>
          {pasuramDownloadAllResult(language, state.summary.downloaded + state.summary.alreadyAvailable, state.summary.totalRequested, state.summary.failed)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summary: {
    fontSize: typography.body,
    fontWeight: "600",
  },
  status: {
    fontSize: typography.small,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  button: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
  },
  buttonText: {
    color: "#fffaf5",
    fontSize: typography.body,
    fontWeight: "700",
  },
});
