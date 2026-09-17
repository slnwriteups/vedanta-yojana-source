import { useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { loadBook, loadChapters, type ChapterSummary } from "../../../content-lib/loader.ts";
import { ContentCard } from "../../../components/ContentCard";
import { DraftBadge } from "../../../components/DraftBadge";
import { BookDownloadControl } from "../../../components/BookDownloadControl";
import { layout, spacing, typography, useTheme } from "../../../theme";
import { sectionTint } from "../../../section-tints.ts";
import { localizeBook, localizeChapterSummary } from "../../../../content-lib/i18n.ts";
import { useLanguage } from "../../../language-context.ts";
import { isBookAvailable } from "../../../services/bookOfflineService.ts";
import { chapterOrdinalLabel, useT } from "../../../ui-strings.ts";

/**
 * Phase 6C -- unchanged ordering/data behavior from Phase 6B (chapters
 * stay in their own ascending `order`, never re-sorted), theme-aware
 * styling only.
 *
 * UI/UX pass: this book's section-tints.ts color carries through from
 * the Library index (same tint, same monogram letter absent since a
 * chapter list doesn't need one) as the title color and every chapter
 * row's edge stripe -- one consistent thread of color per book, not
 * just on its index card.
 */
export default function LibraryBookScreen() {
  const { book: bookSlug } = useLocalSearchParams<{ book: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  // Hook call must stay unconditional (before the `if (!book)` early
  // return below), even though bookSlug can't meaningfully change
  // without this whole screen remounting via expo-router.
  const [downloaded, setDownloaded] = useState(() => isBookAvailable(bookSlug));
  const loadedBook = loadBook(bookSlug);
  const book = loadedBook ? localizeBook(loadedBook, language) : null;

  if (!book) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: t("notFoundTitle") }} />
        <Text style={[styles.empty, { color: theme.colors.muted }]}>{t("bookNotFound")}</Text>
      </View>
    );
  }

  const chapters = loadChapters(book.slug).map((c) => localizeChapterSummary(c, language));
  const tint = sectionTint(book.slug, theme.scheme);

  function renderItem({ item, index }: { item: ChapterSummary; index: number }) {
    return (
      <ContentCard
        title={item.title}
        subtitle={chapterOrdinalLabel(language, index + 1)}
        status={item.status}
        needsReview={item.migration.needsReview}
        tintColor={tint}
        disabled={!downloaded}
        onPress={downloaded ? () => router.push(`/library/${book!.slug}/${item.slug}` as never) : undefined}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: book.title }} />
      <View style={styles.header}>
        <DraftBadge status={book.status} needsReview={book.migration.needsReview} />
        <Text style={[styles.title, { color: tint }]}>{book.title}</Text>
        {book.description ? (
          <Text style={[styles.description, { color: theme.colors.muted }]}>{book.description}</Text>
        ) : null}
        <BookDownloadControl bookSlug={book.slug} onAvailabilityChange={setDownloaded} />
      </View>
      {chapters.length > 0 ? (
        <FlatList
          data={chapters}
          keyExtractor={(item) => item.slug}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      ) : (
        <Text style={[styles.empty, { color: theme.colors.muted }]}>{t("noChaptersYet")}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: layout.screenPadding,
    gap: spacing.xs,
  },
  list: {
    paddingTop: spacing.md,
    paddingBottom: layout.tabBarClearance,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "700",
  },
  description: {
    fontSize: typography.body,
  },
  empty: {
    padding: layout.screenPadding,
    fontSize: typography.body,
  },
});
