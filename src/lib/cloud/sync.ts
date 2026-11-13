/**
 * Two-way sync between this phone's IndexedDB and the encrypted family Sheet.
 *
 * - Every record is one Sheet row, keyed by an opaque HMAC of table + id.
 * - The newer edit wins, per record (updatedAt, or completedAt / createdAt).
 * - Deletions travel as rows marked deleted (from this phone's tombstones).
 * - Phone-specific things stay on the phone: when a reminder last rang, snoozes, push and
 *   backup-folder settings, theme and other UI flags.
 */
import { DATA_TABLES, SCHEMA_VERSION, upgradeRecord, type DayNestDB } from '@/db/db'
import { KEY_FIELD } from '@/lib/backup'
import { QUIET_KEY } from '@/lib/quietHours'
import { decryptJson, encryptJson, rowKey, type FamilyKeys } from './crypto'
import type { CloudRow, CloudStore } from './store'

/** The only settings shared through the family copy; everything else is per phone. */
const SHARED_SETTINGS = new Set([QUIET_KEY, 'customEmojis'])
/** Fields that describe this phone, not the record. */
const DEVICE_FIELDS: Partial<Record<string, string[]>> = {
  reminders: ['lastFiredSlot', 'snoozedUntil'],
}
const TOMBSTONE_DAYS = 60

type Rec = Record<string, unknown>
interface Payload {
  t: string
  id: string
  r?: Rec
  /** data version (SCHEMA_VERSION) of the phone that wrote it */
  s?: number
}
/** Entries from before versions were recorded were all written at v3. */
const FIRST_TAGGED = 3
interface LocalItem {
  t: string
  id: string
  rec?: Rec
  ts: string
  deleted: boolean
}

export const stampOf = (rec: Rec): string =>
  (rec.updatedAt ?? rec.completedAt ?? rec.createdAt ?? '1970-01-01T00:00:00.000Z') as string

function strip(t: string, rec: Rec): Rec {
  const fields = DEVICE_FIELDS[t]
  if (!fields) return rec
  const copy = { ...rec }
  for (const f of fields) delete copy[f]
  return copy
}

async function localSnapshot(db: DayNestDB, keys: FamilyKeys) {
  const local = new Map<string, LocalItem>()
  for (const t of DATA_TABLES) {
    const field = KEY_FIELD[t]
    for (const rec of (await db.table(t).toArray()) as Rec[]) {
      if (t === 'settings' && !SHARED_SETTINGS.has(rec.key as string)) continue
      const id = String(rec[field])
      local.set(await rowKey(keys, t, id), { t, id, rec, ts: stampOf(rec), deleted: false })
    }
  }
  for (const tb of await db.tombstones.toArray()) {
    if (tb.table === 'settings' && !SHARED_SETTINGS.has(tb.recordId)) continue
    const k = await rowKey(keys, tb.table, tb.recordId)
    if (!local.has(k))
      local.set(k, { t: tb.table, id: tb.recordId, ts: tb.deletedAt, deleted: true })
  }
  return local
}

async function writtenByNewer(keys: FamilyKeys, r: CloudRow) {
  try {
    return ((await decryptJson<Payload>(keys, r.payload)).s ?? FIRST_TAGGED) > SCHEMA_VERSION
  } catch {
    return false
  }
}

/**
 * Pull newer rows from the Sheet, then push this phone's newer records.
 * `newer`: entries a newer DayNest wrote, left untouched here until this app updates.
 */
export async function syncOnce(db: DayNestDB, store: CloudStore, keys: FamilyKeys) {
  const { rows } = await store.readAll()
  // two phones appending at once can leave duplicate keys: the newest copy counts
  const remote = new Map<string, CloudRow>()
  for (const r of rows) {
    const seen = remote.get(r.key)
    if (!seen || r.updatedAt > seen.updatedAt) remote.set(r.key, r)
  }
  const local = await localSnapshot(db, keys)

  // ---- pull
  const incoming: { p: Payload; row: CloudRow }[] = []
  // entries written by a newer DayNest: this phone can't read them safely, so it leaves them
  // (and never overwrites them) until the app is updated
  const newer = new Set<string>()
  for (const [k, r] of remote) {
    const l = local.get(k)
    if (l && l.ts >= r.updatedAt) continue
    let p: Payload
    try {
      p = await decryptJson<Payload>(keys, r.payload)
    } catch {
      continue // a row this key can't read (damaged or foreign): leave it alone
    }
    const from = p.s ?? FIRST_TAGGED
    if (from > SCHEMA_VERSION) {
      newer.add(k)
      continue
    }
    if (p.r && from < SCHEMA_VERSION) p.r = upgradeRecord(p.t, p.r, from)
    incoming.push({ p, row: r })
  }
  if (incoming.length) {
    const tables = [...new Set(incoming.map((x) => x.p.t))].filter((t) =>
      (DATA_TABLES as readonly string[]).includes(t),
    )
    await db.transaction('rw', [...tables.map((t) => db.table(t)), db.tombstones], async () => {
      db.applyingRemote = true
      try {
        for (const { p, row } of incoming) {
          if (!tables.includes(p.t)) continue
          const table = db.table(p.t)
          if (row.deleted || !p.r) {
            await table.delete(p.id)
            continue
          }
          const existing = (await table.get(p.id)) as Rec | undefined
          const keep: Rec = {}
          for (const f of DEVICE_FIELDS[p.t] ?? [])
            if (existing && f in existing) keep[f] = existing[f]
          // one completion per habit/to-do per day: the incoming one replaces a local twin
          if (p.t === 'habitEntries' || p.t === 'taskOccurrences') {
            const parent = p.t === 'habitEntries' ? 'habitId' : 'taskId'
            const twin = (await table
              .where(`[${parent}+localDate]`)
              .equals([p.r[parent] as string, p.r.localDate as string])
              .first()) as Rec | undefined
            if (twin && twin.id !== p.id) {
              await table.delete(twin.id as string)
              await db.tombstones.put({
                id: `${p.t}:${twin.id}`,
                table: p.t,
                recordId: twin.id as string,
                deletedAt: new Date().toISOString(),
              })
            }
          }
          await table.put({ ...p.r, ...keep })
        }
      } finally {
        db.applyingRemote = false
      }
    })
  }

  // ---- push (re-read: the pull may have changed what's newest)
  const after = await localSnapshot(db, keys)
  const out: CloudRow[] = []
  for (const [k, l] of after) {
    const r = remote.get(k)
    if (r && r.updatedAt >= l.ts) continue
    if (newer.has(k) || (r && (await writtenByNewer(keys, r)))) {
      newer.add(k)
      continue
    }
    const payload: Payload = l.deleted
      ? { t: l.t, id: l.id, s: SCHEMA_VERSION }
      : { t: l.t, id: l.id, r: strip(l.t, l.rec!), s: SCHEMA_VERSION }
    out.push({
      key: k,
      updatedAt: l.ts,
      deleted: l.deleted,
      payload: await encryptJson(keys, payload),
      row: r?.row,
    })
  }
  if (out.length) await store.upsert(out)

  // deletions older than two months have reached every phone that syncs at all
  const cutoff = new Date(Date.now() - TOMBSTONE_DAYS * 86_400_000).toISOString()
  await db.tombstones.where('deletedAt').below(cutoff).delete()

  return { pulled: incoming.length, pushed: out.length, newer: newer.size }
}
