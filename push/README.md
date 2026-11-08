# DayNest reminder pusher (free, no card)

A tiny Cloudflare Worker that makes DayNest reminders ring **even when the app is closed**.

- **Cost:** Cloudflare Workers free plan + free D1 database. No payment method needed.
- **Privacy:** the server stores only your phone's push address and the _minutes_ to wake it (next 7 days). It never sees reminder text, names or habits. Each push carries just a timestamp, encrypted end-to-end (RFC 8291). Your phone then shows the real reminder from its own data, with **Mark done ✓** and **Snooze** buttons.
- **Works on:** Android (Chrome, Edge, Samsung Internet), desktop browsers, and iPhone/iPad once DayNest is added to the Home Screen (iOS 16.4+).

How it works: every minute the worker checks which phones have a reminder due and sends each one a standard Web Push. The app keeps the list of minutes up to date whenever you change a reminder or tick a habit.

## One-time setup (about 10 minutes)

You need Node.js on your computer (or use a GitHub Codespace). All commands run from the repository root unless noted.

### 1. Create keys

```bash
npm run push:keys
```

It prints a **public key** (safe to share) and a **private key** (secret, keep it out of chat, Git and screenshots).

### 2. Cloudflare account

Sign up at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) with your email (free plan). Then:

```bash
cd push
npx wrangler login
```

### 3. Create the database

```bash
npx wrangler d1 create daynest-push
```

Copy the printed `database_id` into `push/wrangler.toml`. Then create the tables:

```bash
npx wrangler d1 execute daynest-push --remote --file=schema.sql
```

### 4. Fill in `push/wrangler.toml`

- `ALLOWED_ORIGIN`: your DayNest address, e.g. `https://daynest.vercel.app` (no trailing slash)
- `VAPID_PUBLIC_KEY`: the public key from step 1

### 5. Add the private key and deploy

```bash
npx wrangler secret put VAPID_PRIVATE_KEY   # paste the private key when asked
npx wrangler deploy
```

Note the URL it prints, e.g. `https://daynest-push.<your-name>.workers.dev`. Check it: opening `…/health` should show `{"ok":true}`.

### 6. Tell the app (Vercel)

Vercel → your project → **Settings → Environment Variables**, add for _Production_:

- `VITE_PUSH_URL` = the worker URL from step 5
- `VITE_PUSH_PUBLIC_KEY` = the public key from step 1

Then **Redeploy** (Deployments → ⋯ → Redeploy).

### 7. Turn it on, on your phone

Open DayNest from the home-screen icon → **Routines** → **Reminders when DayNest is closed** → switch on → allow notifications.

## Limits (free plan, more than enough for a family)

- 1 cron run per minute (1,440/day) out of 100,000 free requests/day.
- D1 free tier: millions of reads and 100,000 writes per day. DayNest writes a few hundred rows per day at most.
- If your phone doesn't open DayNest for 7 days, the reminder list runs out. Opening the app refreshes it.
- A push is delivered at most ~1 minute late. Anything more than 10 minutes late is skipped.

## Develop

```bash
npm test               # includes push/src/*.test.ts (crypto verified against an independent decoder)
npx tsc -p push/tsconfig.json
cd push && npx wrangler dev --test-scheduled   # local run; trigger the cron at /__scheduled
```
