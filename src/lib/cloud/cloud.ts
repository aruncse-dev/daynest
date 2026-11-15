/**
 * The family copy in Google Sheets: turn on, unlock on another phone, sync, turn off.
 * No DayNest server is involved; the phone talks to Google directly.
 */
import { DATA_TABLES, db } from '@/db/db'
import { getSetting, setSetting } from '@/db/actions'
import { SETTING_ONBOARDED } from '@/db/keys'
import {
  deriveKeys,
  keysMatch,
  makeCheck,
  newKeyCode,
  newSalt,
  normalizeKeyCode,
  type FamilyKeys,
} from './crypto'
import {
  createFamilySheet,
  findFamilySheet,
  getToken,
  GoogleSheetStore,
  hasToken,
  renameFile,
  listShares,
  pickSharedFile,
  shareFile,
  unshare,
  type Share,
  signOutGoogle,
} from './google'
import { syncOnce } from './sync'
import { clearInvite, inviteLink, type Invite } from './invite'
import { ME_KEY, RING_KEY } from '@/lib/me'

export const CLOUD_SHEET = 'cloudSheetId'
export const CLOUD_CODE = 'cloudKeyCode'
export const CLOUD_LAST = 'cloudLastSync'
export const CLOUD_ERROR = 'cloudError'
/** Switched off on this phone, but the link and key code are kept so switching on is instant. */
export const CLOUD_PAUSED = 'cloudPaused'
/** Layout of the Sheet itself (tabs and columns). Record shapes are versioned per entry. */
export const SHEET_FORMAT = 1

let cached: { sheet: string; code: string; keys: FamilyKeys } | null = null
let running: Promise<{ pulled: number; pushed: number }> | null = null

async function keysFor(sheet: string, code: string, salt: string) {
  if (cached?.sheet === sheet && cached.code === code) return cached.keys
  const keys = await deriveKeys(code, salt)
  cached = { sheet, code, keys }
  return keys
}

async function saveState(sheet: string, code: string) {
  await setSetting(CLOUD_SHEET, sheet)
  await setSetting(CLOUD_CODE, code)
  await setSetting(CLOUD_PAUSED, false)
}

async function syncWith(sheet: string, code: string) {
  const store = new GoogleSheetStore(sheet)
  const { meta } = await store.readAll()
  if (!meta) throw new Error('Sheet is damaged: key details missing')
  if (meta.v > SHEET_FORMAT) throw new Error('Update DayNest first')
  const keys = await keysFor(sheet, code, meta.salt)
  if (!(await keysMatch(keys, meta.check))) throw new Error('Wrong key code')
  const r = await syncOnce(db, store, keys)
  await setSetting(CLOUD_LAST, new Date().toISOString())
  // another phone runs a newer DayNest: its newest changes wait here until this one updates
  await setSetting(
    CLOUD_ERROR,
    r.newer ? `Update DayNest to get ${r.newer} new change${r.newer > 1 ? 's' : ''}` : null,
  )
  return r
}

export type TurnOnResult = { kind: 'created'; code: string } | { kind: 'found'; sheet: string }

/** From a tap: sign in, then create the family Sheet, or find the one this account already has. */
export async function turnOnCloud(): Promise<TurnOnResult | { kind: 'resumed' }> {
  if (await resumeCloud()) return { kind: 'resumed' }
  await getToken(true, 'turnOn')
  const existing = await findFamilySheet()
  if (existing) return { kind: 'found', sheet: existing }
  return createNew()
}

/**
 * Start over without the old key code: the old family copy is renamed (kept in Drive, never
 * deleted) and a new one is created with a new key code from this phone's data.
 */
export async function startFresh(oldSheet: string) {
  await getToken(true, 'turnOn')
  const day = new Date().toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
  await renameFile(oldSheet, `DayNest family (old, ${day})`)
  return createNew()
}

async function createNew(): Promise<{ kind: 'created'; code: string }> {
  const sheet = await createFamilySheet()
  const code = newKeyCode()
  const salt = newSalt()
  const keys = await keysFor(sheet, code, salt)
  await new GoogleSheetStore(sheet).writeMeta({
    v: SHEET_FORMAT,
    salt,
    check: await makeCheck(keys),
    createdAt: new Date().toISOString(),
  })
  await saveState(sheet, code)
  await syncWith(sheet, code)
  return { kind: 'created', code }
}

/**
 * Open an existing family Sheet with its key code. `replace` swaps this phone's data for the
 * family copy (best on a new phone); otherwise both are combined.
 */
export async function unlockCloud(
  sheet: string,
  input: string,
  replace: boolean,
  /** false: the caller finishes setting up the phone, then opens the app itself */
  enterApp = true,
) {
  const code = normalizeKeyCode(input)
  if (!code) throw new Error('Key code = 20 letters/numbers')
  const store = new GoogleSheetStore(sheet)
  const { meta } = await store.readAll()
  if (!meta) throw new Error('Sheet is damaged: key details missing')
  const keys = await deriveKeys(code, meta.salt)
  if (!(await keysMatch(keys, meta.check))) throw new Error('Wrong key code')
  cached = { sheet, code, keys }
  if (replace) {
    await db.transaction(
      'rw',
      [...DATA_TABLES.map((t) => db.table(t)), db.tombstones],
      async () => {
        for (const t of DATA_TABLES) if (t !== 'settings') await db.table(t).clear()
        await db.tombstones.clear()
      },
    )
  }
  await saveState(sheet, code)
  const r = await syncWith(sheet, code)
  if (enterApp) await setSetting(SETTING_ONBOARDED, true)
  return r
}

/** Sync if the family copy is on. `interactive` = from a tap (may show Google's window). */
export async function syncCloud(interactive = false) {
  const sheet = await getSetting<string | null>(CLOUD_SHEET, null)
  const code = await getSetting<string | null>(CLOUD_CODE, null)
  if (!sheet || !code) return null
  if (await getSetting(CLOUD_PAUSED, false)) return null
  if (!interactive && !hasToken()) return null
  if (running) return running
  running = (async () => {
    try {
      await getToken(interactive)
      return await syncWith(sheet, code)
    } catch (e) {
      await setSetting(CLOUD_ERROR, e instanceof Error ? e.message : String(e))
      throw e
    } finally {
      running = null
    }
  })()
  return running
}

/** Switch off on this phone: data stays here, the Sheet stays in Drive, the key code is kept. */
export async function pauseCloud() {
  await setSetting(CLOUD_PAUSED, true)
  await setSetting(CLOUD_ERROR, null)
}

/** Switch back on after a pause (from a tap). False if this phone was never linked. */
export async function resumeCloud(): Promise<boolean> {
  const sheet = await getSetting<string | null>(CLOUD_SHEET, null)
  const code = await getSetting<string | null>(CLOUD_CODE, null)
  if (!sheet || !code) return false
  await setSetting(CLOUD_PAUSED, false)
  await syncCloud(true)
  return true
}

/** Forget the link and key code on this phone. The Sheet and the other phones are untouched. */
export async function turnOffCloud() {
  for (const k of [CLOUD_SHEET, CLOUD_CODE, CLOUD_LAST, CLOUD_ERROR, CLOUD_PAUSED])
    await db.settings.delete(k)
  cached = null
  signOutGoogle()
}

/* ---------- Family: invite (owner) and join (new phone) ---------- */

/** Share the family file with someone's own Google email and make their invite link. */
export async function inviteToFamily(profileId: string, email: string) {
  const sheet = await getSetting<string | null>(CLOUD_SHEET, null)
  const code = await getSetting<string | null>(CLOUD_CODE, null)
  if (!sheet || !code) throw new Error('Turn on Google mode first')
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Check the email')
  await getToken(true)
  await shareFile(sheet, email)
  const me = (await db.profiles.toArray()).find((p) => p.isPrimary)
  return inviteLink({ f: sheet, k: code, p: profileId, n: me?.name })
}

/** The invite link again (for someone already shared with), without sharing anew. */
export async function inviteLinkFor(profileId: string) {
  const sheet = await getSetting<string | null>(CLOUD_SHEET, null)
  const code = await getSetting<string | null>(CLOUD_CODE, null)
  if (!sheet || !code) return null
  const me = (await db.profiles.toArray()).find((p) => p.isPrimary)
  return inviteLink({ f: sheet, k: code, p: profileId, n: me?.name })
}

export async function familyShares(): Promise<Share[]> {
  const sheet = await getSetting<string | null>(CLOUD_SHEET, null)
  return sheet ? listShares(sheet) : []
}

/** Stop sharing the family file with someone. */
export async function removeFromFamily(permissionId: string) {
  const sheet = await getSetting<string | null>(CLOUD_SHEET, null)
  if (sheet) await unshare(sheet, permissionId)
}

/**
 * Join with an invite on a new phone (from a tap): sign in with your own Google account,
 * tap the shared file once in Google's chooser, then the family copy opens with the key code
 * and this phone becomes the invited person's.
 */
export async function joinFamily(inv: Invite, replace: boolean) {
  await getToken(true, 'join')
  const picked = await pickSharedFile(inv.f)
  if (!picked) throw new Error('Tap the DayNest family file to join')
  if (picked !== inv.f) throw new Error('That’s a different file: pick the DayNest family one')
  const r = await unlockCloud(inv.f, inv.k, replace, false)
  if (inv.p && (await db.profiles.get(inv.p))) await setSetting(ME_KEY, inv.p)
  await setSetting(RING_KEY, 'mine')
  clearInvite()
  // last: opening the app now finds no pending invite
  await setSetting(SETTING_ONBOARDED, true)
  return r
}
