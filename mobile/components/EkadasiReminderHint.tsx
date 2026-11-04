import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, useTheme } from '../theme';
import { useLanguage } from '../language-context.ts';
import { useT } from '../ui-strings.ts';
import { readJSON, writeJSON } from '../storage.ts';
import { ekadasiReminderStatus, enableEkadasiReminders, useEkadasiRemindersEnabled } from '../services/ekadasiReminderService.ts';

const DISMISSED_KEY = 'ekadasiReminderHintDismissed';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/**
 * One line under the Home Panchangam's next-Ekadasi row offering the
 * Dasami-eve reminder, so readers find it without visiting Settings.
 * Shown only while the reminders are off and permission can still be
 * granted; "Not now" hides it for good (Settings keeps the switch).
 */
export function EkadasiReminderHint() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const enabled = useEkadasiRemindersEnabled();
  const { language } = useLanguage();
  const t = useT();
  const theme = useTheme();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const dismissed = (await readJSON(DISMISSED_KEY, isBoolean)) ?? false;
      const status = await ekadasiReminderStatus();
      if (!cancelled) setVisible(!dismissed && status === 'off');
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);

  if (!visible || enabled) return null;

  const dismiss = () => { setVisible(false); void writeJSON(DISMISSED_KEY, true); };
  const accept = async () => {
    setBusy(true);
    try {
      // Turned on, or refused at the prompt: either way the reader has answered.
      await enableEkadasiReminders(language);
      dismiss();
    } finally { setBusy(false); }
  };

  return <View style={[styles.hint, { borderTopColor: theme.colors.border }]}>
    <Text style={[styles.text, { color: theme.colors.foreground }]}>{t('ekadasiReminderHint')}</Text>
    <View style={styles.actions}>
      <Pressable disabled={busy} onPress={() => void accept()} accessibilityRole="button" style={{ opacity: busy ? 0.5 : 1 }}>
        <Text style={[styles.action, { color: theme.colors.accent }]}>{t('ekadasiReminderHintAccept')}</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={dismiss} accessibilityRole="button">
        <Text style={[styles.action, { color: theme.colors.muted }]}>{t('ekadasiReminderHintDismiss')}</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  hint: { marginTop: spacing.xs, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs },
  text: { fontSize: typography.small },
  actions: { flexDirection: 'row', gap: spacing.lg },
  action: { fontSize: typography.small, fontWeight: '600', paddingVertical: spacing.xs },
});
