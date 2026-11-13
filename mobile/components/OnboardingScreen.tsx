import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsControls } from "./SettingsControls";
import { spacing, typography, useTheme } from "../theme";
import { useT } from "../ui-strings.ts";

/**
 * A one-time step shown exactly once ever (gated in app/_layout.tsx on
 * ONBOARDED_STORAGE_KEY), right after the welcome screen on a person's
 * very first launch: choose Appearance and Text size before landing in
 * the app proper. The same SettingsControls are reachable again any
 * time afterward from app/settings.tsx -- this screen only decides
 * whether they're front-loaded once, not where the settings live.
 */
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const t = useT();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: theme.colors.foreground }]}>{t("onboardingTitle")}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{t("onboardingSubtitle")}</Text>
        </View>

        <SettingsControls />

        <TouchableOpacity onPress={onDone} style={[styles.button, { backgroundColor: theme.colors.accent }]} accessibilityRole="button">
          <Text style={[styles.buttonLabel, { color: theme.colors.surface }]}>{t("onboardingContinue")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // flexGrow, not flex: centred when it fits, scrolls when it is taller
  // than the screen (small phones, large text, longer scripts).
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: spacing.xxl,
    padding: spacing.xl,
  },
  textBlock: {
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: typography.body,
    lineHeight: typography.body * typography.readingLineHeight,
  },
  button: {
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: "600",
  },
});
