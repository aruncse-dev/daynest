# DayNest — Product Plan & Claude Code Build Guide

> **Product:** DayNest  
> **Tagline:** Plan your day. Build better habits. Keep your family organised.  
> **Product type:** Mobile-first, offline-first Progressive Web App (PWA)  
> **Initial release:** Local-only, single-device app with multiple family profiles

## 1. Product vision

DayNest is a calm, lightweight personal and family planner. It should help people decide what matters today, follow a few meaningful habits, remember important dates, and see family activities without creating another complicated system to maintain.

**Core UX principle:** Open it for two minutes in the morning and two minutes at night. Avoid unnecessary data entry, screens, notifications, gamification, and configuration.

The supplied `mock-ui.html` is the visual direction and interaction prototype. Treat it as a reference, not production code. Rebuild the UI cleanly in React components.

## 2. Target experience

- Mobile-first layout; comfortable on small Android and iPhone screens.
- Installable PWA with app icon, manifest, and service worker.
- Dashboard is the default landing screen.
- Desktop gets a compact sidebar/top navigation; mobile gets a bottom navigation bar.
- Light theme first; dark theme can follow.
- Warm neutral background, white surfaces, muted sage-green accent, rounded cards, subtle borders, restrained shadows.
- Large readable touch targets (minimum ~44px where practical).
- Quick-add task always easy to reach.
- No account, backend, cloud database, or analytics in v1.

## 3. Navigation / information architecture

1. **Home** — today summary, priority tasks, habits, family overview, upcoming events.
2. **Tasks** — Today, Upcoming, Someday, Completed; priority, due date, assignee, category, recurrence.
3. **Habits** — daily/weekly habits, one-tap completion, history, streaks, monthly heatmap.
4. **Calendar** — month/week agenda; tasks, events, important dates.
5. **Family** — local profiles, assigned tasks, habits, activity overview.
6. **Goals** — personal/family goals, weekly and monthly plans, linked tasks.
7. **Settings** — profiles, theme, backup/restore, data export, app information.

Keep Goals accessible from Home or a secondary menu if five-item mobile navigation is cleaner.

## 4. Dashboard requirements

The Home screen should show, in this order:

- Greeting and current local date.
- Compact stats: tasks completed, habits completed, optional daily progress.
- Today's priorities (only the most relevant 3–5 items).
- Daily habits with one-tap check-off.
- This-week calendar strip and next 1–3 events.
- Family corner: profile avatars and lightweight completion summary.
- One-tap quick add.

Avoid turning the dashboard into a dense analytics page. Do not show a score that shames family members; progress should be informative and encouraging.

## 5. Functional scope

### Tasks

- Create, edit, complete, reopen, archive, and delete.
- Title, notes (optional), due date, optional time, priority, category, assignee, linked goal.
- Views: Today, Upcoming, Someday, Completed.
- Recurrence: daily, weekdays, selected weekdays, weekly, monthly.
- Preserve completion history for recurring tasks. A recurring task should create/represent dated occurrences; checking off today's occurrence must not complete future occurrences.
- Overdue items should be visible but not alarmist.

### Habits

- Create, edit, pause, archive, and delete.
- Frequency: every day or selected weekdays.
- Optional target label (e.g. 20 minutes, 6 glasses).
- One completion record per habit per local calendar date.
- Completion history, current streak, longest streak, monthly heatmap.
- Editing a habit must not rewrite historical completion records.
- Paused/archived habits must not count against current-day completion.

### Calendar

- Month and week views, plus a simple agenda list.
- Display dated task occurrences, events, and important dates.
- Tapping a date opens that day's agenda.
- Use local date-only values for all-day items; avoid UTC conversion bugs.

### Goals and plans

- Goal title, description, owner, target date, status.
- Link tasks to goals.
- Weekly/monthly plan can be a named grouping of tasks and goals.
- Show simple progress based on completed linked tasks; document how progress is calculated.

### Family profiles

- Multiple profiles stored on the same device.
- Profile name, optional emoji/avatar, optional color.
- Assign tasks and habits to a profile.
- Provide per-profile views and a combined family view.
- No child accounts, login, permissions, or remote sharing in v1.
- Do not expose personal profile data to third-party services.

## 6. Recommended stack

- React + TypeScript + Vite
- Tailwind CSS
- shadcn/ui where useful; do not over-componentise
- Lucide icons
- Dexie.js over IndexedDB
- Zustand only for transient UI state; IndexedDB remains source of truth
- vite-plugin-pwa / Workbox for installability and offline app shell
- Vitest + React Testing Library for tests
- date-fns for date operations, with explicit local-date handling

Prefer stable, maintained packages and keep dependencies lean.

## 7. Data model (initial proposal)

Use Dexie schema with versioned migrations. IDs should be UUIDs.

- `profiles`: id, name, avatar, color, createdAt, updatedAt, archivedAt
- `tasks`: id, title, notes, dueDate, dueTime, priority, category, profileId, goalId, recurrenceRule, status, createdAt, updatedAt, archivedAt
- `taskOccurrences`: id, taskId, localDate, status, completedAt
- `habits`: id, title, description, emoji, profileId, scheduleDays, targetLabel, status, createdAt, updatedAt, archivedAt
- `habitEntries`: id, habitId, localDate, completedAt, note
- `events`: id, title, localDate, startTime, endTime, profileId, notes, type
- `goals`: id, title, description, profileId, targetDate, status, createdAt, updatedAt
- `settings`: key, value, updatedAt
- `backupHistory`: id, createdAt, filename, destination, status, errorMessage

Use indexes for profileId, dueDate/localDate, status, and parent IDs as appropriate. Add unique constraints or application-level guards to prevent duplicate habit entries for the same habit/date.

Store dates consistently:

- `localDate` as `YYYY-MM-DD` string.
- Timestamps as ISO strings.
- Never parse a date-only string as UTC and then display it as local time.
- Add tests around midnight, month boundaries, leap years, and daylight-saving changes where relevant.

## 8. Offline-first and PWA

- The app must load after first successful install/load with network disabled.
- Cache the app shell and versioned static assets.
- All user data is written to IndexedDB immediately.
- Show a subtle offline/online indicator; do not block core features offline.
- Handle storage errors and quota errors gracefully.
- Explain that browser data can be cleared by the user/browser and backups are essential.
- Do not cache private user exports or backup files in the service worker cache.
- Add a visible app version and database schema version in Settings.

## 9. Backup and restore — critical

Implement three levels:

1. **Immediate persistence:** every user change saved to IndexedDB.
2. **Manual export/import:** export a versioned JSON file containing all tables and metadata; import validates schema and asks whether to replace or merge.
3. **Optional folder backup:** use the File System Access API when available and explicitly granted by the user. Save dated JSON snapshots to a selected folder. Request permission in a user gesture; handle revoked permissions. Do not promise silent background writes or backups while the browser is closed.

Because browser support varies, provide download-based JSON export as the universal fallback.

Daily snapshot policy:

- On app launch, if a folder is configured and permission is still available, create at most one snapshot per local date.
- Keep a configurable retention count (e.g. last 30 snapshots).
- Never delete the only valid backup.
- Show last backup time, destination, and status.
- Add a “Back up now” action.
- Validate imports before modifying existing data.
- Offer a dry-run summary (profiles, tasks, habits, entries, events, goals).
- Test corrupt JSON, older backup versions, duplicate IDs, empty backup, and interrupted import.

## 10. Privacy and safety

- No login and no backend in v1.
- No external analytics, trackers, or third-party data sharing.
- Do not commit real family data, exports, or backups to Git.
- Include `.gitignore` entries for exports, backups, local data, and environment files.
- Public repository contains code only; local data remains in browser storage.
- Explain that profiles on one device are not remotely synchronised.
- Do not imply that a local-only app provides a secure vault; browser storage is not encrypted by default.

## 11. Delivery phases

### Phase 0 — project foundation

- Create Vite React TypeScript app.
- Configure Tailwind, icons, routing, linting, formatting, tests.
- Establish tokens and reusable primitives.
- Add the mock UI as a visual acceptance reference.

### Phase 1 — UI prototype

- Implement responsive shell and bottom navigation.
- Build Home, Tasks, Habits, Calendar, Family, Goals, Settings screens.
- Use clearly labelled sample data.
- Match the supplied mock UI visual language.
- Verify mobile widths (360px, 390px, 430px) and desktop.

### Phase 2 — local data

- Add Dexie schema and migrations.
- Implement CRUD and autosave.
- Add task occurrences and habit entries.
- Add empty, loading, error, and no-data states.

### Phase 3 — PWA and offline

- Manifest, icons, service worker, install prompt guidance.
- Test airplane mode after first load.
- Test update flow when a new version is deployed.

### Phase 4 — backup / restore

- Versioned JSON export/import.
- Optional folder permission and dated snapshots.
- Restore validation and tests.

### Phase 5 — polish

- Accessibility and keyboard support.
- Dark mode.
- Helpful onboarding and sample-data reset.
- Performance and responsive QA.
- Deployment documentation.

## 12. Acceptance criteria

- User can install DayNest as a PWA on a supported mobile browser.
- Core app opens offline after initial installation.
- Creating/editing/completing tasks and habits persists after refresh and browser restart.
- Family profiles can be created and selected locally.
- Habit history remains correct after editing a habit.
- Recurring task completion affects only the selected occurrence.
- Calendar dates display correctly in the user's local timezone.
- Full JSON export can be imported into a fresh browser and restores all supported records.
- Unsupported folder backup API falls back cleanly to file download.
- No personal data is sent to a server.
- Layout works on small mobile screens without horizontal scrolling.

## 13. Claude Code working instructions

1. Read this file and `mock-ui.html` before coding.
2. First return a concise implementation plan and proposed component tree.
3. Build one phase at a time; do not attempt the entire product in one pass.
4. After each phase, run typecheck, lint, and tests; fix failures before proceeding.
5. Keep the app runnable at every stage.
6. Do not add authentication, cloud sync, finance, health records, chat, AI features, or social features unless explicitly requested.
7. Do not replace IndexedDB with localStorage for primary data.
8. Keep all sample data obviously fictional and provide a reset action.
9. Ask before introducing a dependency with a paid service or account requirement.
10. Update this file's progress checklist as work is completed.

## 14. Initial build checklist

- [x] Phase 0: foundation — Vite + React 19 + TS, Tailwind v4 tokens, Lucide, router, ESLint/Prettier, Vitest
- [x] Phase 1: responsive UI — shell, bottom nav (mobile) / pill nav (desktop), all screens; verified 360/390/430px + desktop
- [x] Phase 2: IndexedDB and CRUD — Dexie schema v1, task occurrences, unique habit entries, empty/loading/error states
- [x] Phase 3: offline PWA — injectManifest service worker, manifest + icons, update prompt, offline indicator
- [x] Phase 4: export/import and folder backup — validated JSON import (dry-run, merge/replace, atomic), daily folder snapshots with retention
- [~] Phase 5: polish and deployment — dark mode, onboarding, sample-data reset, Vercel config done; full a11y audit pending

### Direction update (owner feedback, Nov 2026)

- **One phone, self-first, with family tracking.** Family members (spouse / child / parent / other) are local profiles on the same phone (no sharing/sync). The Family tab is always visible and offers role-based ideas that open prefilled editors. "For" pickers appear once a member exists; Today shows only your items.
- **Mobile only, minimal navigation:** 4 tabs (Today · Plan · Routines · Family). Settings is one short page behind the avatar. Prefer one page with sections over sub-tabs. Keep padding tight.
- **Connected reminders:** habits, to-dos and events carry their own reminders (`Reminder.link`). They only fire when the item is due and not done; Done on the reminder completes the item; deleting the item deletes its reminder.
- **Predefined content must suit anyone.** No niche presets (e.g. footwear, kids, work-only).
- **No health advice.** No guided exercise, yoga or breathing content. Health items are neutral habits, never pre-ticked.
- **No sample data.** A 30-second auto-playing tour shows examples without saving anything.
- **Local-storage app:** loads from the web; user data stays on the device. Today nudges toward backups and installing.
- **Deploy only from `main`** (Vercel `ignoreCommand`).
- **Always-on reminders (optional):** `push/` is a free Cloudflare Worker (cron every minute + D1) sending standard Web Push. It stores only push endpoints and wake-up minutes; the service worker builds the notification from local data. Enabled when `VITE_PUSH_URL` + `VITE_PUSH_PUBLIC_KEY` are set.
- **Proposed, not built:** family sharing via the user's own encrypted Google Sheet.

**Deployment target:** Public GitHub repository + Vercel free tier (deploys from `main` only). Deploy static assets only; no secrets or personal data in the repository.
