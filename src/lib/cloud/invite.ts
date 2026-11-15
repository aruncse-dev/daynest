import { normalizeKeyCode } from './crypto'

/**
 * A family invite: which shared file to open, its key code, and who the new phone belongs to.
 * Travels as a link/QR: https://daynestapp.vercel.app/join#v=1&f=…&k=…&p=…&n=…
 * The part after # never reaches any server. On its own the link opens nothing: Google only
 * lets the invited email open the file.
 */
export interface Invite {
  /** the family file (Google Drive id) */
  f: string
  /** family key code */
  k: string
  /** profile id of the person joining */
  p?: string
  /** who invited (shown as "Join Arun's family") */
  n?: string
}

const KEY = 'daynest.invite'
const KEEP_DAYS = 14

export function inviteLink(inv: Invite, origin = location.origin): string {
  const q = new URLSearchParams({ v: '1', f: inv.f, k: inv.k })
  if (inv.p) q.set('p', inv.p)
  if (inv.n) q.set('n', inv.n)
  return `${origin}/join#${q}`
}

/** Reads an invite from a link (or just its #part). Null if it isn't a valid DayNest invite. */
export function parseInvite(text: string): Invite | null {
  const hash = text.includes('#') ? text.slice(text.indexOf('#') + 1) : text
  const q = new URLSearchParams(hash.trim())
  const f = q.get('f')
  const k = normalizeKeyCode(q.get('k') ?? '')
  if (!f || !k || !/^[\w-]{10,}$/.test(f)) return null
  return { f, k, p: q.get('p') ?? undefined, n: q.get('n') ?? undefined }
}

export function savePendingInvite(inv: Invite) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...inv, at: Date.now() }))
  } catch {
    /* private mode */
  }
}

/** An invite opened on this phone and not used yet. */
export function pendingInvite(): Invite | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as (Invite & { at: number }) | null
    if (!v || Date.now() - v.at > KEEP_DAYS * 86_400_000) return null
    return v
  } catch {
    return null
  }
}

export function clearInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** At start-up: an opened invite link (/join#…) is kept for the join screen and the address cleaned. */
export function consumeInviteFromUrl(): boolean {
  if (location.pathname !== '/join') return false
  const inv = parseInvite(location.hash)
  history.replaceState(null, '', '/')
  if (!inv) return false
  savePendingInvite(inv)
  return true
}
