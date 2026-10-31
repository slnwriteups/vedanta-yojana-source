# Announcement push notifications

## Implemented behavior

Optional notification controls in Settings/onboarding, translated into all five interface languages. Permission is requested only when the reader taps Enable and the subscription service is reachable. Preferences refresh on language changes, foreground and token renewal. Opt-out removes the subscription and queued work. Notification taps open the exact announcement in the existing in-app reader.

The Cloudflare service stores the Expo token, platform, language and registration timestamps in a SQLite Durable Object. It polls published announcements every ten minutes, respects mobile-platform targeting and translation fallback, and deduplicates by announcement ID/token. Initial deployment baselines old notices without sending a backlog. Tickets are followed by receipt checks; invalid tokens are removed, network retries are bounded, dormant subscriptions expire at 180 days and delivery queue entries at two days. An accepted ticket is not proof of delivery, and an ambiguous transport failure can cause a bounded duplicate.

The public API can register/unregister a token but cannot trigger broadcasts or supply notification content. Tokens are validated, requests size/rate limited, origins checked where supplied, and no token listings or token logs exist. Possession of a push token authorizes subscription updates/removal. No reading history, account or location is linked to it.

## Activation requirements

1. The feature branch deploys the new Cloudflare workflow using existing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID. The token must permit Worker/route/Durable Object deployment. Missing credentials fail visibly. Check `https://vedantayojana.org/_push/status`.
2. In the existing Expo project, configure **FCM v1** credentials for Android and set **GOOGLE_SERVICES_JSON** as an EAS **file** environment variable for the matching Firebase app. Upload the FCM service-account credential to EAS Credentials; never commit keys. Android cloud builds fail if the app configuration is absent.
3. Configure an **Apple APNs key** and push-capable provisioning profile in EAS Credentials. New signed binaries are mandatory; OTA alone cannot add native modules.
4. The feature-branch workflow requests iOS production and Android production-APK builds using EXPO_TOKEN. It does not submit to stores or publish a download link. A successful request is not proof that the queued EAS build finished; inspect the reported build IDs.
5. Install new builds and test real-device delivery, language/OS targeting, foreground/background/cold-start taps and opt-out with a new announcement published after subscription. Tests never trigger a production broadcast.
6. Publish the signed APK and submit the iOS build. Update store privacy answers for optional push tokens used for app functionality. Only then advertise Android versionCode 18 in `public/app-version.json` and remove `mobile/native-release-pending.json`. Until then the existing manifest correctly advertises the real v17 download; tests validate this explicit staging state.

The new version is 1.3.0, Android code 18. The appVersion runtime policy prevents notification code being sent to older 1.1/1.2 binaries that lack the native module. Keep this feature separate from the Tamil content OTA.

## Validation

`node --test cloudflare/announcement-push/core.test.mjs`; Wrangler dry-run; content/app/mobile tests; web/mobile typechecks; Expo export for both platforms. Do not describe notifications as live until backend deployment, platform credentials, native distribution and a real-device delivery test have succeeded.
