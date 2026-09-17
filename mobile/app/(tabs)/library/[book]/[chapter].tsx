import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import type { Chapter } from "../../../../content-lib/loader.ts";
import { loadBook, loadChapter, loadChapters } from "../../../../content-lib/loader.ts";
import { findAdjacentChapters } from "../../../../content-lib/chapter-navigation.ts";
import { DraftBadge } from "../../../../components/DraftBadge";
import { ContentImage } from "../../../../components/ContentImage";
import { Section } from "../../../../components/Section";
import { layout, radius, spacing, typography, useTheme } from "../../../../theme";
import { sectionTint } from "../../../../section-tints.ts";
import { localizeBook, localizeChapter } from "../../../../../content-lib/i18n.ts";
import {
  estimateReadingMinutes,
  getTableOfContents,
  stripLeadingDuplicateTitle,
  type TableOfContentsEntry,
} from "../../../../../content-lib/text-format.ts";
import { useLanguage } from "../../../../language-context.ts";
import { useReadingPosition } from "../../../../reading-position-context.ts";
import { useBookmarks } from "../../../../bookmarks-context.ts";
import { chapterPositionLabel, minReadLabel, nowReadingAnnouncement, useT } from "../../../../ui-strings.ts";

/**
 * Phase 6C -- the reading-comfort pass the brief asks for: a capped
 * reading measure (layout.maxContentWidth, centered), generous vertical
 * rhythm between paragraphs (Section already applies
 * typography.readingLineHeight), and a clear chapter header separated
 * from the body by real space rather than a thin rule. The chapter text
 * itself is completely untouched -- Section still only splits on
 * existing blank lines, never rewrites/summarizes/alters anything.
 *
 * Phase 6D -- previous/next chapter navigation (content-lib/
 * chapter-navigation.ts's pure findAdjacentChapters, over the same
 * ascending `order` loadChapters() already returns -- never re-sorted).
 * router.replace (not push) so the back button still returns to the
 * book's chapter list after paging through several chapters, rather than
 * growing a long stack of visited chapters. AccessibilityInfo
 * .announceForAccessibility fires the new chapter's title so a
 * VoiceOver/TalkBack user gets a spoken navigation announcement, since a
 * replace-based route change doesn't move focus the way a fresh screen
 * push does.
 *
 * UI/UX pass, Kindle/Apple Books cues: a thin scroll-position progress
 * bar (tinted per book, section-tints.ts) fixed above the ScrollView,
 * and a "X min read" estimate (estimateReadingMinutes) alongside the
 * existing "Chapter X of Y" label -- both purely derived, nothing
 * fabricated. `key={chapterSlug}` on the ScrollView forces a clean
 * remount on every chapter change (via the pager's router.replace, which
 * otherwise reuses the same component instance) so both the native
 * scroll position and the progress bar correctly reset to the top of
 * the new chapter, rather than carrying over the previous chapter's
 * scroll depth.
 *
 * Gesture pass: swipe left/right anywhere on the page turns to the
 * next/previous chapter (Kindle/Apple Books convention -- swipe left
 * advances, matching left-to-right reading order), on top of the
 * existing tap-based Previous/Next pager. Built with PanResponder
 * (React Native core, no new dependency) rather than
 * react-native-gesture-handler, which isn't installed elsewhere in
 * this app. `onMoveShouldSetPanResponder` only claims the gesture once
 * horizontal movement is both clearly larger than vertical AND past a
 * real threshold, so it never steals an ordinary vertical scroll --
 * verified by keeping normal scrolling intact after adding this.
 * `adjacentRef` holds the latest previous/next (kept in sync every
 * render below) so the single PanResponder instance, created once via
 * useRef, never closes over stale chapter-adjacency data as the reader
 * pages through the book.
 *
 * Table-of-contents pass: requested directly -- "if there are sub
 * chapters, break them into standalone listings, seeing subchapters not
 * have a listing isnt looking good" -- but implemented as an in-chapter
 * jump-list, not as separate Library entries. Splitting a chapter into
 * real standalone chapters would mean editing chapterOrder and, far more
 * riskily, finding the equivalent split points in three already-
 * translated Tamil/Kannada/Hindi bodies that are not reliably paragraph-
 * aligned to the English source -- reviewed directly with the project
 * owner, who chose this lower-risk, purely presentational path instead.
 * getTableOfContents() (content-lib/text-format.ts) only renders when a
 * chapter actually has qualifying sections (about a fifth of the Library
 * corpus); tapping an entry scrolls to that paragraph via
 * paragraphRefs + measureLayout, entirely within the same chapter --
 * nothing about the content model, chapter count, or navigation
 * structure changes.
 *
 * Bookmark toggle: a header-right button (BookmarksProvider.tsx,
 * bookmarks-context.ts) explicitly saves/unsaves the WHOLE chapter --
 * deliberately separate from recordChapterView above, which is
 * automatic and single-slot ("last chapter viewed"). A bookmark is only
 * ever added/removed by this direct tap, never inferred from reading
 * activity, and Home's "Bookmarks" section can hold any number of them.
 * Rendered through ScreenHeader's standard `options.headerRight` slot
 * (see components/ScreenHeader.tsx) rather than a bespoke prop.
 */
const SWIPE_DISTANCE_THRESHOLD = 60;
export default function LibraryChapterScreen() {
  const { book: bookSlug, chapter: chapterSlug } = useLocalSearchParams<{
    book: string;
    chapter: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const { recordChapterView } = useReadingPosition();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [progress, setProgress] = useState(0);
  const loadedChapter = loadChapter(bookSlug, chapterSlug);
  const chapter = loadedChapter ? localizeChapter(loadedChapter, language) : null;
  const loadedBook = loadBook(bookSlug);
  const book = loadedBook ? localizeBook(loadedBook, language) : null;
  const tint = sectionTint(bookSlug, theme.scheme);
  const adjacentRef = useRef<{ previous: Chapter | null; next: Chapter | null }>({ previous: null, next: null });
  const scrollViewRef = useRef<ScrollView>(null);
  const paragraphRefs = useRef<Record<number, Text | null>>({});

  function jumpToSection(entry: TableOfContentsEntry) {
    void Haptics.selectionAsync();
    const node = paragraphRefs.current[entry.paragraphIndex];
    const scrollView = scrollViewRef.current;
    if (!node || !scrollView) return;
    // measureLayout's first argument must be a ref to the actual native
    // component it measures relative to -- findNodeHandle(scrollView)
    // fails under this app's New Architecture (newArchEnabled=true,
    // theme.ts/gradle.properties) with "ref.measureLayout must be called
    // with a ref to a native component", confirmed live on a physical
    // device. Passing the ScrollView ref itself (not a node-handle
    // number) is what actually works.
    node.measureLayout(
      scrollView as unknown as import("react-native").NativeMethods,
      (_x, y) => scrollView.scrollTo({ y: Math.max(0, y - spacing.lg), animated: true }),
      () => {
        // Best-effort: if the native measurement fails (e.g. the target
        // paragraph hasn't laid out yet), do nothing rather than throw --
        // the reader can still scroll manually.
      }
    );
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollable = contentSize.height - layoutMeasurement.height;
    setProgress(scrollable > 0 ? Math.min(1, Math.max(0, contentOffset.y / scrollable)) : 1);
  }

  function goTo(targetSlug: string, title: string) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace(`/library/${bookSlug}/${targetSlug}` as never);
    AccessibilityInfo.announceForAccessibility(nowReadingAnnouncement(language, title));
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        return Math.abs(gesture.dx) > SWIPE_DISTANCE_THRESHOLD && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2;
      },
      onPanResponderRelease: (_evt, gesture) => {
        const { previous, next } = adjacentRef.current;
        if (gesture.dx < 0 && next) {
          goTo(next.slug, next.title);
        } else if (gesture.dx > 0 && previous) {
          goTo(previous.slug, previous.title);
        }
      },
    })
  ).current;

  useEffect(() => {
    if (loadedChapter) recordChapterView(bookSlug, chapterSlug);
    // Depends on loadedChapter (loader.ts's cached, reference-stable
    // lookup), not the localized `chapter` below -- localizeChapter
    // builds a brand-new object on every render, so using it here would
    // re-fire this effect (and therefore recordChapterView's setState)
    // on every render, an infinite loop caught by React's "Maximum
    // update depth exceeded" the moment something (a scroll, a language
    // switch) re-rendered this screen a couple of times in a row.
    // recordChapterView is stable in shape across renders (see
    // ReadingPositionProvider's useMemo) but intentionally omitted from
    // deps -- including it would re-run this effect on every "Continue
    // Reading" save, which is itself triggered by this same effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookSlug, chapterSlug, loadedChapter]);

  if (!chapter) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: t("notFoundTitle") }} />
        <Text style={[styles.empty, { color: theme.colors.muted }]}>{t("chapterNotFound")}</Text>
      </View>
    );
  }

  const localizedChapters = loadChapters(bookSlug).map((c) => localizeChapter(c, language));
  const { previous, next } = findAdjacentChapters(localizedChapters, chapterSlug);
  adjacentRef.current = { previous, next };
  const position = localizedChapters.findIndex((c) => c.slug === chapterSlug);
  const displayBody = chapter.body ? stripLeadingDuplicateTitle(chapter.body, chapter.title) : chapter.body;
  const readingMinutes = displayBody ? estimateReadingMinutes(displayBody) : 0;
  const toc = displayBody ? getTableOfContents(displayBody, chapter.title) : [];
  const bookmarked = isBookmarked(bookSlug, chapterSlug);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]} {...panResponder.panHandlers}>
      <Stack.Screen
        options={{
          title: chapter.title,
          headerRight: () => (
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleBookmark(bookSlug, chapterSlug);
              }}
              accessibilityRole="button"
              accessibilityLabel={bookmarked ? t("bookmarkRemove") : t("bookmarkAdd")}
              hitSlop={spacing.sm}
              style={styles.bookmarkButton}
            >
              <Ionicons
                name={bookmarked ? "bookmark" : "bookmark-outline"}
                size={24}
                color={bookmarked ? tint : theme.colors.foreground}
              />
            </Pressable>
          ),
        }}
      />
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
        <View style={[styles.progressFill, { backgroundColor: tint, width: `${progress * 100}%` }]} />
      </View>
      <ScrollView
        key={chapterSlug}
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <DraftBadge status={chapter.status} needsReview={chapter.migration.needsReview} />
            {position !== -1 ? (
              <Text style={[styles.position, { color: theme.colors.muted }]}>
                {chapterPositionLabel(language, position + 1, localizedChapters.length)}
                {readingMinutes > 0 ? ` · ${minReadLabel(language, readingMinutes)}` : ""}
              </Text>
            ) : null}
          </View>
          {book ? (
            <Text
              style={[styles.bookLabel, { color: theme.colors.muted }]}
              numberOfLines={1}
              accessibilityRole="text"
            >
              {book.title}
            </Text>
          ) : null}
          <Text style={[styles.title, { color: theme.colors.foreground }]}>{chapter.title}</Text>
        </View>

        {toc.length > 0 ? (
          <View style={[styles.toc, { borderColor: theme.colors.border }]}>
            <Text style={[styles.tocLabel, { color: theme.colors.muted }]}>{t("tableOfContentsLabel")}</Text>
            {toc.map((entry) => (
              <Pressable
                key={entry.paragraphIndex}
                onPress={() => jumpToSection(entry)}
                accessibilityRole="button"
                accessibilityLabel={entry.label}
                style={styles.tocRow}
              >
                <Text style={[styles.tocEntry, { color: theme.colors.accent }]}>{entry.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <ContentImage images={chapter.images} />

        {displayBody ? (
          <Section text={displayBody} paragraphRefs={paragraphRefs} />
        ) : (
          <Text style={[styles.empty, { color: theme.colors.muted }]}>
            {t("noChapterContentYet")}
          </Text>
        )}

        {previous || next ? (
          <View style={styles.pager}>
            {previous ? (
              <Pressable
                onPress={() => goTo(previous.slug, previous.title)}
                accessibilityRole="button"
                accessibilityLabel={`Previous chapter: ${previous.title}`}
                style={[styles.pagerButton, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.pagerDirection, { color: theme.colors.muted }]}>{t("pagerPrevious")}</Text>
                <Text style={[styles.pagerTitle, { color: theme.colors.accent }]} numberOfLines={3}>
                  {previous.title}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.pagerButton} />
            )}
            {next ? (
              <Pressable
                onPress={() => goTo(next.slug, next.title)}
                accessibilityRole="button"
                accessibilityLabel={`Next chapter: ${next.title}`}
                style={[styles.pagerButton, styles.pagerButtonEnd, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.pagerDirection, { color: theme.colors.muted }]}>{t("pagerNext")}</Text>
                <Text style={[styles.pagerTitle, { color: theme.colors.accent }]} numberOfLines={3}>
                  {next.title}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.pagerButton} />
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  bookmarkButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 3,
    width: "100%",
  },
  progressFill: {
    height: 3,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: layout.screenPadding,
    paddingBottom: layout.tabBarClearance,
    gap: spacing.xl,
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  position: {
    fontSize: typography.eyebrow,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  bookLabel: {
    fontSize: typography.small,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "700",
  },
  empty: {
    fontSize: typography.body,
  },
  toc: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tocLabel: {
    fontSize: typography.eyebrow,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  tocRow: {
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
  },
  tocEntry: {
    fontSize: typography.body,
    fontWeight: "600",
  },
  pager: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  pagerButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: layout.minTouchTarget,
    gap: spacing.xs,
  },
  pagerButtonEnd: {
    alignItems: "flex-end",
  },
  pagerDirection: {
    fontSize: typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pagerTitle: {
    fontSize: typography.small,
    fontWeight: "600",
  },
});
