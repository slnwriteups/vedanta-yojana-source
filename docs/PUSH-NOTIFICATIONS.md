# Announcement push notifications

## Implemented behavior

Notifications are on by default (owner decision, 4 November 2026). The app asks for notification permission once, automatically: at the end of onboarding for new readers, or on the first launch of this version for existing readers (`autoEnableNotifications` in `mobile/services/pushNotifications.ts`). If permission is granted, announcements are subscribed, unless the reader had already turned them off with the in-app switch, and the Ekadasi reminders schedule. Settings keeps one in-app switch, for announcements, because Apple's App Store guideline 4.5.4 requires an in-app opt-out for promotional push. Ekadasi reminders are informational, so they have no in-app switch; they are turned off in phone settings (on Android, the "Ekadasi reminders" channel alone). Turning notifications off in phone settings unsubscribes announcements but keeps the reader's choice, so allowing them again there resubscribes. All controls are translated into the five interface languages. Preferences refresh on language changes, foreground and token renewal. Opt-out removes the subscription and queued work. Notification taps open the exact announcement in the existing in-app reader.

The Cloudflare service stores the Expo token, platform, language and registration timestamps in a SQLite Durable Object. It polls published announcements every minute, so a notification follows the website deploy within about a minute, respects mobile-platform targeting and translation fallback, and deduplicates by announcement ID/token. Initial deployment baselines old notices without sending a backlog. Tickets are followed by receipt checks; invalid tokens are removed, network retries are bounded, dormant subscriptions expire at 180 days and delivery queue entries at two days. An accepted ticket is not proof of delivery, and an ambiguous transport failure can cause a bounded duplicate.

The public API can register/unregister a token but cannot trigger broadcasts or supply notification content. Tokens are validated, requests size/rate limited, origins checked where supplied, and no token listings or token logs exist. Possession of a push token authorizes subscription updates/removal. No reading history, account or location is linked to it.

## Activation requirements

1. The feature branch deploys the new Cloudflare workflow using existing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID. The token must permit Worker/route/Durable Object deployment. Missing credentials fail visibly. Check `https://vedantayojana.org/_push/status`.
2. In the existing Expo project, configure **FCM v1** credentials for Android and set **GOOGLE_SERVICES_JSON** as an EAS **file** environment variable for the matching Firebase app. Upload the FCM service-account credential to EAS Credentials; never commit keys. Android cloud builds fail if the app configuration is absent.
3. Configure an **Apple APNs key** and push-capable provisioning profile in EAS Credentials. New signed binaries are mandatory; OTA alone cannot add native modules.
4. The feature-branch workflow requests iOS production and Android production-APK builds using EXPO_TOKEN. It does not submit to stores or publish a download link. A successful request is not proof that the queued EAS build finished; inspect the reported build IDs.
5. Install new builds and test real-device delivery, language/OS targeting, foreground/background/cold-start taps and opt-out with a new announcement published after subscription. Tests never trigger a production broadcast.
6. Publish the signed APK and submit the iOS build. Update store privacy answers for optional push tokens used for app functionality. Only then advertise Android versionCode 18 in `public/app-version.json` and remove `mobile/native-release-pending.json`. Until then the existing manifest correctly advertises the real v17 download; tests validate this explicit staging state.

The new version is 1.3.0, Android code 18. The appVersion runtime policy prevents notification code being sent to older 1.1/1.2 binaries that lack the native module. Keep this feature separate from the Tamil content OTA.

## Delivery health and Android troubleshooting

`https://vedantayojana.org/_push/status` reports, per platform, when Expo last accepted a notification (`lastAcceptedAt`) and the last error category it returned (`lastError`, `lastErrorAt`). It never shows tokens or subscriber counts.

- `InvalidCredentials` on `android`: Expo has no working FCM V1 key. On expo.dev → Credentials → Android → `com.slnwriteups.vedantayojana`, upload a service-account key generated in Firebase project `vedanta-yojana-8b0de` (Project settings → Service accounts). No app build or OTA is needed.
- `MismatchSenderId`: the FCM key is from a different Firebase project than the app's `google-services.json`. Replace it with a key from `vedanta-yojana-8b0de`.
- These errors, and `MessageRateExceeded`, belong to the project, not the device. Messages that hit them are retried every 30 minutes, without using up their five attempts, for 12 hours after queuing, so a credential fix also delivers what was queued in that time. Device errors are not retried.

Messages are sent with `priority: 'high'`. Expo's default is normal priority on Android, which FCM holds back while the phone is idle (Doze).

The released v18 APK was checked on 4 November 2026. It contains the Firebase client for `com.slnwriteups.vedantayojana` (project `vedanta-yojana-8b0de`) and Expo's FCM messaging service, and the Firebase API key accepts its release signing certificate (SHA-1 `1D:99:66:22:1F:6A:15:9B:B6:50:E5:CC:B4:01:78:A0:2D:88:FC:ED`).

## Validation

`node --test cloudflare/announcement-push/core.test.mjs`; Wrangler dry-run; content/app/mobile tests; web/mobile typechecks; Expo export for both platforms. Do not describe notifications as live until backend deployment, platform credentials, native distribution and a real-device delivery test have succeeded.
