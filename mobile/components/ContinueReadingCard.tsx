import * as Haptics from "expo-haptics";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { shadows } from "../shadows";
import { useLanguage } from "../language-context.ts";
import { continueReadingProgressLabel, useT } from "../ui-strings.ts";

const COVER_SIZE = { width: 64, height: 96 };

/**
 * Home's hero "Continue Reading" card -- cover thumbnail, chapter/book
 * title, a horizontal progress bar, and a Resume button, all in one
 * full-width row. `position`/`total` are the chapter's place in its
 * book's own chapterOrder (never re-derived here -- HomeScreen passes
 * real loader.ts data); `minutesLeft` is estimateReadingMinutes() of the
 * chapter body itself, i.e. "time left in this chapter", not the whole
 * book -- both real, derived numbers, nothing fabricated.
 */
export function ContinueReadingCard({
  chapterTitle,
  bookTitle,
  imageAsset,
  tintColor,
  monogram,
  position,
  total,
  minutesLeft,
  kind = "book",
  onPress,
}: {
  chapterTitle: string;
  bookTitle: string;
  imageAsset: number | null;
  tintColor: string;
  monogram: string;
  position: number;
  total: number;
  minutesLeft: number;
  /** Whether position/total count chapters of a book or posts of a blog. */
  kind?: "book" | "blog";
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const percentComplete = total > 0 ? Math.round((position / total) * 100) : 0;
  const progressLabel = continueReadingProgressLabel(language, position, total, percentComplete, minutesLeft, kind);

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={[chapterTitle, bookTitle, progressLabel].join(". ")}
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        {
          backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {imageAsset ? (
        <Image source={imageAsset} style={[styles.cover, { backgroundColor: theme.colors.border }]} resizeMode="contain" />
      ) : (
        <View style={[styles.cover, styles.monogram, { backgroundColor: tintColor }]}>
          <Text style={styles.monogramText}>{monogram}</Text>
        </View>
      )}

      <View style={styles.textBlock}>
        <Text style={[styles.chapterTitle, { color: theme.colors.foreground }]} numberOfLines={1}>
          {chapterTitle}
        </Text>
        <Text style={[styles.bookTitle, { color: theme.colors.muted }]} numberOfLines={1}>
          {bookTitle}
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
          <View style={[styles.progressFill, { width: `${percentComplete}%`, backgroundColor: tintColor }]} />
        </View>
        <Text style={[styles.metadata, { color: theme.colors.muted }]} numberOfLines={1}>
          {progressLabel}
        </Text>
      </View>

      <View style={[styles.resumeButton, { backgroundColor: tintColor }]}>
        <Text style={styles.resumeButtonText}>{`▶ ${t("resumeButtonLabel")}`}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    marginHorizontal: layout.screenPadding,
    // Several of these can now stack in a row (one per book the reader
    // has open) -- this margin is the gap between them; harmless when
    // there's only one, since the section wrapper's own gap is tight.
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: layout.minTouchTarget,
    overflow: "hidden",
  },
  cover: {
    ...COVER_SIZE,
    borderRadius: radius.md,
  },
  monogram: {
    alignItems: "center",
    justifyContent: "center",
  },
  monogramText: {
    color: "#fffaf5",
    fontSize: typography.heading,
    fontWeight: "700",
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  chapterTitle: {
    fontSize: typography.body,
    fontWeight: "700",
  },
  bookTitle: {
    fontSize: typography.small,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  metadata: {
    fontSize: typography.eyebrow,
  },
  resumeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  resumeButtonText: {
    color: "#fffaf5",
    fontSize: typography.small,
    fontWeight: "700",
  },
});
