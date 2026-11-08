# DayNest 🌿

**Plan your day. Build better habits. Keep your family organised — gently.**

DayNest is a calm, mobile-first, offline-first Progressive Web App. No account, no server, no analytics: everything is stored in your browser (IndexedDB) on your device.

## Features

- **Home dashboard** — greeting, today's priorities, one-tap habits, week strip, upcoming events, family corner, next reminder, daily motivation.
- **Tasks** — Today / Upcoming / Someday / Completed; priority, category, assignee, linked goal, notes; recurrence (daily, weekdays, selected days, weekly, monthly). Completing a recurring task only completes _that day's_ occurrence.
- **Habits** — every day or selected weekdays, target labels, current & longest streaks, monthly heatmap (tap to fix a missed day), pause/archive without affecting history.
- **Wellness** — guided breathing (calm, box, 4-7-8) with an animated breathing orb, meditation timer with soft bells, yoga flows (morning wake-up, desk reset, evening wind-down), no-equipment exercise (5-min energiser, family move break, 10-min strength). Keeps the screen awake during sessions and logs mindful minutes.
- **Reminders** — presets for _drink water, sit straight, wear footwear, stand & stretch, rest your eyes, deep breaths, morning yoga, evening meditation, step outside, screens off_ plus fully custom reminders (every N minutes within a window, or at fixed times, on chosen weekdays). Snooze, chime, vibration and local system notifications.
- **Calendar** — month, week and agenda views; events, appointments, school days, birthdays & yearly important dates.
- **Family** — multiple local profiles with avatar & colour, per-person and combined views.
- **Goals & plans** — this week / this month / long-term; link tasks; progress = completed one-off linked tasks ÷ one-off linked tasks (recurring tasks support a goal but aren't counted).
- **Backup & restore** — versioned JSON export, validated import with dry-run summary and merge/replace (runs in one transaction — all or nothing), optional daily snapshots to a folder (File System Access API, Chromium) with retention.
- **PWA** — installable, works offline after the first load, update prompt when a new version is deployed. Light & dark themes.

## About notifications & reminders

DayNest has no backend, so it can't send _push_ notifications. Reminders are scheduled on the device and fire while DayNest is open — in a tab, in the background, or as an installed app that the OS keeps alive. They appear as an in-app card (with chime/vibration) and, if permission is granted, as a system notification. If the browser is fully closed, reminders can't fire; a missed reminder is shown when you return within 10 minutes. On iPhone, notifications need DayNest installed to the Home Screen (iOS 16.4+).

True background reminders would require a push server (Web Push + VAPID) — intentionally out of scope for the local-only v1.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run lint
npm test           # Vitest: dates/DST/leap years, recurrence, streaks, reminders, backup, UI smoke test
npm run build && npm run preview   # test the PWA / offline mode
```

Stack: React 19 · TypeScript · Vite · Tailwind CSS v4 · Dexie (IndexedDB) · Zustand (UI state only) · date-fns · Lucide · vite-plugin-pwa (Workbox, injectManifest) · Vitest + Testing Library.

### Project layout

```
src/
  db/           Dexie schema (versioned), types, CRUD actions, seed + reminder presets
  lib/          date (local YYYY-MM-DD only), recurrence, habits/streaks, reminders, backup, wellness content
  components/   ui primitives, layout (shell, nav, toasts, reminder runner), sheets (editors), wellness players
  screens/      Home, Tasks, Habits, Wellness, Calendar, Family, Goals, Reminders, Settings, More, Onboarding
  sw.ts         service worker: precache app shell, SPA fallback, notification click
docs/mock-ui.html   original visual reference
```

## Deploy to Vercel (free tier)

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repository.
3. Framework preset **Vite** is detected automatically (`vercel.json` sets `npm run build` → `dist`). No environment variables are needed.
4. Deploy. `vercel.json` adds SPA rewrites, no-cache headers for `sw.js` / the manifest (so updates roll out), and long-lived caching for hashed assets.

Then open the site on your phone and choose **Install app / Add to Home Screen**.

## Privacy

- No login, backend, analytics or trackers. Nothing is sent to a server.
- Browser storage is **not encrypted** — anyone using the same device profile can open DayNest.
- Browsers may clear site data; DayNest asks for persistent storage, but **export backups regularly**.
- Never commit real exports or backups — `.gitignore` excludes `daynest-backup-*.json`, `exports/`, `backups/`.

Sample data is clearly marked _(sample)_ and can be reset from **Settings → Sample data**.
