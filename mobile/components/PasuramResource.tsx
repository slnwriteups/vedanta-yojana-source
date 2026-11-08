import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { layout, spacing, typography, useTheme } from "../theme";
import { useLanguage } from "../language-context.ts";
import { resourceLabel, translateUi } from "../ui-strings.ts";
import { openOfflinePasuram } from "../services/pasuramOfflineService.ts";

/**
 * One Pasuram PDF row. Every Pasuram is bundled into the app (see
 * pasuramOfflineService.ts), so this is a tap-to-open row -- same shape
 * as ResourceLink.tsx's Maps/external-resource rows, including its "↗"
 * affordance so a reader can tell in advance that tapping leaves this
 * screen for a PDF viewer. While online, opening first checks
 * Prapatti.com for a corrected version (a few seconds at most), so the
 * row shows a small spinner and ignores repeat taps meanwhile.
 *
 * Also used for a Library book's stotram PDFs (`type` "stotram-pdf"),
 * which are bundled into the same archive and labelled "Stotram (PDF)".
 */
export function PasuramResource({
  url,
  language: pasuramLanguage,
  type = "pasuram-pdf",
}: {
  url: string;
  language: string;
  type?: string;
}) {
  const theme = useTheme();
  const { language } = useLanguage();
  const label = resourceLabel(language, { language: pasuramLanguage, type });
  const [opening, setOpening] = useState(false);

  const onPress = async () => {
    if (opening) return;
    setOpening(true);
    try {
      await openOfflinePasuram(url);
    } finally {
      setOpening(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={opening}
      accessibilityRole="button"
      accessibilityState={{ busy: opening, disabled: opening }}
      accessibilityLabel={`${label}${translateUi("opensPdfViewerSuffix", language)}`}
      style={styles.row}
    >
      <View style={styles.inline}>
        <Text style={[styles.label, { color: theme.colors.accent }]}>{label} ↗</Text>
        {opening ? <ActivityIndicator size="small" color={theme.colors.accent} style={styles.spinner} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
  },
  spinner: {
    marginLeft: spacing.sm,
  },
  label: {
    fontSize: typography.body,
    fontWeight: "500",
  },
});
