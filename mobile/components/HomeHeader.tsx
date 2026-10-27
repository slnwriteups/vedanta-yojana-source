import { StyleSheet, Text, View } from "react-native";
import { layout, spacing, typography, useTheme } from "../theme";
import { useT, type UiStringKey } from "../ui-strings.ts";

/**
 * Home's title: the time-of-day greeting, with the app's one-line
 * description beneath it (same as the website's HomeHeader). Today's
 * Panchangam is not repeated here; the Panchangam & Calendar card further
 * down Home is the one place it is shown.
 */
function greetingKeyForHour(hour: number): UiStringKey {
  if (hour < 12) return "homeGreetingMorning";
  if (hour < 17) return "homeGreetingAfternoon";
  if (hour < 21) return "homeGreetingEvening";
  return "homeGreetingNight";
}

export function HomeHeader() {
  const theme = useTheme();
  const t = useT();

  return (
    <View style={styles.container}>
      <Text style={[styles.greeting, { color: theme.colors.foreground }]} accessibilityRole="header">
        {t(greetingKeyForHour(new Date().getHours()))}
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{t("homeGreetingSubtitle")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  greeting: {
    fontSize: typography.title + 8,
    lineHeight: (typography.title + 8) * 1.2,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: typography.body + 1,
    lineHeight: (typography.body + 1) * 1.5,
  },
});
