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
 *
 * Book-bundle-removal update: `asset` now also accepts `{ uri: string }`
 * -- a downloaded book chapter's images live in app-private storage as
 * local files, not Metro-bundled requires, so they resolve to a
 * `file://` URI (bookOfflineService.ts's getOfflineBookImageUri())
 * rather than a numeric asset id. Divya Desam images are completely
 * unaffected: they still resolve through the same imagesByUuid Metro
 * lookup as before, and this widened type accepts both without any
 * caller needing to change.
 */
export type ImageAsset = number | { uri: string };

export function FadeInImage({
  asset,
  label,
  size,
  onPress,
}: {
  asset: ImageAsset;
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

export function ContentImage({
  images,
  resolveLocalUri,
}: {
  images: MobileImageEntry[];
  /** When set, resolves each image's local file:// URI (a downloaded book's chapter images) instead of the default Metro imagesByUuid lookup (Divya Desam images). Unset for every existing caller -- behavior there is completely unchanged. */
  resolveLocalUri?: (sourceAssetUuid: string) => string | null;
}) {
  const [viewerAsset, setViewerAsset] = useState<{ asset: ImageAsset; label: string | null } | null>(null);

  const resolved = images.flatMap((image) => {
    const asset: ImageAsset | undefined = resolveLocalUri
      ? (() => {
          const uri = resolveLocalUri(image.sourceAssetUuid);
          return uri ? { uri } : undefined;
        })()
      : imagesByUuid[image.sourceAssetUuid.toLowerCase()];
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
