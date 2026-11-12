import { sendPush, type VapidKeys } from './webpush'
import type { Store } from './store'

export const MAX_SLOTS = 600 // ~7 days of reminders
export const HORIZON_MIN = 8 * 24 * 60
export const STALE_MIN = 10
export const TEST_DELAY_MS = 10_000 // don't deliver a reminder more than 10 minutes late
const DEVICE_TTL_MS = 60 * 24 * 3600 * 1000 // forget devices not seen for 60 days

export interface Config {
  allowedOrigin: string
  vapid: VapidKeys
  /** delay before a test push (default 10 s) */
  testDelayMs?: number
}

async function sha256(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** ALLOWED_ORIGIN may list several addresses, comma-separated (e.g. vercel.app + a custom domain). */
function originAllowed(cfg: Config, origin: string | null): boolean {
  if (cfg.allowedOrigin === '*') return true
  return (
    !!origin &&
    cfg.allowedOrigin
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .includes(origin)
  )
}

function cors(cfg: Config, origin: string | null): Record<string, string> {
  const ok = originAllowed(cfg, origin)
  return ok
    ? {
        'Access-Control-Allow-Origin': cfg.allowedOrigin === '*' ? '*' : origin!,
        'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      }
    : {}
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

interface ScheduleBody {
  id?: unknown
  secret?: unknown
  subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  slots?: unknown
}

/**
 * HTTP API used by the app:
 *   POST   /schedule  { id, secret, subscription, slots: epochMinute[] }  → save device + replace its slots
 *   DELETE /schedule  { id, secret }                                      → forget device
 *   POST   /test      { id, secret }                                      → one test push in ~10 s
 * The device secret (random, kept on the phone) stops anyone else changing or deleting a device.
 * Only push addresses and times are stored; never reminder text.
 */
export async function handleRequest(
  req: Request,
  store: Store,
  cfg: Config,
  now = Date.now(),
  /** keep work running after the response (Cloudflare's ctx.waitUntil) */
  defer: (work: Promise<unknown>) => void = (w) => void w,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const url = new URL(req.url)
  const h = cors(cfg, req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  if (url.pathname === '/health') return json({ ok: true }, 200, h)
  if (url.pathname !== '/schedule' && url.pathname !== '/test')
    return json({ error: 'Not found' }, 404, h)
  if (!originAllowed(cfg, req.headers.get('Origin')))
    return json({ error: 'Origin not allowed' }, 403, h)

  let body: ScheduleBody
  try {
    body = (await req.json()) as ScheduleBody
  } catch {
    return json({ error: 'Invalid JSON' }, 400, h)
  }
  const id = typeof body.id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.id) ? body.id : null
  const secret =
    typeof body.secret === 'string' && body.secret.length >= 32 && body.secret.length <= 128
      ? body.secret
      : null
  if (!id || !secret) return json({ error: 'Missing id or secret' }, 400, h)
  const secretHash = await sha256(secret)
  const existing = await store.getDevice(id)
  if (existing && existing.secretHash !== secretHash) return json({ error: 'Forbidden' }, 403, h)

  if (url.pathname === '/test') {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, h)
    if (!existing) return json({ error: 'Turn on reminders first' }, 404, h)
    // wait a few seconds so the person can lock the phone or switch apps
    const delayMs = cfg.testDelayMs ?? TEST_DELAY_MS
    defer(
      new Promise((r) => setTimeout(r, delayMs)).then(() =>
        sendPush(
          { endpoint: existing.endpoint, keys: { p256dh: existing.p256dh, auth: existing.auth } },
          { test: true, at: now },
          cfg.vapid,
          fetchImpl,
        ),
      ),
    )
    return json({ ok: true, inSeconds: delayMs / 1000 }, 202, h)
  }

  if (req.method === 'DELETE') {
    if (existing) await store.deleteDevice(id)
    return json({ ok: true }, 200, h)
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, h)

  const sub = body.subscription
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : ''
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : ''
  const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : ''
  if (
    !/^https:\/\//.test(endpoint) ||
    endpoint.length > 1024 ||
    !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) ||
    !/^[A-Za-z0-9_-]{16,32}$/.test(auth)
  )
    return json({ error: 'Invalid subscription' }, 400, h)
  if (!Array.isArray(body.slots) || body.slots.length > MAX_SLOTS)
    return json({ error: 'Invalid slots' }, 400, h)
  const nowMin = Math.floor(now / 60000)
  const slots = [
    ...new Set(
      body.slots.filter(
        (s): s is number =>
          Number.isInteger(s) && s > nowMin - STALE_MIN && s <= nowMin + HORIZON_MIN,
      ),
    ),
  ]

  await store.saveDevice({ id, endpoint, p256dh, auth, secretHash, updatedAt: now }, slots)
  return json({ ok: true, slots: slots.length }, 200, h)
}

/** Runs every minute: send a push for each due slot, then clean up. */
export async function runCron(
  store: Store,
  cfg: Config,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
) {
  const nowMin = Math.floor(now / 60000)
  const due = await store.dueSlots(nowMin, 200)
  const gone = new Set<string>()
  let sent = 0
  for (const s of due) {
    if (gone.has(s.deviceId) || s.at < nowMin - STALE_MIN) continue
    try {
      const status = await sendPush(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        { at: s.at * 60000 },
        cfg.vapid,
        fetchImpl,
      )
      if (status === 404 || status === 410)
        gone.add(s.deviceId) // subscription expired or revoked
      else if (status < 300) sent++
    } catch {
      /* network hiccup: the slot is dropped; the app catches up when opened */
    }
  }
  for (const id of gone) await store.deleteDevice(id)
  await store.deleteSlotsUpTo(nowMin)
  if (nowMin % 1440 === 0) await store.pruneDevices(now - DEVICE_TTL_MS)
  return { due: due.length, sent, removed: gone.size }
}
