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
    sound: 'default', channelId: 'announcements', ttl: 86400,
    data: { announcementId: announcement.id } };
}
