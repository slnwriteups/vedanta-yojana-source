# App Review Information — iOS

Answers to App Review's Guideline 2.1 "Information Needed" request for
the first iOS submission of Vedanta Yojana
(`com.slnwriteups.vedantayojana`, version 1.0.3). Keep this file current
and paste the short version (below) into **App Store Connect → App
Review Information → Notes** on every submission.

Items marked **ACTION** must be done or confirmed by the developer
before replying; they cannot be answered from the source code alone.

---

## Short version for the App Review "Notes" field

The Notes field holds 4,000 characters at most. This block is about 2,700.

```
Vedanta Yojana is a free, read-only reference and reading app for Sri Vaishnava / Sanatana Dharma literature. It has NO account, login, sign-up, in-app purchase, subscription, advertising, or user-generated content. A demo account is not needed: every feature is available right after launch.

PURPOSE AND AUDIENCE
For devotees, students, and pilgrims who want reliable information about the 108 Divya Desams (sacred Vishnu temples), original books on Hindu philosophy and epics, and the day's Panchangam (Hindu calendar), all in one place, mostly offline, in English, Tamil, Kannada, Hindi and Telugu.

HOW TO USE
1. Launch the app, pick a language, and tap through the short welcome.
2. Home: the day's Panchangam (tithi, nakshatram, sunrise/sunset, next Ekadashi, Sankalpam) for your location. Allow "While Using" location when asked. If you decline, only the Panchangam is hidden; everything else works.
3. Divya Desams tab: browse all 108 temples. Open one for its history (Sthala Puranam), photos, map link and Pasuram (hymn) PDFs.
4. Library tab: open a book, then a chapter, to read. Bookmark chapters, change text size, and optionally download a book for offline reading.
5. Search tab: offline search across temples and books.
6. Settings: language, theme, reading preferences, and an Instagram link.

EXTERNAL SERVICES
- Sri Ahobila Mutt public calendar service (samdailycal-324121.uc.r.appspot.com, samekadasi-324123.uc.r.appspot.com): computes the Panchangam from the device's coordinates.
- Apple's on-device geocoder (CLGeocoder via expo-location): names the user's location.
- vedantayojana.org (our website, Cloudflare): Library catalogue and optional offline book downloads.
- Expo (u.expo.dev): over-the-air content and bug-fix updates to the JavaScript bundle (no new native code).
- Google Maps / Instagram: external links opened only when the user taps them.
No analytics, advertising, crash-reporting, payment, authentication or AI services are used.

REGIONS
The app works the same in every region. There is no geo-restriction. The Panchangam is calculated for the user's own location by design. Content language is chosen by the user, not the region.

CONTENT
The books, Divya Desam write-ups and translations are the developer's own copyrighted work. The bundled Pasuram (hymn) PDFs come from Prapatti.com and are credited in the app as "Source: Prapatti.com". The Panchangam data is provided by Sri Ahobila Mutt's public calendar. [ACTION: replace with "used with written permission, attached" once permission is obtained, or describe the removal.]

Privacy policy: https://vedantayojana.org/privacy-policy.html
Contact: slnwriteups@gmail.com
```

---

## 1. Screen recording (ACTION — must be recorded on a real device)

Record on an iPhone running the **latest iOS**, using a TestFlight or
release build (not a development build). Use Control Centre → Screen
Recording, starting from the Home Screen so the recording **begins with
launching the app**. Suggested shot list (about 2–3 minutes):

1. Tap the app icon. The first-launch welcome/onboarding appears. Pick a language.
2. The location permission prompt appears. Tap **Allow While Using App**.
   Home shows today's Panchangam, Sankalpam and the Divya Desam spotlight.
3. **Divya Desams** tab: scroll the list, open a temple, scroll the
   Sthala Puranam, open a photo full-screen, then open a Pasuram PDF.
4. **Library** tab: open a book, then a chapter. Read, change the text
   size, bookmark the chapter, go back, and show it under Continue
   Reading/Bookmarks on Home. Optionally show the offline download control.
5. **Search** tab: search for a temple name and a book term, then open a result.
6. **Settings**: switch the language to Tamil and show that the content
   changes, toggle the theme, then switch back.

There is **no** registration, login, account deletion, user-generated
content, or paid content to show. Say this in the reply so the reviewer
doesn't look for it.

Erase the device's location permission for the app first
(Settings → Apps → Vedanta Yojana → Location → Ask Next Time), so the
prompt appears in the recording.

## 2. Purpose and target audience

Vedanta Yojana ("Yatra Jñānam Pravāhati") is a digital home for
Sanātana Dharma literature and sacred-place records.

- **Audience:** Hindu, and especially Sri Vaishnava, devotees,
  students of the epics and of Visishtadvaita philosophy, and pilgrims
  planning visits to the 108 Divya Desams, in India and the diaspora.
- **Problem it solves:** Reliable information about the Divya Desams,
  their hymns (Pasurams), the daily Panchangam and readable
  long-form writing on the Mahabharata, Ramayana and Bhagavatam are
  scattered across printed books, PDFs, blogs and calendar websites,
  mostly in one language. Few of them work well on a phone or offline.
- **Value:** One free, ad-free, account-free app that brings these
  together, works offline (temple data, images, Pasuram PDFs and search
  are bundled; books can be downloaded), and offers English plus Tamil,
  Kannada, Hindi and Telugu.

## 3. Setup and access

- No login or credentials. No sample files needed.
- Location permission is optional and only used for the Panchangam.
- Internet is needed only for the Panchangam, the Library catalogue/book
  downloads and update checks. Everything else works offline.
- See "How to use" in the short version for the feature walkthrough.

## 4. External services

| Service | Used for | Data sent |
|---|---|---|
| Sri Ahobila Mutt calendar (`samdailycal-324121.uc.r.appspot.com`, `samekadasi-324123.uc.r.appspot.com`; Google App Engine) | Panchangam, Ekadashi, Sankalpam | Coordinates, timezone |
| iOS geocoder (via `expo-location`) | Place name for the Panchangam | Coordinates (handled by the OS) |
| `vedantayojana.org` (Cloudflare) | Library catalogue, offline book downloads | Standard HTTP request |
| Expo Updates (`u.expo.dev`) | OTA JavaScript/content updates | Platform, version, random install ID |
| Google Maps, Instagram | Outbound links only, on user tap | None from the app |

No analytics, advertising, crash-reporting, authentication, payment or
AI services. Source: `mobile/services/`, `docs/privacy-policy.html`.

Note on Expo Updates: OTA updates must stay within Guideline 2.5.2 and
the Developer Program License Agreement, which allow bug fixes and
content but not changes to the app's purpose or new native features.

## 5. Regional differences

None. The app is the same in every storefront. The Panchangam depends on
the user's own location because that is what a Panchangam is (sunrise
and tithi times vary by place). The language is chosen by the user. The
Android APK update banner is disabled on iOS
(`mobile/services/updateCheckService.ts`).

## 6. Third-party material (ACTION — this is the item most likely to block approval)

The app isn't in a regulated industry, but it **does include protected
third-party material**. Apple can reject under Guideline 5.2.1 unless
you can show you have the right to use it. From
`CONTENT-LICENSE.md` and the code:

1. **Pasuram PDFs from Prapatti.com.** There are 540+ PDFs bundled in the
   app binary (`mobile/services/pasuramArchive.ts`). They are credited,
   but crediting a source does not give you the right to redistribute it.
   → Get written permission from Prapatti.com and attach it, **or**
   remove the bundled PDFs and link out to prapatti.com instead.
2. **Panchangam from Sri Ahobila Mutt.** The app calls the RPC endpoints
   behind the Mutt's website widgets directly
   (`mobile/services/panchangamService.ts`). There is no published API
   or terms of use for this in the repo.
   → Get written permission from Sri Ahobila Mutt and attach it, **or**
   replace the feature with a Panchangam computed on the device or from a
   licensed provider.
3. **Divya Desam images of unclear provenance.** At least 10 images
   (asset IDs containing `-book-`) appear to be scanned from a
   third-party book, and the provenance of about 184 others wasn't
   verified.
   → Confirm the rights to them, or remove or replace the ones you can't
   clear before submitting.

Attach the permission letters or emails in the reply (App Store Connect
accepts attachments) and summarise them in the Notes. If something is
removed instead, say what was removed.

The books, write-ups and translations are your own work. State that you
are the author and copyright holder (Vishnu Sreenivas, slnwriteups).

## Other things to check before resubmitting

- **`NSLocalNetworkUsageDescription` / `NSBonjourServices`** in
  `mobile/app.json` exist only for the Expo development server. Release
  builds don't use the local network, but a reviewer reading
  "connects to your computer's development server" may flag it under 2.1
  (unfinished app). Consider removing both keys from production builds.
- **Screenshots (2.3.3):** they must show real screens (Panchangam,
  temple detail, reader), not only the splash or welcome screen.
- **App Privacy labels:** declare *Coarse/Precise Location → App
  Functionality, not linked to identity, not used for tracking*. This
  matches the privacy policy.
- **Age rating / category:** Reference or Books. No objectionable content.
