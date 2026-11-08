# DayNest 🌿

**Brighter days for you and your family.** Plan the day, keep a few good habits, get friendly nudges, and put the phone down at night.

DayNest is a mobile web app. The app loads from the web (Vercel); **everything you enter is saved only on your phone** in browser storage (IndexedDB). No account, no server database, no analytics.

## What's inside — 4 tabs, nothing more

| Tab          | What it does                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today**    | Greeting, a daily positive thought + family smile idea, progress ring, next nudge. Tabs: **To-do · Habits · Family**. Morning check-in: _“Did you have a phone-free night?”_ |
| **Plan**     | **To-dos** (today / next 2 weeks / someday / done, repeating to-dos) · **Calendar** (month + day agenda, birthdays) · **Goals** (week / month / long-term, with steps)       |
| **Routines** | **Habits** (tap to check, tap › for streaks & monthly history, one-tap habit ideas) · **Nudges** (for me / family & kids / ideas) · **Phone-free** 🌙 (digital wellbeing)    |
| **Family**   | Everyone's day — tap a person to expand. Shared to-dos anyone can help with.                                                                                                 |

Settings (theme, backup, privacy, setup wizard) is behind your avatar in the top corner.

### Setup wizard 🪄

First launch asks: your name → family members (partner / kids / others) → what would make life better (health, calm, family time, kids routines, digital wellbeing, home, learning, work) → your rhythm (wake time, phone-down time, weekdays). It then **suggests habits, nudges and repeating to-dos** (recommended ones pre-ticked) and creates the ones you keep. Re-run it anytime from Settings — it never duplicates.

### Nudges that make you smile

Presets include _drink water, sit straight, wear footwear, stretch, rest your eyes, deep breaths, yoga time, step outside, plan tomorrow, focus block_, kids' _brush teeth, school bag, homework, bedtime story_, and family _dinner together, hug o'clock, call the grandparents_. Or create your own (every N minutes in a window, or at set times, on chosen days).

- **Important** nudges pop up in the middle of the screen with an animated card, confetti for kids/family, stay until you tap Done, chime louder, and still come through during phone-free time.
- **Gentle** nudges drop in from the top with a playful animation and a cheerful line, then fade away.

### Phone-free evenings 🌙 (digital wellbeing)

One switch sets it up: a _“Phone-free soon”_ nudge 15 minutes before, an **important** _“Phone down, heart up”_ nudge at your chosen time (default 10 PM), a **No phone after 10 PM** habit, and muting of normal nudges until morning. If you open DayNest during that time it shows a calm “It's phone-free time” screen (with an honest _“Just 5 minutes — it's important”_ option). Each morning, Today asks whether you kept it, one tap to log it. The tab also links to Android _Bedtime mode_ / iPhone _Downtime_, which can actually limit the phone; a web app can't.

### How nudges are delivered (honest version)

There's no server, so nudges are scheduled on the phone. They appear while DayNest is open or running in the background (install it to the home screen for best results) as an in-app animated card plus, if allowed, a phone notification. If the app is fully closed they can't fire; one missed by less than 10 minutes shows when you return. On iPhone, add DayNest to the Home Screen to allow notifications (iOS 16.4+).

## Your data

- Saved only in this phone's browser storage. Clearing browser data erases it, so use **Settings → Backup** (JSON export/import with preview, merge or replace, all-or-nothing; optional daily folder snapshots on Chrome/Android).
- Browser storage isn't encrypted; anyone using the phone's browser can open DayNest.
- Family-sharing via your own Google Sheet (end-to-end encrypted) is a **proposed** next step, not built yet. See the concept in the plan.

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
  db/          Dexie schema, types, actions, sample data, nudge presets, setup apply
  lib/         dates (local YYYY-MM-DD), recurrence, streaks, nudge scheduling, phone-free hours,
               setup suggestions, habit templates, backup, positive content
  components/  ui primitives, tabs, shell & nav, nudge host, phone-free guard, editor sheets
  screens/     Today, Plan, Routines, Family, Settings, Setup (wizard)
```

## Deploy (Vercel, main branch only)

`vercel.json` contains an `ignoreCommand` so **only commits to `main` are built and deployed**. Other branches are skipped.

One-time setup (needs your Vercel login):

1. vercel.com → **Add New → Project** → import `aruncse-dev/daynest`.
2. Framework **Vite** is detected (`npm run build` → `dist`). No environment variables needed. Production branch: `main`.
3. Deploy. From then on every push to `main` redeploys automatically.

On your phone, open the site → browser menu → **Add to Home Screen / Install app**.
