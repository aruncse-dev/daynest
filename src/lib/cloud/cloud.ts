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
  signOutGoogle,
} from './google'
import { syncOnce } from './sync'

export const CLOUD_SHEET = 'cloudSheetId'
export const CLOUD_CODE = 'cloudKeyCode'
export const CLOUD_LAST = 'cloudLastSync'
export const CLOUD_ERROR = 'cloudError'
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
}

async function syncWith(sheet: string, code: string) {
  const store = new GoogleSheetStore(sheet)
  const { meta } = await store.readAll()
  if (!meta) throw new Error('The family Sheet is missing its key details.')
  if (meta.v > SHEET_FORMAT)
    throw new Error('This family Sheet needs a newer DayNest. Close and reopen the app to update.')
  const keys = await keysFor(sheet, code, meta.salt)
  if (!(await keysMatch(keys, meta.check))) throw new Error('That key code does not match.')
  const r = await syncOnce(db, store, keys)
  await setSetting(CLOUD_LAST, new Date().toISOString())
  // another phone runs a newer DayNest: its newest changes wait here until this one updates
  await setSetting(
    CLOUD_ERROR,
    r.newer
      ? `${r.newer} change${r.newer > 1 ? 's' : ''} came from a newer DayNest. Close and reopen the app to update.`
      : null,
  )
  return r
}

export type TurnOnResult = { kind: 'created'; code: string } | { kind: 'found'; sheet: string }

/** From a tap: sign in, then create the family Sheet, or find the one this account already has. */
export async function turnOnCloud(): Promise<TurnOnResult> {
  await getToken(true)
  const existing = await findFamilySheet()
  if (existing) return { kind: 'found', sheet: existing }
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
export async function unlockCloud(sheet: string, input: string, replace: boolean) {
  const code = normalizeKeyCode(input)
  if (!code) throw new Error('A key code has 20 letters and numbers, like K7QM-2XPA-…')
  const store = new GoogleSheetStore(sheet)
  const { meta } = await store.readAll()
  if (!meta) throw new Error('The family Sheet is missing its key details.')
  const keys = await deriveKeys(code, meta.salt)
  if (!(await keysMatch(keys, meta.check)))
    throw new Error('That key code does not match this family Sheet.')
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
  await setSetting(SETTING_ONBOARDED, true)
  return r
}

/** Sync if the family copy is on. `interactive` = from a tap (may show Google's window). */
export async function syncCloud(interactive = false) {
  const sheet = await getSetting<string | null>(CLOUD_SHEET, null)
  const code = await getSetting<string | null>(CLOUD_CODE, null)
  if (!sheet || !code) return null
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

/** Stop syncing on this phone. The Sheet and the other phones are untouched. */
export async function turnOffCloud() {
  for (const k of [CLOUD_SHEET, CLOUD_CODE, CLOUD_LAST, CLOUD_ERROR]) await db.settings.delete(k)
  cached = null
  signOutGoogle()
}
