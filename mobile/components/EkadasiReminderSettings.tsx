import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, Text, View } from 'react-native';
import { spacing, typography, useTheme } from '../theme';
import { useLanguage } from '../language-context.ts';
import { useT, type UiStringKey } from '../ui-strings.ts';
import {
  disableEkadasiReminders,
  ekadasiReminderStatus,
  enableEkadasiReminders,
  notificationsAvailable,
  useEkadasiRemindersEnabled,
  type EkadasiReminderStatus,
} from '../services/ekadasiReminderService.ts';

const STATUS_KEYS: Record<Exclude<EkadasiReminderStatus, 'unavailable'>, UiStringKey> = {
  on: 'ekadasiReminderOn',
  off: 'ekadasiReminderOff',
  denied: 'ekadasiReminderDenied',
};

/**
 * Settings block for the Dasami-eve Ekadasi reminders, laid out like the
 * announcement-notifications block above it. Off until the reader turns
 * it on here (or from the Home hint); only then is notification
 * permission asked. Hidden on a build without the notifications native code.
 */
export function EkadasiReminderSettings() {
  const [status, setStatus] = useState<EkadasiReminderStatus>('off');
  const [busy, setBusy] = useState(false);
  const enabled = useEkadasiRemindersEnabled();
  const { language } = useLanguage();
  const t = useT();
  const theme = useTheme();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => { void ekadasiReminderStatus().then(s => { if (!cancelled) setStatus(s); }).catch(() => {}); };
    refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { cancelled = true; listener.remove(); };
  }, [enabled]);

  if (!notificationsAvailable() || status === 'unavailable') return null;

  const toggle = async () => {
    setBusy(true);
    try { setStatus(enabled ? disableEkadasiReminders() : await enableEkadasiReminders(language)); }
    finally { setBusy(false); }
  };

  return <View style={{ gap: spacing.sm }}>
    <Text style={{ fontSize: typography.body, fontWeight: '600', color: theme.colors.foreground }}>{t('ekadasiReminderTitle')}</Text>
    <Text style={{ color: theme.colors.muted }}>{t('ekadasiReminderDescription')}</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.muted }}>{t(STATUS_KEYS[status])}</Text>
    <Pressable disabled={busy} onPress={() => void toggle()} accessibilityRole="button" style={{ paddingVertical: spacing.sm, opacity: busy ? 0.5 : 1 }}>
      <Text style={{ color: theme.colors.accent }}>{t(enabled ? 'ekadasiReminderDisable' : 'ekadasiReminderEnable')}</Text>
    </Pressable>
    {status === 'denied' ? <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button"><Text style={{ color: theme.colors.accent }}>{t('pushOpenSettings')}</Text></Pressable> : null}
  </View>;
}
