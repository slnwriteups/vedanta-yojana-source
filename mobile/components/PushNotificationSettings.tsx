import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, Text, View } from 'react-native';
import { spacing, typography, useTheme } from '../theme';
import { useLanguage } from '../language-context.ts';
import { useT, type UiStringKey } from '../ui-strings.ts';
import { enablePush, disablePush, pushStatus, type PushResult } from '../services/pushNotifications.ts';

const KEYS: Record<PushResult, UiStringKey> = { enabled: 'pushEnabled', disabled: 'pushDisabled', denied: 'pushDenied', unavailable: 'pushUnavailable', failed: 'pushFailed' };
export function PushNotificationSettings() {
  const [status, setStatus] = useState<PushResult>('disabled');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const { language } = useLanguage(); const t = useT(); const theme = useTheme();
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { void pushStatus().then(s => { if (!cancelled) { setStatus(s); setEnabled(s === 'enabled'); } }).catch(() => {}); };
    refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { cancelled = true; listener.remove(); };
  }, []);
  const toggle = async () => {
    setBusy(true);
    try {
      const result = await (enabled ? disablePush() : enablePush(language));
      setStatus(result);
      if (result === 'enabled' || result === 'disabled') setEnabled(result === 'enabled');
    }
    finally { setBusy(false); }
  };
  return <View style={{ gap: spacing.sm }}>
    <Text style={{ fontSize: typography.body, fontWeight: '600', color: theme.colors.foreground }}>{t('pushTitle')}</Text>
    <Text style={{ color: theme.colors.muted }}>{t('pushDescription')}</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.muted }}>{t(KEYS[status])}</Text>
    <Pressable disabled={busy} onPress={() => void toggle()} accessibilityRole="button" style={{ paddingVertical: spacing.sm, opacity: busy ? 0.5 : 1 }}>
      <Text style={{ color: theme.colors.accent }}>{t(enabled ? 'pushDisable' : 'pushEnable')}</Text>
    </Pressable>
    {status === 'denied' ? <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button"><Text style={{ color: theme.colors.accent }}>{t('pushOpenSettings')}</Text></Pressable> : null}
  </View>;
}
