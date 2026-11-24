# Grahaṇam on the Panchangam calendar: design

Owner request, 23 Nov 2026: when a lunar or solar eclipse is visible at the
reader's place, show it on the Panchangam calendar (website and app) with
the affected nakshatram and rāśi, advise chanting Vishnu Sahasranamam and
placing darbha grass on the fridge and other perishable food, and send an
app reminder at 10 AM the day before. Move the Ekadasi reminder from 7 AM
to 10 AM.

## Goals

- Every eclipse that can be seen from the reader's place (chosen city or
  phone location) appears on the local day it is first seen.
- Times are the place's own: astronomical contacts (sparśam, madhyam,
  mokṣam; total phase when there is one) and, separately, the part that can
  be seen there (Moon or Sun above the horizon).
- The eclipse's nakshatram and rāśi are shown.
- The owner's guidance is shown with it: chant Vishnu Sahasranamam during
  the grahaṇam; before it begins, place darbha grass on the fridge and on
  other perishable food.
- App reminder at 10 AM on the place's clock, the day before.
- Ekadasi reminder at 10 AM instead of 7 AM.

## Non-goals (owner decision)

- No fasting or bhojana cutoff and no list of janma nakshatras needing
  parihāram. The Pādukā (Feb 2026, Aug 2025) and the Ahobila Math calendar
  PDF do not give them; the owner chose to leave them out entirely.
- No "What's New" entry per eclipse (those go to every reader worldwide).
- No server push: reminders are scheduled on the phone, like Ekadasi.

## Approaches

1. **Calculate on the device with Astronomy Engine (chosen).** MIT, no
   dependencies, offline on web and native. Checked against the Pādukā:
   3 Mar 2026 Srirangam 3:19 / 5:03 / 6:47 PM vs printed 3:20 / 5:05 /
   6:47; 7–8 Sep 2025 9:56 PM / 11:41 PM / 1:26 AM vs printed 9:57 /
   11:43 / 1:26. Works for any city, no upkeep.
2. Bundled list of eclipses plus on-device visibility: still needs the
   library for visibility, adds a table to maintain.
3. Hand entry from each Pādukā issue: Srirangam only, gaps when an issue
   isn't transcribed.

## Design

- `content-lib/panchangam-eclipses.ts` (pure, shared by web and app):
  eclipses at a place over a day range. Lunar: total, partial, penumbral
  phases from `SearchLunarEclipse`; visible part = while the Moon is above
  the horizon (flags: already underway at moonrise, sets during it).
  Solar: `SearchLocalSolarEclipse` contacts with the Sun's altitude; the
  local kind (partial/annular/total) and the global kind are both kept.
- Times format through the engine's existing clock and "(+1)" helpers.
- Nakshatram and rāśi: the app's own (traditional) longitude of the Moon
  (lunar) or Sun (solar) at global greatest eclipse, so the label matches
  the rest of the calendar and the Pādukā's saṅkalpam (both test cases
  agree: Pūrva Phalgunī, Pūrva Bhādrapadā).
- Calendar (web `components/home/PanchangamCalendar.tsx`, app
  `mobile/components/PanchangamCalendar.tsx`): a Grahaṇam block on the day,
  labels in all five languages.
- Reminder: `mobile/services/ekadasiReminderCore.ts` gains a grahaṇam plan;
  the service schedules both, grahaṇam on its own Android channel.

## Calls made by the builder (owner can change)

- An eclipse is listed only where some part of it can be seen.
- Every eclipse that can be seen gets the reminder, penumbral ones
  included (owner decision, 24 Nov 2026).
- The eclipse is listed on the local day it is first seen; contacts after
  midnight carry "(+1)".
- If 10 AM the day before has already passed when reminders are scheduled,
  no reminder is sent for that eclipse.
