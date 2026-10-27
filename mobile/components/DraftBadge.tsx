import { StyleSheet, Text } from "react-native";
import { typography, useTheme } from "../theme";
import { useLanguage } from "../language-context.ts";
import { translateUi } from "../ui-strings.ts";

/**
 * Mirrors the exact condition and copy of the web app's
 * components/shared/DraftBadge.tsx: renders only when status is "draft",
 * with an additional "flagged for additional review" clause when
 * needsReview is true. Internal migration metadata is never surfaced.
 */
export function DraftBadge({ status, needsReview }: { status: string; needsReview: boolean }) {
  const theme = useTheme();
  const { language } = useLanguage();
  if (status !== "draft") return null;

  return (
    <Text
      style={[styles.text, { color: theme.colors.muted }]}
      accessibilityRole="text"
      accessibilityLabel={
        translateUi("draftBadgeA11y", language) +
        (needsReview ? translateUi("draftBadgeFlaggedA11ySuffix", language) : "")
      }
    >
      {translateUi("draftBadge", language)}
      {needsReview ? translateUi("draftBadgeFlaggedSuffix", language) : ""}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: typography.small,
  },
});
