import { getSetting, setSetting } from '@/db/actions'
import { computeSlots } from './pushSchedule'

/**
 * Always-on reminders via standard Web Push and a tiny free server (see /push).
 * The server only learns this phone's push address and the minutes to wake it — never reminder text.
 * Configure at build time: VITE_PUSH_URL and VITE_PUSH_PUBLIC_KEY.
 */
const PUSH_URL = (import.meta.env.VITE_PUSH_URL as string | undefined)?.replace(/\/$/, '')
const PUSH_KEY = import.meta.env.VITE_PUSH_PUBLIC_KEY as string | undefined

export const PUSH_ENABLED_KEY = 'pushEnabled'
const DEVICE_KEY = 'pushDevice'
const HASH_KEY = 'pushHash'
export const LAST_SYNC_KEY = 'pushLastSync'
/** Settings that belong to this phone only (excluded from backups). */
export const PUSH_LOCAL_SETTINGS = [PUSH_ENABLED_KEY, DEVICE_KEY, HASH_KEY, LAST_SYNC_KEY]

export function pushConfigured(): boolean {
  return !!PUSH_URL && !!PUSH_KEY
}

/** On iPhone this is only true once DayNest has been added to the Home Screen. */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const s = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function device(): Promise<{ id: string; secret: string }> {
  const existing = await getSetting<{ id: string; secret: string } | null>(DEVICE_KEY, null)
  if (existing) return existing
  const rand = (n: number) =>
    [...crypto.getRandomValues(new Uint8Array(n))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  const d = { id: `dn-${rand(12)}`, secret: rand(32) }
  await setSetting(DEVICE_KEY, d)
  return d
}

type GetRegistration = () => Promise<ServiceWorkerRegistration>
const defaultRegistration: GetRegistration = () => navigator.serviceWorker.ready

async function subscription(getReg: GetRegistration, create: boolean) {
  const reg = await getReg()
  const existing = await reg.pushManager.getSubscription()
  if (existing || !create) return existing
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(PUSH_KEY!),
  })
}

export type EnableResult = 'on' | 'denied' | 'unsupported' | 'error'

/** Must be called from a tap (browsers require a user gesture for the permission prompt). */
export async function enablePush(): Promise<EnableResult> {
  if (!pushConfigured() || !pushSupported()) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  try {
    await subscription(defaultRegistration, true)
    await setSetting(PUSH_ENABLED_KEY, true)
    await syncPush({ force: true })
    return 'on'
  } catch (e) {
    console.warn('Could not turn on always-on reminders', e)
    return 'error'
  }
}

export async function disablePush() {
  await setSetting(PUSH_ENABLED_KEY, false)
  await setSetting(HASH_KEY, null)
  try {
    const d = await device()
    await fetch(`${PUSH_URL}/schedule`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    })
    const sub = await subscription(defaultRegistration, false)
    await sub?.unsubscribe()
  } catch {
    /* offline: the server forgets this phone after 60 days anyway */
  }
}

/**
 * Send the next 7 days of reminder minutes to the push server, if anything changed.
 * Safe to call often; also used by the service worker after a snooze.
 */
export async function syncPush({
  force = false,
  getReg = defaultRegistration,
}: { force?: boolean; getReg?: GetRegistration } = {}) {
  if (!pushConfigured() || !(await getSetting(PUSH_ENABLED_KEY, false))) return
  const sub = await subscription(getReg, true)
  if (!sub) return
  const slots = await computeSlots()
  const json = sub.toJSON()
  const hash = JSON.stringify([json.endpoint, slots])
  if (!force && (await getSetting<string | null>(HASH_KEY, null)) === hash) return
  const d = await device()
  const res = await fetch(`${PUSH_URL}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...d,
      subscription: { endpoint: json.endpoint, keys: json.keys },
      slots,
    }),
  })
  if (!res.ok) throw new Error(`Push server said ${res.status}`)
  await setSetting(HASH_KEY, hash)
  await setSetting(LAST_SYNC_KEY, new Date().toISOString())
}
