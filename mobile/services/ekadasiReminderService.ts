import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type { PanchangamPlace } from "../../content-lib/panchangam-engine.ts";
import type { LanguageCode } from "../content-lib/preferences.ts";
import { useLanguage } from "../language-context.ts";
import { readJSON, writeJSON } from "../storage.ts";
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
 * whenever the app comes to the foreground, the place or language changes, or the reader turns them
 * on or off in Settings; each run schedules the next
 * EKADASI_REMINDER_HORIZON_DAYS, so reminders keep coming between uses.
 *
 * expo-notifications is native code. An over-the-air update can reach an
 * installed app built before it was added, so it is only loaded once its
 * native module is known to be present; on such a build the reminders
 * stay off until the next app build is installed, and nothing crashes.
 */

const STORAGE_KEY = "ekadasiReminders";
const ANDROID_CHANNEL_ID = "ekadasi-reminders";

let enabled = true;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

async function loadEnabled(): Promise<boolean> {
  if (!loaded) {
    enabled = (await readJSON(STORAGE_KEY, isBoolean)) ?? true;
    loaded = true;
    emit();
  }
  return enabled;
}

/** Turns the Dasami-eve reminders on or off (on by default). */
export function setEkadasiRemindersEnabled(next: boolean): void {
  enabled = next;
  loaded = true;
  emit();
  void writeJSON(STORAGE_KEY, next);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether the reminders are on, for the Settings toggle. */
export function useEkadasiRemindersEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => enabled);
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
      const Notifications = await import("expo-notifications");
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      return Notifications;
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

/** Asks for notification permission if the reader hasn't been asked yet; whether it is granted. */
async function ensurePermission(Notifications: NotificationsModule): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Replaces the scheduled reminders with those for `place` in `language`,
 * or just clears them when they are turned off. Never throws: a reminder
 * that can't be scheduled is a missed convenience, not an error to show.
 */
export async function refreshEkadasiReminders(place: PanchangamPlace | null, language: LanguageCode | null): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;
    const on = await loadEnabled();
    // No place yet (the phone's location not resolved this launch): keep what is already scheduled.
    if (on && !place) return;
    await cancelScheduled(Notifications);
    if (!on || !place) return;
    if (Platform.OS === "android") {
      // Created on the first run, renamed into the reader's language on later ones.
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: ekadasiReminderChannelName(language),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    if (!(await ensurePermission(Notifications))) return;
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
 * reader's language. Mounted once, after onboarding, so the permission
 * prompt never interrupts the first-launch screens.
 */
export function useEkadasiReminders(): void {
  const { place: chosen, ready } = usePanchangamPlace();
  const devicePlace = useDevicePanchangamPlace();
  const { language, ready: languageReady } = useLanguage();
  const on = useEkadasiRemindersEnabled();
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
  }, [ready, languageReady, place?.latitude, place?.longitude, place?.timeZone, language, on]);
}
