import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { ThemeProvider } from "../ThemeProvider";
import { ReadingPreferencesProvider } from "../ReadingPreferencesProvider";
import { LanguageProvider } from "../LanguageProvider";
import { ReadingPositionProvider } from "../ReadingPositionProvider";
import { BookmarksProvider } from "../BookmarksProvider";
import { WelcomeScreen } from "../components/WelcomeScreen";
import { OnboardingScreen } from "../components/OnboardingScreen";
import { ONBOARDED_STORAGE_KEY, isValidCompletedFlag } from "../content-lib/preferences.ts";
import { readJSON, writeJSON } from "../storage.ts";
import { ensurePasuramsUnpacked } from "../services/pasuramArchive.ts";

/**
 * Phase 6C -- the root layout hosts the ThemeProvider and a single Stack
 * screen for the "(tabs)" group; the actual navigation chrome (bottom
 * tabs, per-tab nested stacks) lives in app/(tabs)/_layout.tsx and each
 * tab's own _layout.tsx. `(tabs)` is an Expo Router GROUP directory --
 * its name in parentheses never appears in the URL, so every route from
 * Phase 6B (`/`, `/divya-desams`, `/divya-desams/[slug]`, `/library`,
 * `/library/[book]`, `/library/[book]/[chapter]`, `/search`) is unchanged
 * and every existing deep link still resolves (plus `/settings`, added
 * alongside the restored welcome/onboarding flow below). The former `/knowledge`
 * and `/knowledge/[slug]` routes were retired; the one real Knowledge
 * record now lives at the static `/divya-desams/introduction` route,
 * co-located with `/divya-desams/[slug]`.
 *
 * Phase 6D adds ReadingPreferencesProvider alongside ThemeProvider, and a
 * later phase adds LanguageProvider (the content-language toggle) as a
 * third -- all three persisted-preference providers load from
 * AsyncStorage once on mount (see ThemeProvider.tsx /
 * ReadingPreferencesProvider.tsx / LanguageProvider.tsx).
 *
 * The restored legacy launch screen (WelcomeScreen.tsx, mirroring web's
 * components/WelcomeGate.tsx) is gated on plain in-memory state, not a
 * persisted flag -- by design, it shows again every time the app is
 * fully closed and relaunched, not just once ever. A cold launch always
 * creates a fresh JS engine instance, so `useState(false)` already
 * starts "not seen" on every such launch with no read/write needed;
 * backgrounding and returning to the app (as opposed to closing it)
 * keeps this same component instance alive, so it correctly does NOT
 * reappear for that case.
 *
 * Right after Welcome, a SEPARATE one-time step (OnboardingScreen.tsx)
 * offers the Appearance/Text-size choice -- genuinely once ever, per
 * install, unlike Welcome, so it IS gated on a persisted AsyncStorage
 * flag (ONBOARDED_STORAGE_KEY). The read starts immediately on mount
 * (in parallel with Welcome being shown/dismissed), so it has almost
 * always already resolved by the time it's needed; the brief blank
 * fallback only matters on an unusually slow first read.
 */
function RootStack() {
  const theme = useTheme();
  const [seenWelcome, setSeenWelcome] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    readJSON(ONBOARDED_STORAGE_KEY, isValidCompletedFlag).then((stored) => {
      if (!cancelled) setOnboarded(stored === true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fire-and-forget, once per cold launch: unpacks the bundled Pasuram
  // archive into app-private storage if it isn't already current (see
  // services/pasuramArchive.ts). By the time a user has navigated to a
  // Divya Desam and tapped a Pasuram, this has almost always already
  // finished; openOfflinePasuram() also awaits it directly as a safety
  // net for a tap landing before that happens. Errors are deliberately
  // swallowed here -- a failure just means the next tap's own await
  // surfaces it as a real "not available" result instead of an unhandled
  // rejection with nothing listening.
  useEffect(() => {
    ensurePasuramsUnpacked().catch(() => {});
  }, []);

  if (!seenWelcome) {
    return <WelcomeScreen onDone={() => setSeenWelcome(true)} />;
  }

  if (onboarded === null) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  if (!onboarded) {
    return (
      <OnboardingScreen
        onDone={() => {
          setOnboarded(true);
          void writeJSON(ONBOARDED_STORAGE_KEY, true);
        }}
      />
    );
  }

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

/**
 * UI/UX pass: the app was locked to portrait (app.json's own
 * "orientation" field, now "default") -- but that static config only
 * fully takes effect in a real custom build; inside Expo Go itself
 * (a pre-built shell app, not rebuilt per-project) it's not honored on
 * its own, verified empirically by rotating the Simulator and finding
 * the app's own layout stayed portrait-shaped even though the device
 * chrome rotated. expo-screen-orientation's imperative unlockAsync()
 * is the reliable fix Expo's own docs point to for this exact gap --
 * called once here, at the true app root, so every screen (not just
 * the reading view) responds to rotation; the capped reading measure
 * (layout.maxContentWidth) already centers chapter text with wider
 * margins in landscape rather than stretching lines uncomfortably
 * wide, so no further per-screen change was needed for "the reading
 * experience is improved" by rotating.
 */
function useUnlockedOrientation() {
  useEffect(() => {
    void ScreenOrientation.unlockAsync();
  }, []);
}

export default function RootLayout() {
  useUnlockedOrientation();

  return (
    <ThemeProvider>
      <ReadingPreferencesProvider>
        <LanguageProvider>
          <ReadingPositionProvider>
            <BookmarksProvider>
              <SafeAreaProvider>
                <RootStack />
                <StatusBar style="auto" />
              </SafeAreaProvider>
            </BookmarksProvider>
          </ReadingPositionProvider>
        </LanguageProvider>
      </ReadingPreferencesProvider>
    </ThemeProvider>
  );
}
