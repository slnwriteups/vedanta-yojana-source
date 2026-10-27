import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GridTile } from "../../../components/GridTile";
import { layout, spacing, typography, useTheme } from "../../../theme";
import { sectionTint } from "../../../section-tints.ts";
import { bookCoverAsset } from "../../../book-covers.ts";
import { localizeBook } from "../../../../content-lib/i18n.ts";
import { useLanguage } from "../../../language-context.ts";
import { libraryEntryCountLabel, useT } from "../../../ui-strings.ts";
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

  // Books first, then the author's blog series (book.kind === "blog") under
  // their own heading -- the same two shelves as the web Library. The Books
  // heading only appears once there is a Blogs shelf to tell it apart from.
  const books = catalog.filter((entry) => entry.book.kind !== "blog");
  const blogs = catalog.filter((entry) => entry.book.kind === "blog");

  function shelf(entries: CatalogEntry[], heading: "libraryBooksHeading" | "libraryBlogsHeading" | null) {
    if (entries.length === 0) return null;
    return (
      <View style={styles.shelf}>
        {heading ? (
          <Text style={[styles.heading, { color: theme.colors.foreground }]} accessibilityRole="header">
            {t(heading)}
          </Text>
        ) : null}
        <View style={styles.grid}>
          {entries.map((item) => {
            const book = localizeBook(item.book, language);
            return (
              <GridTile
                key={book.slug}
                title={book.title}
                subtitle={libraryEntryCountLabel(language, item.book.kind, item.chapters.length)}
                status={book.status}
                needsReview={book.migration.needsReview}
                imageAsset={bookCoverAsset(book.slug)}
                tintColor={sectionTint(book.slug, theme.scheme)}
                fallbackText={book.title.trim().charAt(0).toUpperCase()}
                variant="cover"
                onPress={() => router.push(`/library/${book.slug}` as never)}
              />
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t("tabLibrary") }} />
      {catalog.length > 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
          {shelf(books, blogs.length > 0 ? "libraryBooksHeading" : null)}
          {shelf(blogs, "libraryBlogsHeading")}
        </ScrollView>
      ) : (
        <Text style={[styles.empty, { color: theme.colors.muted }]}>{t("noBooksYet")}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    paddingTop: spacing.lg,
    paddingBottom: layout.tabBarClearance,
    paddingHorizontal: layout.screenPadding,
    gap: spacing.xxl,
  },
  shelf: {
    gap: spacing.lg,
  },
  heading: {
    fontSize: typography.title,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.xl,
  },
  empty: {
    padding: layout.screenPadding,
    fontSize: typography.body,
  },
});
