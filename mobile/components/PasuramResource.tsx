import { Pressable, StyleSheet, Text } from "react-native";
import { layout, spacing, typography, useTheme } from "../theme";
import { useLanguage } from "../language-context.ts";
import { pasuramResourceLabel } from "../ui-strings.ts";
import { openOfflinePasuram } from "../services/pasuramOfflineService.ts";

/**
 * One Pasuram PDF row. Every Pasuram is bundled into the app (see
 * pasuramOfflineService.ts), so this is just a tap-to-open row -- same
 * shape as ResourceLink.tsx's Maps/external-resource rows -- with no
 * download/available/error state machine to manage.
 */
export function PasuramResource({ url, language: pasuramLanguage }: { url: string; language: string }) {
  const theme = useTheme();
  const { language } = useLanguage();
  const label = pasuramResourceLabel(language, pasuramLanguage);

  return (
    <Pressable
      onPress={() => openOfflinePasuram(url)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.row}
    >
      <Text style={[styles.label, { color: theme.colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: typography.body,
    fontWeight: "500",
  },
});
