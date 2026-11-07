# App Store privacy answers (iOS)

Draft answers for **App Store Connect → App Privacy**, based on what the iOS
build sends off the device. Re-check this file whenever a service under
`mobile/services/` starts sending something new.

Last checked: 2026-11-07, app version 1.3.0 (build 28).

## Privacy policy URL

`https://vedantayojana.org/privacy-policy.html`
(also linked in the app: Settings → Privacy Policy)

## Data collection

**Do you or your third-party partners collect data from this app?** Yes,
for the two items below only.

| Data type (Apple category) | What it is | Sent to | Purpose | Linked to user? | Tracking? |
|---|---|---|---|---|---|
| Identifiers → Device ID | Expo push token, with platform and app language | `vedantayojana.org/_push`, Expo push service | App Functionality (announcement notifications) | No | No |
| Identifiers → Device ID | Anonymous EAS Update client ID (`expo-eas-client`) | Expo (`u.expo.dev`) | App Functionality (over-the-air updates) | No | No |

Answer **No tracking** overall: the app has no ads, no third-party
analytics and no data broker, so App Tracking Transparency is not needed.

## Not collected (and why)

| Item | Why it is not "collected" |
|---|---|
| Location | Used on the device to compute the Panchangam. Reverse geocoding uses Apple's own service. Never sent to our servers (`mobile/services/panchangamService.ts`). |
| Usage analytics | The reading ping (`mobile/services/readingPingService.ts`) runs on Android only; iOS sends nothing. |
| Bookmarks, reading position, settings | Stored only on the device (AsyncStorage). |
| Content downloads | Book, catalog, announcement and version files are plain downloads with no user data attached. |

## Other App Store Connect fields

- **Age rating:** no objectionable content; no user-generated content.
- **Export compliance:** `ITSAppUsesNonExemptEncryption` is `false` in `mobile/app.json`.
- **Required-reason APIs:** declared in `mobile/app.json` under `ios.privacyManifests`.
