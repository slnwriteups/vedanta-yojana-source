import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { loadKnowledgeRecord } from "../../../content-lib/loader.ts";
import { DraftBadge } from "../../../components/DraftBadge";
import { ContentImage } from "../../../components/ContentImage";
import { Section } from "../../../components/Section";
import { layout, spacing, typography, useTheme } from "../../../theme";
import { localizeKnowledge } from "../../../../content-lib/i18n.ts";
import { useLanguage } from "../../../language-context.ts";
import { useT } from "../../../ui-strings.ts";

const INTRODUCTION_SLUG = "introduction";

/**
 * A static route co-located with [slug].tsx, resolving the exact same
 * "introduction" Knowledge record previously served from the (now
 * removed) Knowledge tab -- moved here because its own content serves
 * this section specifically, mirroring app/divya-desams/introduction/
 * page.tsx on the web.
 */
export default function DivyaDesamsIntroductionScreen() {
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const loaded = loadKnowledgeRecord(INTRODUCTION_SLUG);
  const record = loaded ? localizeKnowledge(loaded, language) : null;

  if (!record) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: t("notFoundTitle") }} />
        <Text style={[styles.empty, { color: theme.colors.muted }]}>{t("recordNotFound")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: record.title }} />
      <View style={styles.header}>
        <Text style={[styles.contentType, { color: theme.colors.accent }]}>{record.contentType}</Text>
        <DraftBadge status={record.status} needsReview={record.migration.needsReview} />
        <Text style={[styles.title, { color: theme.colors.foreground }]}>{record.title}</Text>
      </View>

      <ContentImage images={record.images} feature />

      {record.body ? (
        <Section text={record.body} />
      ) : (
        <Text style={[styles.empty, { color: theme.colors.muted }]}>{t("noRecordContentYet")}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    gap: spacing.xs,
  },
  contentType: {
    fontSize: typography.small,
    fontWeight: "700",
  },
  title: {
    fontSize: typography.title,
    fontWeight: "700",
  },
  empty: {
    fontSize: typography.body,
  },
});
