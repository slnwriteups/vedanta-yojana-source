import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { ContentCard } from "../../../components/ContentCard";
import { DraftBadge } from "../../../components/DraftBadge";
import { BookDownloadControl } from "../../../components/BookDownloadControl";
import { layout, spacing, typography, useTheme } from "../../../theme";
import { sectionTint } from "../../../section-tints.ts";
import { localizeBook, localizeChapterSummary } from "../../../../content-lib/i18n.ts";
import { useLanguage } from "../../../language-context.ts";
import { downloadBook, isBookAvailable } from "../../../services/bookOfflineService.ts";
import { chapterOrdinalLabel, useT } from "../../../ui-strings.ts";
import { getLibraryCatalogEntry, syncLibraryCatalog } from "../../../services/libraryCatalogService.ts";
import type { CatalogEntry } from "../../../services/libraryCatalogCore.ts";
import type { ChapterSummary } from "../../../content-lib/loader.ts";

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
 *
 * Content-update architecture: resolves this book from the merged
 * catalog (services/libraryCatalogService.ts), not the bundled-only
 * loadBook()/loadChapters() -- a slug the remote manifest knows about
 * but this APK build's bundled snapshot never bundled (a genuinely new
 * book) must still open correctly here, with no app update. Also
 * re-runs syncLibraryCatalog() on mount as a safety net for someone
 * deep-linking straight to a brand new book's URL before the Library
 * index screen's own sync has ever run in this session.
 *
 * Read-online-then-download: a chapter row is never permanently gated
 * behind the explicit Download button in BookDownloadControl.tsx above
 * it -- tapping any chapter of a book that isn't downloaded yet
 * transparently fetches the whole book (the same downloadBook() the
 * button itself calls) and opens straight into that chapter once it
 * lands, so reading online never requires a separate, deliberate
 * "download first" step. That fetch also PERSISTS the book locally as a
 * side effect (there is no lighter-weight "view without saving" path in
 * this architecture -- the book payload is fetched as one unit either
 * way), so the very next chapter opens instantly and the book keeps
 * working offline afterward. Offline, with no cached copy, the fetch
 * simply fails and the tap surfaces that inline rather than opening
 * anything -- there is no server to silently fall back to.
 */
export default function LibraryBookScreen() {
  const { book: bookSlug } = useLocalSearchParams<{ book: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  // Hook calls must stay unconditional (before the `if (!entry)` early
  // return below), even though bookSlug can't meaningfully change
  // without this whole screen remounting via expo-router.
  const [downloaded, setDownloaded] = useState(() => isBookAvailable(bookSlug));
  const [entry, setEntry] = useState<CatalogEntry | null>(() => getLibraryCatalogEntry(bookSlug));
  const [openingSlug, setOpeningSlug] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    syncLibraryCatalog().then(() => {
      if (!cancelled) setEntry(getLibraryCatalogEntry(bookSlug));
    });
    return () => {
      cancelled = true;
    };
  }, [bookSlug]);

  const book = entry ? localizeBook(entry.book, language) : null;

  if (!book || !entry) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: t("notFoundTitle") }} />
        <Text style={[styles.empty, { color: theme.colors.muted }]}>{t("bookNotFound")}</Text>
      </View>
    );
  }

  const chapters = entry.chapters.map((c) => localizeChapterSummary(c, language));
  const tint = sectionTint(book.slug, theme.scheme);

  async function openChapter(chapterSlug: string) {
    if (!downloaded) {
      setOpenError(null);
      setOpeningSlug(chapterSlug);
      const result = await downloadBook(book!.slug);
      setOpeningSlug(null);
      if (!result.success) {
        setOpenError(result.error ?? null);
        return;
      }
      setDownloaded(true);
    }
    router.push(`/library/${book!.slug}/${chapterSlug}` as never);
  }

  function renderItem({ item, index }: { item: ChapterSummary; index: number }) {
    return (
      <ContentCard
        title={item.title}
        subtitle={openingSlug === item.slug ? t("bookDownloading") : chapterOrdinalLabel(language, index + 1)}
        status={item.status}
        needsReview={item.migration.needsReview}
        tintColor={tint}
        disabled={openingSlug !== null}
        onPress={() => openChapter(item.slug)}
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
        {openError ? (
          <Text style={[styles.openError, { color: theme.colors.foreground }]} numberOfLines={2}>
            {t("bookDownloadFailed")}
            {openError ? `: ${openError}` : ""}
          </Text>
        ) : null}
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
  openError: {
    fontSize: typography.small,
  },
  empty: {
    padding: layout.screenPadding,
    fontSize: typography.body,
  },
});
