import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { useLanguage } from "../language-context.ts";
import { translateUi } from "../ui-strings.ts";

/**
 * A single external social-profile button -- visually matches
 * SettingsControls' PillGroup buttons (same border/radius/padding
 * language) so it reads as part of the same Settings screen rather
 * than a one-off. Kept generic over icon/label/url rather than
 * hardcoded to Instagram, in case another profile is added later.
 */
export function SocialButton({ icon, label, url }: { icon: keyof typeof Ionicons.glyphMap; label: string; url: string }) {
  const theme = useTheme();
  const { language } = useLanguage();
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`${label}${translateUi("opensInBrowserSuffix", language)}`}
      style={[styles.button, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}
    >
      <Ionicons name={icon} size={18} color={theme.colors.accent} />
      <Text style={[styles.label, { color: theme.colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: layout.minTouchTarget,
  },
  label: {
    fontSize: typography.small,
    fontWeight: "600",
  },
});
