import * as Haptics from "expo-haptics";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, typography, useTheme } from "../theme";
import { DraftBadge } from "./DraftBadge";

/**
 * One tile of a two-column grid (the Library shelf, the Divya Desams
 * index): the picture large, with the title and a secondary line beneath
 * it -- the same tiles as the website's BookCard and DivyaDesamCard.
 *
 * `variant="cover"` is a 2:3 book cover shown whole ("contain": a cropped
 * cover loses its title/author lettering); `variant="photo"` is a 4:3
 * photograph that fills its frame. With no picture, the frame is filled
 * with `tintColor` and `fallbackText` (a book's initial, a temple's
 * number) in its place, so the grid keeps one rhythm -- never an invented
 * placeholder image.
 */
export function GridTile({
  title,
  titlePrefix,
  subtitle,
  status,
  needsReview,
  imageAsset,
  tintColor,
  fallbackText,
  variant,
  onPress,
}: {
  title: string;
  /** Shown muted before the title, e.g. a Divya Desam's number ("12."). */
  titlePrefix?: string;
  subtitle?: string;
  status?: string;
  needsReview?: boolean;
  imageAsset: number | null;
  tintColor: string;
  fallbackText?: string;
  variant: "cover" | "photo";
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={[titlePrefix, title, subtitle].filter(Boolean).join(" ")}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View
        style={[
          styles.frame,
          variant === "cover" ? styles.coverFrame : styles.photoFrame,
          { backgroundColor: imageAsset ? theme.colors.surfaceAlt : tintColor },
        ]}
      >
        {imageAsset ? (
          <Image source={imageAsset} style={styles.image} resizeMode={variant === "cover" ? "contain" : "cover"} />
        ) : fallbackText ? (
          <Text style={[styles.fallback, { color: theme.colors.onAccent }]}>{fallbackText}</Text>
        ) : null}
      </View>
      <View style={styles.text}>
        {status ? <DraftBadge status={status} needsReview={needsReview ?? false} /> : null}
        <Text style={[styles.title, { color: theme.colors.foreground }]}>
          {titlePrefix ? <Text style={{ color: theme.colors.muted }}>{`${titlePrefix} `}</Text> : null}
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: "47.5%",
    gap: spacing.sm,
  },
  frame: {
    width: "100%",
    borderRadius: radius.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  coverFrame: {
    aspectRatio: 2 / 3,
  },
  photoFrame: {
    aspectRatio: 4 / 3,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    fontSize: typography.title + 10,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  text: {
    gap: 2,
  },
  title: {
    fontSize: typography.body,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: typography.small,
  },
});
