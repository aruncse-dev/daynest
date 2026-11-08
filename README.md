# DayNest 🌿

**Brighter days, one small step at a time.** Plan your day, keep a few habits you choose, get friendly nudges, and put the phone down at night.

DayNest is a mobile web app. The app loads from the web (Vercel); **everything you enter is saved only on your phone** in browser storage (IndexedDB). No account, no server database, no analytics.

## What's inside: 4 tabs

DayNest is for **managing your own day** on one phone, and for keeping track of your **family's** routines and activities (nothing is shared or synced).

| Tab          | What it does                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today**    | Greeting, a daily positive thought, one helpful card for the moment, then **one list** with today's to-dos and habits, and what's coming up. |
| **Plan**     | **Upcoming** (next 2 weeks + someday ideas, done tucked away) · **Calendar** (events, appointments, birthdays)                               |
| **Routines** | One page: the **Phone-free evenings** switch, **My habits**, **My reminders** (stand-alone nudges)                                           |

**Settings** (behind your avatar) is one short page: name, family members, theme, chime, backup, tour, setup again, privacy.

### Family (one phone, nothing shared)

Keep track of your **spouse, kids and parents** on your phone: their routines, activities and appointments. Nothing is shared or synced.

- The **Family** tab is always there. Add a **Spouse**, **Child**, **Parent** or someone else (name, picture, colour), in the tab, in Settings, or in the optional setup step.
- Tap a person to see their day, with **ideas for their role**. Each idea opens prefilled so you can adjust the time:
  - **Child:** reading time, brush teeth, homework, pack school bag, activity class, school event
  - **Parent:** medicine taken, call / check in, walk together, doctor appointment, groceries, birthday
  - **Spouse:** talk about our day, appreciate them, date night, birthday, anniversary
- To-dos, habits, reminders and events have a **For** choice (Me / Priya / Mia / …).
- Their reminders ring on this phone with their name, e.g. _“Amma: Medicine taken”_.
- **Today** stays about you, with a small strip linking to the family's day. _Coming up for the family_ lists their appointments and birthdays.

### Everything is connected 🔔

- A **habit** can have reminder times. The reminder only fires on the habit's days and stays quiet once you've done it.
- A **to-do** with a time can remind you _at the time_, _15 min_ or _1 hour before_. Any to-do can remind you _the morning of_.
- An **event** can remind you the same way.
- Tapping **Mark done ✓** on a habit or to-do reminder ticks that item off.
- Deleting a habit, to-do or event removes its reminder too.

### Helper card on Today (one at a time)

1. Evening heads-up before phone-free time, or the morning _“Did you have a phone-free night?”_
2. After 6 PM: _“2 to-dos still open — move to tomorrow?”_
3. A backup reminder if the last backup is over 14 days old (your data lives only on this phone).
4. _Add DayNest to your home screen_, with an Install button on Android or Share → Add to Home Screen steps on iPhone.

### First run: tour + setup wizard 🪄

- **30-second tour**: auto-playing example screens. Nothing is saved; there is no sample data.
- **Setup**: name → what would help (organised day, less screen time, body basics, calm mind, learning) → wake-up and phone-down times → suggestions you tick, with reminder times already tuned → done.

### No health advice

DayNest doesn't coach exercise, yoga or breathing. Health items are habits you track your own way: no prescribed durations, never pre-ticked, and a note to ask a doctor before starting something new.

### Reminder ideas that suit anyone

_Drink water, posture check, rest your eyes, take a pause, step outside_, plus the phone-free pair. Anything personal you create yourself (e.g. _take my tablet_). **Important** reminders stay on screen until you tap Done and still come through during phone-free time.

### Phone-free evenings 🌙

One switch sets everything up: a heads-up 15 minutes before, an important _“Phone down, heart up”_ reminder (default 10 PM), a **No phone after 10 PM** habit, quiet reminders until morning, and a calm screen if you open DayNest late. Pair it with Android _Bedtime mode_ or iPhone _Downtime_, which can actually limit the phone.

### Reminders when the app is closed (optional, free) 🔔

Out of the box, reminders appear while DayNest is open or running in the background. For reminders that ring **even when the app is closed**, deploy the tiny free push server in [`push/`](push/README.md) (Cloudflare Workers free plan, no card, about 10 minutes). Then add `VITE_PUSH_URL` and `VITE_PUSH_PUBLIC_KEY` in Vercel and turn on **Routines → Reminders when DayNest is closed**.

The server only stores your phone's push address and the minutes to wake it; never reminder text. Notifications have **Mark done ✓** and **Snooze 10 min** buttons.

## Your data

- Saved only in this phone's browser storage. Clearing browser data erases it, so use **Settings → Backup** (JSON export/import with preview, merge or replace, all-or-nothing; optional daily folder snapshots on Chrome/Android).
- Browser storage isn't encrypted; anyone using the phone's browser can open DayNest.
- Family sharing (e.g. via your own encrypted Google Sheet) is parked until there's real usage.

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
  db/          Dexie schema, types, actions, reminder presets, reminder links, setup apply
  lib/         dates (local YYYY-MM-DD), recurrence, streaks, nudge scheduling, phone-free hours,
               setup suggestions, habit templates, backup, positive content
  components/  ui primitives, tabs, tour, shell & nav, nudge host, phone-free guard, editor sheets
  screens/     Today, Plan, Routines, Settings, Setup (wizard)
```

## Deploy (Vercel, main branch only)

`vercel.json` contains an `ignoreCommand` so **only commits to `main` are built and deployed**. Other branches are skipped.

One-time setup (needs your Vercel login):

1. vercel.com → **Add New → Project** → import `aruncse-dev/daynest`.
2. Framework **Vite** is detected (`npm run build` → `dist`). No environment variables needed. Production branch: `main`.
3. Deploy. From then on every push to `main` redeploys automatically.

On your phone, open the site → browser menu → **Add to Home Screen / Install app**.
