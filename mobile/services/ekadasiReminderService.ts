import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type { PanchangamPlace } from "../../content-lib/panchangam-engine.ts";
import type { LanguageCode } from "../content-lib/preferences.ts";
import { useLanguage } from "../language-context.ts";
import { EKADASI_REMINDER_ID_PREFIX, ekadasiReminderChannelName, planEkadasiReminders } from "./ekadasiReminderCore.ts";
import { usePanchangamPlace } from "./panchangamPlaceStore.ts";
import { useDevicePanchangamPlace } from "./panchangamService.ts";

/**
 * The Dasami-eve notification: on the day before each Ekadasi fast the
 * phone shows "Tomorrow is Ekadasi" (ekadasiReminderCore.ts decides
 * which days and what it says). Scheduled on the device as local
 * notifications, computed by the same on-device Panchangam engine as the
 * Home calendar, for the same place -- the chosen city, or the phone's
 * location as Home last resolved it -- so it needs no server, account or
 * network, and fires even when the app is closed.
 *
 * Each reminder is written in the language the reader chose for the app
 * (Settings > Language; English until they choose one), at the moment it
 * is scheduled -- so a language change reschedules every coming
 * reminder in the new language. The coming reminders are replaced
 * whenever the app comes to the foreground or the place or language
 * changes; each run schedules the next EKADASI_REMINDER_HORIZON_DAYS, so
 * reminders keep coming between uses.
 *
 * On by default (owner decision, 4 Nov 2026): they are scheduled whenever
 * the phone allows the app's notifications, with no in-app switch. The
 * permission itself is asked once, automatically, by
 * services/pushNotifications.ts (autoEnableNotifications); this service
 * never prompts. A reader turns them off in the phone's settings: on
 * Android the "Ekadasi reminders" channel alone, on iOS the app's
 * notifications as a whole. The foreground display handler is the one
 * services/pushNotifications.ts installs for every notification.
 *
 * expo-notifications is native code. An over-the-air update can reach an
 * installed app built before it was added, so it is only loaded once its
 * native module is known to be present; on such a build the reminders
 * stay off until the next app build is installed, and nothing crashes.
 */

const ANDROID_CHANNEL_ID = "ekadasi-reminders";

/** Bumped when notification permission may have changed, so the reminders reschedule. */
let permissionVersion = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reschedules the reminders now: called after the notification permission is granted. */
export function refreshEkadasiRemindersSoon(): void {
  permissionVersion += 1;
  for (const listener of listeners) listener();
}

/** Whether this build of the app carries expo-notifications' native code. */
export function notificationsAvailable(): boolean {
  return requireOptionalNativeModule("ExpoNotificationScheduler") !== null;
}

type NotificationsModule = typeof import("expo-notifications");

let notificationsModule: Promise<NotificationsModule | null> | null = null;

function loadNotifications(): Promise<NotificationsModule | null> {
  notificationsModule ??= (async () => {
    if (Platform.OS === "web" || !notificationsAvailable()) return null;
    try {
      return await import("expo-notifications");
    } catch {
      return null;
    }
  })();
  return notificationsModule;
}

async function cancelScheduled(Notifications: NotificationsModule): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(EKADASI_REMINDER_ID_PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier))
  );
}

function granted(Notifications: NotificationsModule, permission: Awaited<ReturnType<NotificationsModule["getPermissionsAsync"]>>): boolean {
  return permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Creates the Android channel (needed before Android 13+ can show the permission prompt), or renames it into the reader's language. */
async function ensureChannel(Notifications: NotificationsModule, language: LanguageCode | null): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: ekadasiReminderChannelName(language),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Whether the phone allows the app's notifications, for the Settings block's note. */
export async function ekadasiRemindersAllowed(): Promise<boolean | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;
  try {
    return granted(Notifications, await Notifications.getPermissionsAsync());
  } catch {
    return false;
  }
}

/**
 * Replaces the scheduled reminders with those for `place` in `language`,
 * or clears them when notifications aren't allowed. Never throws: a reminder
 * that can't be scheduled is a missed convenience, not an error to show.
 */
export async function refreshEkadasiReminders(place: PanchangamPlace | null, language: LanguageCode | null): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;
    // No place yet (the phone's location not resolved this launch): keep what is already scheduled.
    if (!place) return;
    await cancelScheduled(Notifications);
    // Never prompts: permission is asked only when the reader turns the reminders on.
    if (!granted(Notifications, await Notifications.getPermissionsAsync())) return;
    await ensureChannel(Notifications, language);
    for (const reminder of planEkadasiReminders(place, Date.now(), language)) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: reminder.title, body: reminder.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.fireAt,
          channelId: ANDROID_CHANNEL_ID,
        },
      });
    }
  } catch {
    // Best-effort, as above.
  }
}

/** Runs refreshEkadasiReminders one at a time, the latest request last. */
let queue: Promise<void> = Promise.resolve();

function queueRefresh(place: PanchangamPlace | null, language: LanguageCode | null) {
  queue = queue.then(() => refreshEkadasiReminders(place, language));
}

/**
 * Keeps the reminders scheduled for the Panchangam's place and the
 * reader's language. Mounted once, after onboarding.
 */
export function useEkadasiReminders(): void {
  const { place: chosen, ready } = usePanchangamPlace();
  const devicePlace = useDevicePanchangamPlace();
  const { language, ready: languageReady } = useLanguage();
  const version = useSyncExternalStore(subscribe, () => permissionVersion);
  const place: PanchangamPlace | null = chosen
    ? { latitude: chosen.latitude, longitude: chosen.longitude, timeZone: chosen.timeZone }
    : devicePlace;

  useEffect(() => {
    // Until the saved city and language are read, the phone's location may
    // not be the place to use, nor English the language to write in.
    if (!ready || !languageReady) return;
    queueRefresh(place, language);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") queueRefresh(place, language);
    });
    return () => subscription.remove();
  }, [ready, languageReady, place?.latitude, place?.longitude, place?.timeZone, language, version]);
}
