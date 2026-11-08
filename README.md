# DayNest 🌿

**Brighter days, one small step at a time.** Plan your day, keep a few habits you choose, get friendly nudges, and put the phone down at night.

DayNest is a mobile web app. The app loads from the web (Vercel); **everything you enter is saved only on your phone** in browser storage (IndexedDB). No account, no server database, no analytics.

## What's inside: 3 tabs

DayNest is for **managing your own day**. Family features stay hidden unless you switch them on.

| Tab          | What it does                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today**    | Greeting, a daily positive thought, and **one list** with today's to-dos and habits. Then what's coming up next (a nudge or an event). Morning check-in: _“Did you have a phone-free night?”_ |
| **Plan**     | **Upcoming** (next 2 weeks + someday ideas) · **Calendar** · **Goals**                                                                                                                        |
| **Routines** | One page: the **Phone-free evenings** switch, **My habits**, **My nudges**                                                                                                                    |

**Settings** (behind your avatar) is one short page: name, _I also plan for my family_, theme, chime, backup, tour, setup, privacy.

**Family mode (optional).** Switching on _I also plan for my family_ adds a **Family** tab, assigning to-dos and habits to people, and kids & family nudges.

### First run: tour + setup wizard 🪄

- **30-second tour**: auto-playing example screens (like a short video). Nothing is saved; there is no sample data.
- **Setup wizard**: your name → (optional) family members → what you'd like help with → wake-up and phone-down times → suggestions you tick → done. Re-run anytime from Settings without getting duplicates.

### No health advice

DayNest doesn't coach exercise, yoga or breathing. Health items are **habits you track your own way**: no prescribed durations, never pre-ticked, with a note to ask a doctor before starting something new. Only things that follow from your own answers (like the phone-down time you chose) are pre-ticked.

### Nudges that make you smile

Ideas include _drink water, sit straight, wear footwear, stand up for a bit, time to move, step outside, take a pause, quiet time, rest your eyes, plan tomorrow, focus block_. With family mode on there are also kids' and family nudges. Or create your own (every N minutes in a window, or at set times, on chosen days).

- **Important** nudges pop up in the middle of the screen with an animated card, stay until you tap Done, chime louder, and still come through during phone-free time.
- **Gentle** nudges drop in from the top with a playful animation and a cheerful line, then fade away.

### Phone-free evenings 🌙

One switch sets everything up: a _“Phone-free soon”_ nudge 15 minutes before, an **important** _“Phone down, heart up”_ nudge at your chosen time (default 10 PM), a **No phone after 10 PM** habit, and quiet nudges until morning. Opening DayNest during that time shows a calm reminder screen (with an honest _“just 5 minutes”_ option). Pair it with Android _Bedtime mode_ or iPhone _Downtime_, which can actually limit the phone; a web app can't.

### Do notifications work when the app is closed?

**No, not reliably.** There's no server, so DayNest can't wake itself up. Nudges appear while DayNest is open or still running in the background; installing it to the home screen helps. If the app is fully closed, nothing fires. A nudge missed by less than 10 minutes shows when you come back. Reliable closed-app alerts would need either a push server (which would have to know your reminder times) or your phone's own alarms/calendar.

## Your data

- Saved only in this phone's browser storage. Clearing browser data erases it, so use **Settings → Backup** (JSON export/import with preview, merge or replace, all-or-nothing; optional daily folder snapshots on Chrome/Android).
- Browser storage isn't encrypted; anyone using the phone's browser can open DayNest.
- Sharing via your own Google Sheet (end-to-end encrypted) is a **proposed** idea, not built.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck && npm run lint && npm test
npm run build && npm run preview
```

React 19 · TypeScript · Vite · Tailwind CSS v4 · Dexie (IndexedDB) · Zustand (UI state only) · date-fns · Lucide · vite-plugin-pwa · Vitest + Testing Library.

```
src/
  db/          Dexie schema, types, actions, nudge presets, setup apply
  lib/         dates (local YYYY-MM-DD), recurrence, streaks, nudge scheduling, phone-free hours,
               setup suggestions, habit templates, backup, positive content
  components/  ui primitives, tabs, tour, shell & nav, nudge host, phone-free guard, editor sheets
  screens/     Today, Plan, Routines, Family (optional), Settings, Setup (wizard)
```

## Deploy (Vercel, main branch only)

`vercel.json` contains an `ignoreCommand` so **only commits to `main` are built and deployed**. Other branches are skipped.

One-time setup (needs your Vercel login):

1. vercel.com → **Add New → Project** → import `aruncse-dev/daynest`.
2. Framework **Vite** is detected (`npm run build` → `dist`). No environment variables needed. Production branch: `main`.
3. Deploy. From then on every push to `main` redeploys automatically.

On your phone, open the site → browser menu → **Add to Home Screen / Install app**.
