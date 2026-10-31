import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '../language-context.ts';
import { Notifications, notificationAnnouncementId, refreshPush } from '../services/pushNotifications.ts';

export function PushNotificationsBridge() {
  const router = useRouter();
  const { language } = useLanguage();
  useEffect(() => {
    void refreshPush(language).catch(() => {});
    const renewal = Notifications.addPushTokenListener(() => { void refreshPush(language).catch(() => {}); });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void refreshPush(language).catch(() => {}); });
    return () => { foreground.remove(); renewal.remove(); };
  }, [language]);
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      const id = notificationAnnouncementId(response);
      if (id) { router.push({ pathname: '/whats-new', params: { announcementId: id } } as never); void Notifications.clearLastNotificationResponseAsync(); }
    };
    let cancelled = false;
    void Notifications.getLastNotificationResponseAsync().then(r => { if (!cancelled) open(r); }).catch(() => {});
    const listener = Notifications.addNotificationResponseReceivedListener(open);
    return () => { cancelled = true; listener.remove(); };
  }, [router]);
  return null;
}
