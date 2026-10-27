import { useCallback, useRef, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SettingsControls } from "../../components/SettingsControls";
import { SocialButton } from "../../components/SocialButton";
import { layout, radius, spacing, typography, useTheme } from "../../theme";
import { useT } from "../../ui-strings.ts";
import { TourTarget, useTour, useTourScroller } from "../../tour/Tour";

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
  const tour = useTour();

  // The tour's Settings steps scroll their control into view: on first
  // launch this tab opens at the top, and the lower controls (the "How to
  // use the app" button especially) can be below the fold on a phone.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollY = useRef(0);
  const scrollBy = useCallback((dy: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + dy), animated: true });
  }, []);
  useTourScroller("/settings", scrollBy);

  return (
    <ScrollView
      ref={scrollRef}
      onScroll={(e) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={32}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <SettingsControls />
      <TourTarget id="settings-tour" style={styles.tourTarget}>
        <Pressable
          onPress={tour.start}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.tourButton,
            { borderColor: theme.colors.accent, backgroundColor: theme.colors.surface, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.tourButtonText, { color: theme.colors.accent }]}>{t("settingsHowToUse")}</Text>
        </Pressable>
      </TourTarget>
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
  tourTarget: {
    alignSelf: "flex-start",
  },
  tourButton: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
  },
  tourButtonText: {
    fontSize: typography.body,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: typography.small,
  },
});
