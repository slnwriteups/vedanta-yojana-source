import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SettingsControls } from "../../components/SettingsControls";
import { SocialButton } from "../../components/SocialButton";
import { layout, spacing, typography, useTheme } from "../../theme";
import { useT } from "../../ui-strings.ts";

const INSTAGRAM_URL = "https://www.instagram.com/vedantayojana/";

/**
 * A bottom tab, alongside Home/Divya Desams/Library/Search (see
 * app/(tabs)/_layout.tsx). Same SettingsControls the one-time
 * OnboardingScreen shows on first launch -- this is just the
 * always-available place to come back and change them later. A
 * single-file tab (no nested Stack), so its header title comes from
 * the Tabs.Screen options in _layout.tsx, same as search.tsx.
 *
 * The "Connect" section (social links) lives here, not inside
 * SettingsControls -- that component is also shown on first-launch
 * OnboardingScreen, where "follow us on Instagram" doesn't belong yet.
 * This tab is the only place it appears.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const t = useT();

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <SettingsControls />
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>{t("settingsConnectLabel")}</Text>
        <SocialButton icon="logo-instagram" label="Instagram" url={INSTAGRAM_URL} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: layout.tabBarClearance,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
