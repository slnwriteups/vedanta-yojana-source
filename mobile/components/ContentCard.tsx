import * as Haptics from "expo-haptics";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { shadows } from "../shadows";
import { DraftBadge } from "./DraftBadge";

/**
 * Phase 6C -- the reusable list-row card, now with an optional thumbnail
 * (`imageAsset`) for records that have a resolvable image (Divya Desams).
 * A record with no image renders exactly as it did in Phase 6B -- no
 * placeholder icon is invented for a missing photo. Meets the
 * accessibility minimum touch target (layout.minTouchTarget) and exposes
 * a single combined accessibilityLabel so a screen reader announces the
 * whole card as one row, not fragments.
 *
 * UI/UX pass: each row is now its own separated, rounded card
 * (shadows.card) with breathing room between them, rather than a flat
 * hairline-divided strip -- the difference between a settings list and
 * a content-browsing list. Still just one shared component, so this
 * benefits every screen that renders one (Library's book/chapter
 * lists, Divya Desams) at once.
 *
 * `tintColor` (optional): a thin colored left-edge stripe identifying
 * which section/book a row belongs to (section-tints.ts) -- a
 * restrained wayfinding cue, not a full background-color treatment,
 * so it never fights with a real thumbnail photo or affects text
 * contrast. When a book has no cover image, the same tint also fills
 * a monogram swatch (`monogram`) in place of the empty thumbnail slot.
 * Rendered as an absolutely-positioned overlay (not a plain border-left)
 * inside a card with `overflow: "hidden"`, so the native renderer clips
 * its top/bottom corners to the SAME `radius.md` curve as the card
 * shell -- a bare `borderLeftWidth` looks squared-off against a rounded
 * card at the corners; this doesn't.
 *
 * `variant` picks the thumbnail's aspect ratio/size: "square" (56x56,
 * the original size, still the default so every pre-existing caller is
 * unaffected), "temple" (a wider 4:3 block for Divya Desam photos), or
 * "cover" (a taller 2:3 block for Library book-cover art). Purely a
 * sizing choice -- the image/monogram-fallback logic below is unchanged
 * regardless of variant.
 *
 * A subtle full-card hairline border (`theme.colors.border`, already
 * ~10% opacity against the surface color in both themes) sits alongside
 * the existing background/shadow so adjacent cards read as more clearly
 * separated on the same background.
 *
 * A light haptic (expo-haptics) fires on every tap, alongside the
 * existing onPress -- since this one component backs nearly every
 * tappable row in the app (Home, Library, Divya Desams), this single
 * change gives the whole app a consistent tactile feel.
 */
const THUMB_SIZE: Record<"square" | "temple" | "cover", { width: number; height: number }> = {
  square: { width: 56, height: 56 },
  temple: { width: 108, height: 81 }, // 4:3
  cover: { width: 64, height: 96 }, // 2:3
};

export function ContentCard({
  title,
  subtitle,
  status,
  needsReview,
  imageAsset,
  tintColor,
  monogram,
  variant = "square",
  disabled = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  status?: string;
  needsReview?: boolean;
  imageAsset?: number | null;
  tintColor?: string;
  monogram?: string;
  variant?: "square" | "temple" | "cover";
  /** True for a row that isn't openable yet (e.g. an undownloaded book's chapter) -- dims the row and disables the tap rather than hiding it, so the reader still sees what's there. */
  disabled?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const isDraft = status === "draft";
  const a11yLabel = [title, subtitle, isDraft ? "Draft, under review" : null].filter(Boolean).join(". ");
  const thumbSize = THUMB_SIZE[variant];

  return (
    <Pressable
      onPress={() => {
        if (disabled || !onPress) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={a11yLabel}
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        disabled ? styles.disabled : null,
        {
          backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {tintColor ? <View style={[styles.accentBar, { backgroundColor: tintColor }]} /> : null}
      {imageAsset ? (
        <Image
          source={imageAsset}
          style={[styles.thumb, thumbSize, { backgroundColor: theme.colors.border }]}
          // "cover" book-art thumbnails show the whole cover uncropped
          // (a cropped book cover loses its title/author lettering);
          // "square"/"temple" photo thumbnails still fill their frame.
          resizeMode={variant === "cover" ? "contain" : "cover"}
        />
      ) : monogram && tintColor ? (
        <View style={[styles.thumb, thumbSize, styles.monogram, { backgroundColor: tintColor }]}>
          <Text style={styles.monogramText}>{monogram}</Text>
        </View>
      ) : null}
      <View style={styles.textBlock}>
        {status ? <DraftBadge status={status} needsReview={needsReview ?? false} /> : null}
        <Text style={[styles.title, { color: theme.colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: layout.minTouchTarget,
    overflow: "hidden",
  },
  disabled: {
    opacity: 0.5,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  thumb: {
    borderRadius: radius.md,
  },
  monogram: {
    alignItems: "center",
    justifyContent: "center",
  },
  monogramText: {
    color: "#fffaf5",
    fontSize: typography.heading,
    fontWeight: "700",
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.body,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: typography.small,
  },
});
