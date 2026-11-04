/** Editorial publication timezone is Asia/Kolkata (UTC+05:30, no DST). */
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
export function publicationInstant(announcement) {
  return announcement.publishAt ? Date.parse(announcement.publishAt) : Date.parse(announcement.date + 'T00:00:00Z') - IST_OFFSET_MS;
}
export function eligibleForPush(announcement, now) {
  const published = publicationInstant(announcement);
  // Keep the existing two-day freshness policy, anchored to the end of the
  // IST publication date rather than UTC midnight.
  const istDayEnd = Date.parse(announcement.date + 'T00:00:00Z') - IST_OFFSET_MS + DAY_MS - 1;
  return Number.isFinite(published) && published <= now && istDayEnd >= now - 2 * DAY_MS;
}

export const PUSH_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{16,256}\]$/;
const LANGUAGES = new Set(['en', 'ta', 'kn', 'hi', 'te']);
export function subscription(value) {
  if (!value || !PUSH_TOKEN.test(value.token) || !['ios', 'android'].includes(value.platform) || !LANGUAGES.has(value.language)) return null;
  return { token: value.token, platform: value.platform, language: value.language };
}
export function targets(announcement, platform) {
  return announcement.platforms.includes('app') && (!announcement.mobilePlatforms || announcement.mobilePlatforms.includes(platform));
}
export function messageFor(announcement, subscriber) {
  const t = announcement.translations?.[subscriber.language];
  const body = (t?.body ?? announcement.body).replace(/\s+/g, ' ').trim();
  return { to: subscriber.token, title: (t?.title ?? announcement.title).slice(0, 120),
    body: body.length > 220 ? body.slice(0, 217) + '…' : body,
    // Expo's default priority is "normal" on Android, which FCM holds back
    // while the phone dozes; "high" delivers promptly (iOS already uses it).
    sound: 'default', channelId: 'announcements', ttl: 86400, priority: 'high',
    data: { announcementId: announcement.id } };
}

/**
 * Expo errors that say nothing about the device: the project's push
 * credentials (FCM V1 key missing, or from another Firebase project) or a
 * rate limit. The message is kept and retried, without using up its
 * attempts, until it is too old to be news, so fixing the credentials also
 * delivers what was queued meanwhile.
 */
export const RETRYABLE_ERRORS = new Set(['InvalidCredentials', 'MismatchSenderId', 'MessageRateExceeded']);
export const RETRY_DELAY_MS = 30 * 60_000;
export const RETRY_WINDOW_MS = 12 * 3_600_000;
export function retryable(error, created, now) {
  return RETRYABLE_ERRORS.has(error) && now - created < RETRY_WINDOW_MS;
}
