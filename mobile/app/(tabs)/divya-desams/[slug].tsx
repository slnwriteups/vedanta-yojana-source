import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { loadDivyaDesam } from "../../../content-lib/loader.ts";
import type { TempleInformation as TempleInformationData } from "../../../../content-lib/schemas/index.ts";
import { DraftBadge } from "../../../components/DraftBadge";
import { Section } from "../../../components/Section";
import { ContentImage } from "../../../components/ContentImage";
import { SthalaPuranamWithImages } from "../../../components/SthalaPuranamWithImages";
import { ResourceLink } from "../../../components/ResourceLink";
import { PasuramResource } from "../../../components/PasuramResource";
import { layout, radius, spacing, typography, useTheme } from "../../../theme";
import {
  extractSpecialNote,
  isListItemLine,
  isVerseLine,
  looksLikeSubheading,
  paragraphsForReading,
} from "../../../../content-lib/text-format.ts";
import { localizeDivyaDesam } from "../../../../content-lib/i18n.ts";
import { useLanguage } from "../../../language-context.ts";
import { shrineLocationsHeading, shrineOrdinalLabel, translateUi, useT, type UiStringKey } from "../../../ui-strings.ts";

/**
 * Phase 6C's original reading-layout order pulled the first resolvable
 * image out as a large 4:3 "hero" above Temple Information, with every
 * other image rendered much smaller in the "Images" section further
 * down. Reported as looking broken -- the first picture rendered "blown
 * up out of proportion" relative to the rest -- so all images now render
 * uniformly (same size) via ContentImage, with no image singled out.
 *
 * Post-Phase-6E-C follow-up (1): images were also all clustered into one
 * block regardless of where the source actually placed them. Each
 * image's `placement` field (content-lib/schemas/shared.ts) now splits
 * them into a top group (the source's default position, most images)
 * and an after-Sthala-Puranam group -- e.g. Singavelkundram/Ahobilam's
 * nine Narasimha-shrine photos, which the source places alongside that
 * narrative, not before it.
 *
 * Post-Phase-6E-C follow-up (2): the after-Sthala-Puranam group was
 * still one undifferentiated cluster for records with SEVERAL named
 * sub-sections. SthalaPuranamWithImages renders those images next to
 * the specific line (`placementAnchor`) they belong after, when the
 * source identifies one; images with no anchor still render as a
 * trailing group, unchanged.
 *
 * Every section stays independently optional (Phase 6B's behavior,
 * unchanged): Page93 (no images) and the multi-shrine records still
 * render as intentional pages, and Page150 is still structurally
 * unreachable -- loadDivyaDesam() only ever resolves one of the 107
 * real slugs.
 */

const TEMPLE_FIELD_LABEL_KEYS: Record<keyof TempleInformationData, UiStringKey> = {
  moolavar: "fieldMoolavar",
  thayaar: "fieldThayaar",
  vimanam: "fieldVimanam",
  theertham: "fieldTheertham",
  travelNote: "fieldTravelNote",
};

const TEMPLE_FIELD_ORDER: (keyof TempleInformationData)[] = [
  "moolavar",
  "thayaar",
  "vimanam",
  "theertham",
  "travelNote",
];

/**
 * A single templeInformation field's value (moolavar/thayaar/vimanam/
 * theertham/travelNote) -- usually one short line, but some records embed
 * a source-flagged "special note" paragraph after it (e.g. tirukalvanoor's
 * theertham: "Nitya Pushkariṇī" then a separate aside about which temple
 * complex it sits within). Paragraph-split so that note is detected and
 * given its own callout regardless of where in the field it falls.
 */
function TempleFieldValue({ value }: { value: string }) {
  const theme = useTheme();
  const { language } = useLanguage();
  return (
    <>
      {paragraphsForReading(value).map((paragraph, index) => {
        const specialNote = extractSpecialNote(paragraph);
        if (specialNote !== null) {
          return (
            <View
              key={index}
              style={[styles.specialNote, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}
            >
              <Text style={[styles.specialNoteLabel, { color: theme.colors.accent }]}>
                {translateUi("specialNoteLabel", language)}
              </Text>
              <Text style={[styles.templeValue, { color: theme.colors.foreground, marginTop: 0 }]}>{specialNote}</Text>
            </View>
          );
        }
        return (
          <Text key={index} style={[styles.templeValue, { color: theme.colors.foreground }]}>
            {paragraph}
          </Text>
        );
      })}
    </>
  );
}

/** Same special-note-aware paragraph rendering as Section.tsx, for the two shrine-level free-text fields (sthalaPuranam/azhwarPasuram) that don't route through <Section> here. */
function ParagraphsWithNotes({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  const theme = useTheme();
  const { language } = useLanguage();
  const paragraphs = paragraphsForReading(text);
  return (
    <>
      {paragraphs.map((paragraph, index) => {
        const specialNote = extractSpecialNote(paragraph);
        if (specialNote !== null) {
          return (
            <View
              key={`${keyPrefix}-${index}`}
              style={[styles.specialNote, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}
            >
              <Text style={[styles.specialNoteLabel, { color: theme.colors.accent }]}>
                {translateUi("specialNoteLabel", language)}
              </Text>
              <Text style={[styles.templeValue, { color: theme.colors.foreground, marginTop: 0 }]}>{specialNote}</Text>
            </View>
          );
        }
        const bold = (looksLikeSubheading(paragraph) && !isListItemLine(paragraph)) || isVerseLine(paragraphs, index);
        return (
          <Text
            key={`${keyPrefix}-${index}`}
            style={[styles.templeValue, bold && styles.templeValueSubheading, { color: theme.colors.foreground }]}
          >
            {paragraph}
          </Text>
        );
      })}
    </>
  );
}

export default function DivyaDesamDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const loaded = loadDivyaDesam(slug);
  const record = loaded ? localizeDivyaDesam(loaded, language) : null;

  if (!record) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: t("notFoundTitle") }} />
        <Text style={[styles.notFound, { color: theme.colors.muted }]}>{t("divyaDesamNotFound")}</Text>
      </View>
    );
  }

  const presentTempleFields = TEMPLE_FIELD_ORDER.filter((key) => record.templeInformation[key]);

  // Phase 6E-C: shrines that carry their OWN name/templeInformation/prose
  // (currently only Tanjai Mamanikoyil and Tiruvaali Tirunagari) render an
  // extra per-shrine block here; every other record's shrines[] has none
  // of these fields, so this list is empty and nothing extra renders.
  const detailedShrines = record.shrines.filter(
    (s) => s.name || s.templeInformation || s.sthalaPuranam || s.azhwarPasuram
  );

  // Most images keep the source's own top-of-page position ("default").
  // A minority (per record) were placed AFTER Sthala Puranam in the
  // original source and render there instead of in one cluster.
  const topImages = record.images.filter((img) => img.placement !== "after-sthala-puranam");
  const afterSthalaPuranamImages = record.images.filter((img) => img.placement === "after-sthala-puranam");

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: record.displayName }} />

      <View style={styles.header}>
        <DraftBadge status={record.status} needsReview={record.migration.needsReview} />
        <Text style={[styles.title, { color: theme.colors.foreground }]}>{record.displayName}</Text>
      </View>

      <ContentImage images={topImages} />

      {presentTempleFields.length > 0 ? (
        <Section heading={t("templeInformationHeading")}>
          <View style={styles.templeInfo}>
            {presentTempleFields.map((key) => {
              return (
                <View key={key}>
                  <Text style={[styles.templeLabel, { color: theme.colors.muted }]}>
                    {translateUi(TEMPLE_FIELD_LABEL_KEYS[key], language)}
                  </Text>
                  <TempleFieldValue value={record.templeInformation[key] ?? ""} />
                </View>
              );
            })}
          </View>
        </Section>
      ) : null}

      {/* Kept right beside Temple Information's own "How to reach" field
          (not down with the narrative sections below) so a traveler gets
          the travel note and the actual clickable map together, in one
          place, before anything else. */}
      {record.shrines.length > 0 ? (
        <Section heading={shrineLocationsHeading(language, record.shrines.length)}>
          <View style={styles.linkList}>
            {record.shrines.map((shrine, index) => (
              <ResourceLink
                key={`${shrine.mapsLink}-${index}`}
                label={shrine.label ?? t("viewOnGoogleMaps")}
                url={shrine.mapsLink}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {record.sthalaPuranam ? (
        afterSthalaPuranamImages.length > 0 ? (
          <SthalaPuranamWithImages text={record.sthalaPuranam} images={afterSthalaPuranamImages} />
        ) : (
          <Section heading={t("sthalaPuranamHeading")} text={record.sthalaPuranam} />
        )
      ) : null}
      <Section heading={t("azhwarPasuramHeading")} text={record.azhwarPasuram} />

      {detailedShrines.length > 0 ? (
        <Section heading={t("shrinesHeading")}>
          <View style={styles.shrineList}>
            {detailedShrines.map((shrine, index) => {
              const shrineHeading = shrine.name ?? shrine.label ?? shrineOrdinalLabel(language, index + 1);
              const shrineFields = shrine.templeInformation
                ? TEMPLE_FIELD_ORDER.filter(
                    (key) => key !== "travelNote" && shrine.templeInformation?.[key]
                  )
                : [];
              return (
                <View key={`${shrineHeading}-${index}`} style={styles.shrineBlock}>
                  <Text style={[styles.shrineHeading, { color: theme.colors.foreground }]}>
                    {shrineHeading}
                  </Text>
                  {shrineFields.length > 0 ? (
                    <View style={styles.templeInfo}>
                      {shrineFields.map((key) => (
                        <View key={key}>
                          <Text style={[styles.templeLabel, { color: theme.colors.muted }]}>
                            {translateUi(TEMPLE_FIELD_LABEL_KEYS[key], language)}
                          </Text>
                          <TempleFieldValue value={shrine.templeInformation?.[key] ?? ""} />
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {shrine.sthalaPuranam ? <ParagraphsWithNotes text={shrine.sthalaPuranam} keyPrefix="sp" /> : null}
                  {shrine.azhwarPasuram ? <ParagraphsWithNotes text={shrine.azhwarPasuram} keyPrefix="ap" /> : null}
                </View>
              );
            })}
          </View>
        </Section>
      ) : null}

      {record.resources.length > 0 ? (
        <Section heading={t("pasuramResourcesHeading")}>
          <View style={styles.linkList}>
            {record.resources.map((resource, index) => (
              <PasuramResource key={`${resource.url}-${index}`} url={resource.url} language={resource.language} />
            ))}
          </View>
          <Text style={[styles.pasuramAttribution, { color: theme.colors.muted }]}>
            {t("pasuramSourceAttribution")}
          </Text>
        </Section>
      ) : null}
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
  title: {
    fontSize: typography.title,
    fontWeight: "700",
  },
  templeInfo: {
    gap: spacing.md,
  },
  shrineList: {
    gap: spacing.lg,
  },
  shrineBlock: {
    gap: spacing.md,
  },
  shrineHeading: {
    fontSize: typography.body,
    fontWeight: "700",
  },
  templeLabel: {
    fontSize: typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  templeValue: {
    fontSize: typography.body,
    marginTop: spacing.xs,
  },
  /** See looksLikeSubheading()/isVerseLine() in content-lib/text-format.ts for what qualifies and why. */
  templeValueSubheading: {
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  /** See extractSpecialNote() in content-lib/text-format.ts for what qualifies and why. */
  specialNote: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  specialNoteLabel: {
    fontSize: typography.eyebrow,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  linkList: {
    gap: spacing.xs,
  },
  pasuramAttribution: {
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  notFound: {
    padding: layout.screenPadding,
    fontSize: typography.body,
  },
});
