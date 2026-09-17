import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import type { MobileImageEntry } from "../../content-lib/mobile-content.ts";
import { imagesByUuid } from "../content-lib/image-manifest.generated.ts";
import { useTheme } from "../theme";
import { useLanguage } from "../language-context.ts";
import { translateUi } from "../ui-strings.ts";
import { ImageViewerModal } from "./ImageViewerModal";

/**
 * Phase 6B/6C -- resolves images[] the same way the web app's
 * components/shared/RecordImages.tsx does: `sourceAssetUuid` to a real
 * local asset, silently dropping any image with no matching file. Phase
 * 6C additions: a fixed square aspect ratio with a themed placeholder
 * background (so the layout doesn't jump while a large image decodes), a
 * fade-in on load (Animated, built into react-native -- no new
 * dependency), and a tap target that opens ImageViewerModal for a
 * full-screen view. Every migrated image still has alt: null (no
 * accessibilityLabel is fabricated when absent).
 *
 * UI/UX pass: dropped the literal "Images" heading -- it rendered at
 * the exact same weight as real section headings ("Temple Information",
 * "Sthala Puranam"), implying equal informational content where there
 * was none; a gallery of real photos doesn't need a label saying
 * "Images" any more than body text needs one saying "Text".
 */
export function FadeInImage({
  asset,
  label,
  size,
  onPress,
}: {
  asset: number;
  label: string | null;
  size: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { language } = useLanguage();
  const opacity = useRef(new Animated.Value(0)).current;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={label ?? translateUi("viewImageFullScreen", language)}
      style={[styles.thumbWrap, { width: size, height: size, backgroundColor: theme.colors.border }]}
    >
      <Animated.Image
        source={asset}
        accessibilityLabel={label ?? undefined}
        style={[styles.thumb, { opacity, borderRadius: theme.scheme === "dark" ? 10 : 10 }]}
        resizeMode="contain"
        onLoad={() => {
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        }}
      />
    </Pressable>
  );
}

export function ContentImage({ images }: { images: MobileImageEntry[] }) {
  const [viewerAsset, setViewerAsset] = useState<{ asset: number; label: string | null } | null>(null);

  const resolved = images.flatMap((image) => {
    const asset = imagesByUuid[image.sourceAssetUuid.toLowerCase()];
    return asset !== undefined ? [{ image, asset }] : [];
  });

  if (resolved.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.row}>
        {resolved.map(({ image, asset }) => (
          <FadeInImage
            key={image.assetId}
            asset={asset}
            label={image.alt}
            size={IMAGE_SIZE}
            onPress={() => setViewerAsset({ asset, label: image.alt })}
          />
        ))}
      </View>

      <ImageViewerModal
        visible={viewerAsset !== null}
        asset={viewerAsset?.asset ?? null}
        label={viewerAsset?.label}
        onClose={() => setViewerAsset(null)}
      />
    </View>
  );
}

export const IMAGE_SIZE = 140;

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  thumbWrap: {
    borderRadius: 10,
    overflow: "hidden",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
});
