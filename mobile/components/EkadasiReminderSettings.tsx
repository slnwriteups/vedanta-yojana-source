import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, Text, View } from 'react-native';
import { spacing, typography, useTheme } from '../theme';
import { useT } from '../ui-strings.ts';
import { ekadasiRemindersAllowed, notificationsAvailable } from '../services/ekadasiReminderService.ts';

/**
 * Settings note for the Dasami-eve Ekadasi reminders. They are on by
 * default and have no in-app switch (owner decision, 4 Nov 2026): this
 * says what they do and that they are turned off in the phone's
 * notification settings, with a link there. When the phone blocks the
 * app's notifications it says so instead. Hidden on a build without the
 * notifications native code.
 */
export function EkadasiReminderSettings() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const t = useT();
  const theme = useTheme();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => { void ekadasiRemindersAllowed().then(a => { if (!cancelled) setAllowed(a); }).catch(() => {}); };
    refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { cancelled = true; listener.remove(); };
  }, []);

  if (!notificationsAvailable() || allowed === null) return null;

  return <View style={{ gap: spacing.sm }}>
    <Text style={{ fontSize: typography.body, fontWeight: '600', color: theme.colors.foreground }}>{t('ekadasiReminderTitle')}</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.muted }}>{t(allowed ? 'ekadasiReminderDescription' : 'ekadasiReminderDenied')}</Text>
    <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button" style={{ paddingVertical: spacing.sm }}>
      <Text style={{ color: theme.colors.accent }}>{t('pushOpenSettings')}</Text>
    </Pressable>
  </View>;
}
