import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { ContentCard } from "../../../components/ContentCard";
import { layout, spacing, typography, useTheme } from "../../../theme";
import { sectionTint } from "../../../section-tints.ts";
import { bookCoverAsset } from "../../../book-covers.ts";
import { localizeBook } from "../../../../content-lib/i18n.ts";
import { useLanguage } from "../../../language-context.ts";
import { chapterCountLabel, useT } from "../../../ui-strings.ts";
import { getLibraryCatalog, syncLibraryCatalog } from "../../../services/libraryCatalogService.ts";
import type { CatalogEntry } from "../../../services/libraryCatalogCore.ts";

/**
 * Phase 6C -- unchanged data behavior from Phase 6B, theme-aware
 * styling only.
 *
 * UI/UX pass: each book gets its own section-tints.ts color as a
 * matching card-edge stripe -- since a book's chapter list
 * ([book].tsx) carries the same tint through, the color becomes a
 * consistent visual thread from the Library index into that book's
 * own chapters. Books with real cover art (book-covers.ts) show it;
 * the remaining monogram swatch is only a fallback for a book with no
 * cover on file, never invented.
 *
 * Content-update architecture: getLibraryCatalog() starts from the
 * bundled catalog (always available, even on a fresh offline install)
 * and reads only the LOCALLY CACHED remote manifest, so the initial
 * render never blocks on or requires network. syncLibraryCatalog() then
 * runs fire-and-forget -- fetches the real manifest, silently
 * refreshes any already-downloaded book whose content changed, and (via
 * the re-read below) surfaces a brand new book straight into this list,
 * with no app update, the moment it's reachable. See
 * services/libraryCatalogCore.ts's own doc comment for the full design.
 */
export default function LibraryIndexScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const [catalog, setCatalog] = useState<CatalogEntry[]>(() => getLibraryCatalog());

  useEffect(() => {
    let cancelled = false;
    syncLibraryCatalog().then(() => {
      if (!cancelled) setCatalog(getLibraryCatalog());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function renderItem({ item }: { item: CatalogEntry }) {
    const book = localizeBook(item.book, language);
    const tint = sectionTint(book.slug, theme.scheme);
    return (
      <ContentCard
        title={book.title}
        subtitle={chapterCountLabel(language, item.chapters.length)}
        status={book.status}
        needsReview={book.migration.needsReview}
        tintColor={tint}
        imageAsset={bookCoverAsset(book.slug)}
        monogram={book.title.trim().charAt(0).toUpperCase()}
        variant="cover"
        onPress={() => router.push(`/library/${book.slug}` as never)}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t("tabLibrary") }} />
      {catalog.length > 0 ? (
        <FlatList
          data={catalog}
          keyExtractor={(item) => item.book.slug}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      ) : (
        <Text style={[styles.empty, { color: theme.colors.muted }]}>{t("noBooksYet")}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    paddingTop: spacing.md,
    paddingBottom: layout.tabBarClearance,
  },
  empty: {
    padding: layout.screenPadding,
    fontSize: typography.body,
  },
});
