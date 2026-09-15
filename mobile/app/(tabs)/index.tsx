import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { resolveAllLastRead } from "../../content-lib/reading-position.ts";
import { ContentCard } from "../../components/ContentCard";
import { HomeHeader } from "../../components/HomeHeader";
import { ContinueReadingCard } from "../../components/ContinueReadingCard";
import { DivyaDesamSpotlight } from "../../components/DivyaDesamSpotlight";
import { PanchangamCard } from "../../components/PanchangamCard";
import { SankalpamCard } from "../../components/SankalpamCard";
import { UpdateBanner } from "../../components/UpdateBanner";
import { layout, spacing, typography, useTheme } from "../../theme";
import { sectionTint } from "../../section-tints.ts";
import { bookCoverAsset } from "../../book-covers.ts";
import { useLanguage } from "../../language-context.ts";
import { useT } from "../../ui-strings.ts";
import { useReadingPosition } from "../../reading-position-context.ts";
import { fetchAhobilaPanchangam, type PanchangamData } from "../../services/panchangamService.ts";
import { checkForUpdate, type UpdateInfo } from "../../services/updateCheckService.ts";

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
  const resolvedList = resolveAllLastRead(lastReadByBook, language);

  const [panchangam, setPanchangam] = useState<PanchangamData | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchAhobilaPanchangam().then((data) => {
      if (!cancelled) setPanchangam(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <ScrollView
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

      <DivyaDesamSpotlight />
      <PanchangamCard panchangam={panchangam} />
      <SankalpamCard panchangam={panchangam} />
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
  sectionLabel: {
    fontSize: typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: layout.screenPadding,
  },
});
