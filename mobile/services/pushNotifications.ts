import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { readJSON, writeJSON } from '../storage.ts';
import type { LanguageCode } from '../content-lib/preferences.ts';
import { refreshEkadasiRemindersSoon } from './ekadasiReminderService.ts';

const ENDPOINT = 'https://vedantayojana.org/_push';
const STORAGE_KEY = 'vy.push.subscription';
const AUTO_ENABLE_KEY = 'vy.notifications.autoEnabled';
interface SavedPush { enabled: boolean; token: string | null }
const valid = (v: unknown): v is SavedPush => !!v && typeof v === 'object' && typeof (v as SavedPush).enabled === 'boolean' && (typeof (v as SavedPush).token === 'string' || (v as SavedPush).token === null);
export type PushResult = 'enabled' | 'disabled' | 'denied' | 'unavailable' | 'failed';
// Serialize registration changes: foreground/language refreshes cannot undo a later opt-out.
let operation: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = operation.then(work, work);
  operation = next.catch(() => {});
  return next;
}


Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

async function api(path: string, method = 'GET', body?: unknown): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(ENDPOINT + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
    if (!r.ok) throw new Error('Push service unavailable');
  } finally { clearTimeout(timeout); }
}
export async function pushStatus(): Promise<PushResult> {
  const saved = await readJSON(STORAGE_KEY, valid);
  if (!saved?.enabled) return 'disabled';
  const p = await Notifications.getPermissionsAsync();
  return p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ? 'enabled' : 'denied';
}
export function enablePush(language: LanguageCode | null, requestPermission = true): Promise<PushResult> {
  return serial(() => registerPush(language, requestPermission));
}
async function registerPush(language: LanguageCode | null, requestPermission: boolean): Promise<PushResult> {
  try {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unavailable';
    // Do not ask readers to opt in until the registration service is reachable.
    await api('/status');
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('announcements', { name: 'Announcements', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' });
    let permission = await Notifications.getPermissionsAsync();
    const allowed = () => permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!allowed() && requestPermission && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (!allowed()) return 'denied';
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return 'unavailable';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const previous = await readJSON(STORAGE_KEY, valid);
    await api('/subscription', 'POST', { token, platform: Platform.OS, language: language ?? 'en' });
    if (previous?.token && previous.token !== token) await api('/subscription', 'DELETE', { token: previous.token });
    await writeJSON(STORAGE_KEY, { enabled: true, token });
    return 'enabled';
  } catch { return 'failed'; }
}
/**
 * Notifications are on by default (owner decision, 4 Nov 2026). Once per
 * install, right after onboarding (or on the first launch of this
 * version for existing readers), the app asks for notification permission
 * itself instead of waiting for a tap in Settings. If the reader allows
 * it, announcement notifications are subscribed and the Ekadasi reminders
 * schedule. A reader who had already turned announcements off in
 * Settings stays off: only their reminders follow the permission.
 *
 * The subscription is saved as wanted before it is sent, so if the
 * service can't be reached now, refreshPush retries it on the next
 * foreground. Turning notifications off is done in the phone's settings
 * (or, for announcements, with the switch Apple requires in Settings).
 */
export function autoEnableNotifications(language: LanguageCode | null): Promise<void> {
  return serial(async () => {
    try {
      if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
      if ((await readJSON(AUTO_ENABLE_KEY, (v: unknown): v is true => v === true)) === true) return;
      await writeJSON(AUTO_ENABLE_KEY, true);
      // Android 13+ shows the permission prompt only once a channel exists.
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('announcements', { name: 'Announcements', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' });
      let permission = await Notifications.getPermissionsAsync();
      const allowed = () => permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
      if (!allowed() && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
      if (!allowed()) return;
      refreshEkadasiRemindersSoon();
      const saved = await readJSON(STORAGE_KEY, valid);
      if (saved && !saved.enabled) return;
      if (!saved) await writeJSON(STORAGE_KEY, { enabled: true, token: null });
      // Not awaited: onboarding waits on this function before opening the
      // app, and registration needs the network (Expo's token call has no
      // timeout). Queued so it still runs in order with later changes.
      void serial(() => registerPush(language, false));
    } catch {}
  });
}
export function disablePush(): Promise<PushResult> { return serial(removePush); }
async function removePush(): Promise<PushResult> {
  try {
    const saved = await readJSON(STORAGE_KEY, valid);
    if (saved?.token) await api('/subscription', 'DELETE', { token: saved.token });
    await writeJSON(STORAGE_KEY, { enabled: false, token: null });
    return 'disabled';
  } catch { return 'failed'; }
}
/** Refresh registrations after a language change or foreground, never re-prompt; follows the phone's notification setting both ways. */
export function refreshPush(language: LanguageCode | null): Promise<void> {
  return serial(async () => {
  const saved = await readJSON(STORAGE_KEY, valid);
  if (!saved?.enabled) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    // Turned off in the phone's settings: stop sending, but keep the reader's
    // choice, so allowing notifications there again resumes announcements.
    if (saved.token) { try { await api('/subscription', 'DELETE', { token: saved.token }); await writeJSON(STORAGE_KEY, { enabled: true, token: null }); } catch {} }
    return;
  }
  await registerPush(language, false);
  });
}
export function notificationAnnouncementId(response: Notifications.NotificationResponse | null): string | null {
  const id = response?.notification.request.content.data?.announcementId;
  return typeof id === 'string' && /^[a-z0-9-]{1,160}$/.test(id) ? id : null;
}
export { Notifications };
