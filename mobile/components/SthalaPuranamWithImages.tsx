import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { MobileImageEntry } from "../../content-lib/mobile-content.ts";
import { imagesByUuid } from "../content-lib/image-manifest.generated.ts";
import { spacing, typography, useTheme } from "../theme";
import { useReadingPreferences } from "../preferences-context.ts";
import { useLanguage } from "../language-context.ts";
import { translateUi } from "../ui-strings.ts";
import { FadeInImage, IMAGE_SIZE } from "./ContentImage";
import { ImageViewerModal } from "./ImageViewerModal";
import { isListItemLine, looksLikeSubheading, splitIntoReadableParagraphs } from "../../content-lib/text-format.ts";

/**
 * Mobile counterpart of components/divya-desams/SthalaPuranamWithImages.tsx
 * (web) -- see that file's doc comment for the full "why". Same
 * algorithm: split Sthala Puranam into `\n{2,}`-separated paragraphs
 * (matching Section's existing rendering), then within each paragraph
 * look for a single-`\n`-separated LINE that exactly matches an image's
 * `placementAnchor` (a real line copied verbatim from this same text),
 * inserting that image immediately after it. Images with no anchor (or
 * an anchor not present on this record) render as a trailing group
 * after the whole text, identical to the pre-existing "after Sthala
 * Puranam" behavior.
 *
 * Paragraph styling now matches Section.tsx exactly: the serif reading
 * font (readingFontFamily) and looksLikeSubheading()-driven bold were
 * both missing here, so every record with an after-Sthala-Puranam image
 * (17 records) silently rendered in the wrong typeface with no
 * subheading emphasis at all, purely because it took this rendering
 * path instead of Section.
 */

interface ResolvedImage {
  image: MobileImageEntry;
  asset: number;
}

interface Segment {
  key: string;
  text?: string;
  images?: ResolvedImage[];
}

function buildSegments(text: string, images: ResolvedImage[]): Segment[] {
  const paragraphs = text.split(/\n{2,}/);
  const segments: Segment[] = [];
  const usedAssetIds = new Set<string>();

  paragraphs.forEach((paragraph, pIdx) => {
    const lines = paragraph.split("\n");
    let bufferStart = 0;
    lines.forEach((line, lIdx) => {
      const trimmed = line.trim();
      const matched = images.filter(
        ({ image }) => image.placementAnchor === trimmed && !usedAssetIds.has(image.assetId)
      );
      if (matched.length === 0) return;

      const chunk = lines.slice(bufferStart, lIdx + 1).join("\n");
      segments.push({ key: `p${pIdx}-t${bufferStart}`, text: chunk });
      segments.push({ key: `p${pIdx}-img${lIdx}`, images: matched });
      matched.forEach(({ image }) => usedAssetIds.add(image.assetId));
      bufferStart = lIdx + 1;
    });
    if (bufferStart < lines.length) {
      segments.push({ key: `p${pIdx}-tail`, text: lines.slice(bufferStart).join("\n") });
    }
  });

  const trailing = images.filter(({ image }) => !usedAssetIds.has(image.assetId));
  if (trailing.length > 0) {
    segments.push({ key: "trailing", images: trailing });
  }
  return segments;
}

export function SthalaPuranamWithImages({ text, images }: { text: string; images: MobileImageEntry[] }) {
  const theme = useTheme();
  const { preferences } = useReadingPreferences();
  const { language } = useLanguage();
  const [viewerAsset, setViewerAsset] = useState<{ asset: number; label: string | null } | null>(null);

  const resolved = images.flatMap((image) => {
    const asset = imagesByUuid[image.sourceAssetUuid.toLowerCase()];
    return asset !== undefined ? [{ image, asset }] : [];
  });

  const segments = buildSegments(text, resolved);

  return (
    <View style={styles.section} accessible={false}>
      <Text style={[styles.heading, { color: theme.colors.foreground }]} accessibilityRole="header">
        {translateUi("sthalaPuranamHeading", language)}
      </Text>
      {segments.flatMap((segment) =>
        segment.text !== undefined
          ? splitIntoReadableParagraphs(segment.text).map((paragraph, i) => (
              <Text
                key={`${segment.key}-${i}`}
                style={[
                  styles.paragraph,
                  looksLikeSubheading(paragraph) && !isListItemLine(paragraph) && styles.subheading,
                  {
                    color: theme.colors.foreground,
                    fontFamily: Platform.select(typography.readingFontFamily),
                    fontSize: typography.body * preferences.fontScale,
                    lineHeight: typography.body * preferences.fontScale * typography.readingLineHeight,
                  },
                ]}
              >
                {paragraph}
              </Text>
            ))
          : [
              <View key={segment.key} style={styles.row}>
                {(segment.images ?? []).map(({ image, asset }) => (
                  <FadeInImage
                    key={image.assetId}
                    asset={asset}
                    label={image.alt}
                    size={IMAGE_SIZE}
                    onPress={() => setViewerAsset({ asset, label: image.alt })}
                  />
                ))}
              </View>,
            ]
      )}

      <ImageViewerModal
        visible={viewerAsset !== null}
        asset={viewerAsset?.asset ?? null}
        label={viewerAsset?.label}
        onClose={() => setViewerAsset(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    // Matches Section.tsx's same bump -- see that file for why.
    gap: spacing.md,
  },
  heading: {
    fontSize: typography.heading,
    fontWeight: "600",
  },
  paragraph: {
    fontSize: typography.body,
    lineHeight: typography.body * typography.readingLineHeight,
  },
  /** See looksLikeSubheading() in content-lib/text-format.ts for what qualifies and why. */
  subheading: {
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
