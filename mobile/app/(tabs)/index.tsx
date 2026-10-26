import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { resolveAllLastRead } from "../../content-lib/reading-position.ts";
import { ContentCard } from "../../components/ContentCard";
import { HomeHeader } from "../../components/HomeHeader";
import { ContinueReadingCard } from "../../components/ContinueReadingCard";
import { DivyaDesamSpotlight } from "../../components/DivyaDesamSpotlight";
import { PanchangamCalendar } from "../../components/PanchangamCalendar";
import { UpdateBanner } from "../../components/UpdateBanner";
import { WhatsNewList } from "../../components/WhatsNewList";
import { layout, spacing, typography, useTheme } from "../../theme";
import { sectionTint } from "../../section-tints.ts";
import { bookCoverAsset } from "../../book-covers.ts";
import { useLanguage } from "../../language-context.ts";
import { useT } from "../../ui-strings.ts";
import { useReadingPosition } from "../../reading-position-context.ts";
import { fetchPanchangam, type PanchangamData } from "../../services/panchangamService.ts";
import { loadPanchangamPlace, usePanchangamPlace } from "../../services/panchangamPlaceStore.ts";
import { checkForUpdate, type UpdateInfo } from "../../services/updateCheckService.ts";
import { useAnnouncements } from "../../services/announcementsService.ts";
import { loadOfflineBook } from "../../services/bookOfflineService.ts";
import { useTourScroller } from "../../tour/Tour";

/**
 * UI/UX refactor: Home is now a proper dashboard rather than a plain
 * scrolling menu -- a greeting + live Panchangam banner (HomeHeader,
 * services/panchangamService.ts), a "Continue Reading" hero card with a
 * real progress bar, a horizontally-scrolling "Explore Themes" shelf
 * over the real Library catalog, and a full-width, day-rotated Divya
 * Desam spotlight -- each its own file under components/, all reading
 * from the SAME existing datasets/loaders every other screen uses
 * (content-lib/loader.ts), never a hardcoded/duplicated list. A Daily
 * Verse section was explicitly out of scope for this pass and is not
 * present.
 *
 * The Panchangam fetch is owned here, once, and passed down to both
 * HomeHeader and SankalpamCard as a plain prop -- avoids two components
 * independently re-fetching (and re-reading the same AsyncStorage cache
 * key) for the same day's data.
 *
 * "Continue Reading" still only appears once a reading position exists
 * (ReadingPositionProvider, recorded from library/[book]/[chapter].tsx);
 * with no history yet, Home falls back to the same "Get Started" pair
 * of entry points (Divya Desams, Library) as before. "Bookmarks" is
 * unchanged from the prior Home and still renders below everything else
 * when at least one bookmark resolves.
 */
export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const { lastReadByBook } = useReadingPosition();
  const resolvedList = resolveAllLastRead(lastReadByBook, language, loadOfflineBook);
  const announcements = useAnnouncements();

  // Today's Panchangam for the chosen city, or the phone's location when
  // none is chosen; recomputed when the reader changes the city, and when
  // it stops being current (its Sankalpam's validity ends, or midnight) --
  // so a screen left open never shows a stale Sankalpam as the present one.
  const [panchangam, setPanchangam] = useState<PanchangamData | null>(null);
  const [refreshes, setRefreshes] = useState(0);
  const { place, ready: placeReady } = usePanchangamPlace();
  useEffect(() => {
    void loadPanchangamPlace();
  }, []);
  useEffect(() => {
    setPanchangam(null);
  }, [place]);
  useEffect(() => {
    if (!placeReady) return;
    let cancelled = false;
    fetchPanchangam(undefined, place).then((data) => {
      if (!cancelled) setPanchangam(data);
    });
    return () => {
      cancelled = true;
    };
  }, [place, placeReady, refreshes]);
  const currentUntil = panchangam?.currentUntil;
  useEffect(() => {
    if (currentUntil === undefined) return;
    const refresh = () => setRefreshes((n) => n + 1);
    // Coming back to the app recomputes: timers don't run in the background, and the
    // reader may have moved since (the location is read again).
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    const timer = setTimeout(refresh, Math.max(0, currentUntil - Date.now()) + 1000);
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [currentUntil]);

  // This app is distributed as a direct-download APK, not through
  // Google Play, so there's no OS-level background update -- checked
  // once per app launch (never blocking startup: null just means
  // "already current" or "couldn't check", not an error) and dismissed
  // for the rest of this session if the reader taps the ✕.
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    checkForUpdate().then((info) => {
      if (!cancelled) setUpdate(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The "How to use the app" tour scrolls Home to the Panchangam controls it points at.
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const scrollBy = useCallback((dy: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + dy), animated: true });
  }, []);
  useTourScroller(scrollBy);

  return (
    <ScrollView
      ref={scrollRef}
      onScroll={(e) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={32}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {update && !updateDismissed ? (
        <UpdateBanner update={update} onDismiss={() => setUpdateDismissed(true)} />
      ) : null}
      <HomeHeader panchangam={panchangam} />

      {resolvedList.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>{t("homeContinueReadingLabel")}</Text>
          {resolvedList.map((resolved) => (
            <ContinueReadingCard
              key={resolved.bookSlug}
              chapterTitle={resolved.chapterTitle}
              bookTitle={resolved.bookTitle}
              imageAsset={bookCoverAsset(resolved.bookSlug)}
              tintColor={sectionTint(resolved.bookSlug, theme.scheme)}
              monogram={resolved.bookTitle.trim().charAt(0).toUpperCase()}
              position={resolved.chapterPosition}
              total={resolved.totalChapters}
              minutesLeft={resolved.minutesLeft}
              kind={resolved.kind}
              onPress={() => router.push(`/library/${resolved.bookSlug}/${resolved.chapterSlug}` as never)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>{t("homeGetStartedLabel")}</Text>
          <ContentCard
            title={t("tabDivyaDesams")}
            subtitle={t("divyaDesamsCardSubtitle")}
            tintColor={sectionTint("divya-desams", theme.scheme)}
            monogram="D"
            onPress={() => router.push("/divya-desams" as never)}
          />
          <ContentCard
            title={t("tabLibrary")}
            subtitle={t("libraryCardSubtitle")}
            tintColor={theme.colors.accent}
            monogram="L"
            onPress={() => router.push("/library" as never)}
          />
        </View>
      )}

      {announcements.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>{t("whatsNewLabel")}</Text>
          <View style={styles.whatsNew}>
            <WhatsNewList announcements={announcements} limit={2} />
            <Pressable onPress={() => router.push("/whats-new" as never)} accessibilityRole="link" hitSlop={spacing.sm}>
              <Text style={[styles.seeAll, { color: theme.colors.accent }]}>{t("whatsNewSeeAll")} →</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <DivyaDesamSpotlight />

      <PanchangamCalendar initialPanchangam={panchangam} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: layout.tabBarClearance,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.xs,
  },
  whatsNew: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
  seeAll: {
    fontSize: typography.small,
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: layout.screenPadding,
  },
});
