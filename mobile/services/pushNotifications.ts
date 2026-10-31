import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { readJSON, writeJSON } from '../storage.ts';
import type { LanguageCode } from '../content-lib/preferences.ts';

const ENDPOINT = 'https://vedantayojana.org/_push';
const STORAGE_KEY = 'vy.push.subscription';
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
export function disablePush(): Promise<PushResult> { return serial(removePush); }
async function removePush(): Promise<PushResult> {
  try {
    const saved = await readJSON(STORAGE_KEY, valid);
    if (saved?.token) await api('/subscription', 'DELETE', { token: saved.token });
    await writeJSON(STORAGE_KEY, { enabled: false, token: null });
    return 'disabled';
  } catch { return 'failed'; }
}
/** Refresh registrations after a language change or foreground, never re-prompt. */
export function refreshPush(language: LanguageCode | null): Promise<void> {
  return serial(async () => {
  const saved = await readJSON(STORAGE_KEY, valid);
  if (!saved?.enabled) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) { await removePush(); return; }
  await registerPush(language, false);
  });
}
export function notificationAnnouncementId(response: Notifications.NotificationResponse | null): string | null {
  const id = response?.notification.request.content.data?.announcementId;
  return typeof id === 'string' && /^[a-z0-9-]{1,160}$/.test(id) ? id : null;
}
export { Notifications };
