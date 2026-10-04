import { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Updates from "expo-updates";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { ThemeProvider } from "../ThemeProvider";
import { ReadingPreferencesProvider } from "../ReadingPreferencesProvider";
import { LanguageProvider } from "../LanguageProvider";
import { ReadingPositionProvider } from "../ReadingPositionProvider";
import { useLanguage } from "../language-context.ts";
import { reportScreen } from "../services/readingPingService.ts";
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

/**
 * expo-updates on its own only checks for an OTA update during a cold
 * start, and applies what it downloaded on the NEXT cold start. Android
 * keeps the app alive in the background, so a reader who reopens it from
 * recents never cold-starts it and can sit on an old update for days
 * (seen on a device two updates behind the published one). This checks
 * again whenever the app comes back to the foreground (at most once per
 * UPDATE_CHECK_INTERVAL_MS), downloads anything new, and reloads onto a
 * downloaded update the next time the app is foregrounded -- the moment
 * the reader is arriving rather than mid-read, and ReadingPositionProvider
 * has already persisted where they were. Never runs in development, and
 * never throws: a failed check just waits for the next one.
 */
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

function useForegroundUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    let lastCheckedAt = 0;
    let checking = false;
    let downloaded = false;

    async function checkAndFetch() {
      if (checking || downloaded || Date.now() - lastCheckedAt < UPDATE_CHECK_INTERVAL_MS) return;
      checking = true;
      lastCheckedAt = Date.now();
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          const result = await Updates.fetchUpdateAsync();
          downloaded = result.isNew;
        }
      } catch {
        // Offline or the update server is unreachable -- retry on a later foreground.
      } finally {
        checking = false;
      }
    }

    void checkAndFetch();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (downloaded) {
        void Updates.reloadAsync().catch(() => {});
        return;
      }
      void checkAndFetch();
    });
    return () => subscription.remove();
  }, []);
}

/**
 * Reports each screen the reader opens and the screen before it, so the
 * Library can be written toward what is actually read. Totals only: no
 * identifier, nothing stored, and one hop per row rather than a trail --
 * see services/readingPingService.ts, which is also where the
 * Android-only gate lives.
 *
 * It sits inside LanguageProvider so the content language travels with
 * the screen, and reports once per route: a language change on a screen
 * already open is not another view of it.
 */
function ScreenReporting() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const previous = useRef("");
  const reported = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || reported.current === pathname) return;
    reported.current = pathname;
    const from = previous.current;
    previous.current = pathname;
    reportScreen(pathname, from, language);
    // `language` is read, not a dependency, for the reason above.
  }, [pathname]);

  return null;
}

export default function RootLayout() {
  useUnlockedOrientation();
  useForegroundUpdates();

  return (
    <ThemeProvider>
      <ReadingPreferencesProvider>
        <LanguageProvider>
          <ReadingPositionProvider>
            <BookmarksProvider>
              <SafeAreaProvider>
                <ScreenReporting />
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
