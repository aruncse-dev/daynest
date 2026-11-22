import { db } from './db'
import { withTimeout } from '@/lib/timeout'

/**
 * Opening the database at start-up, without ever leaving DayNest on its launch screen for good.
 *
 * Opening IndexedDB can hang instead of failing:
 * - on a cold launch of the installed app, WebKit's IndexedDB is sometimes not ready and the
 *   open never answers. Dexie's built-in Safari 14 workaround (`idbReady`) only waits for it,
 *   with no limit. Relaunching the app works, so StartupGate does the same: it cancels the
 *   stuck open and starts a fresh one.
 * - another connection (DayNest in another tab, or the service worker, which opens this same
 *   database) can hold an older version and block an upgrade. Dexie closes its own connections
 *   on `versionchange` by default (nothing here turns that off), so this should be brief;
 *   if not, the launch screen says what is going on.
 */

let opening: Promise<void> | null = null
let blocked = false

db.on('blocked', () => {
  blocked = true
})

/** Is another connection holding an older version (so the open is waiting on it)? */
export const openBlocked = () => blocked

/** Open the database, or join the open already under way. */
export function openDb(): Promise<void> {
  if (db.isOpen()) return Promise.resolve()
  if (opening) return opening
  const p: Promise<void> = Promise.resolve(db.open())
    .then(() => {
      blocked = false
    })
    .finally(() => {
      if (opening === p) opening = null
    })
  opening = p
  return p
}

/** Start over: cancel an open that seems stuck (or close the open database) and open again. */
export async function reopenDb(): Promise<void> {
  const stuck = opening
  // Dexie's close() cancels an open under way: that open rejects with DatabaseClosedError.
  // Wait briefly for it to wind down, or the next open would just join the stuck one.
  db.close()
  if (stuck) await withTimeout(stuck, 1_000).catch(() => undefined)
  opening = null
  blocked = false
  return openDb()
}
