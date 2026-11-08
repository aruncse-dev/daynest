import { DATA_TABLES, SCHEMA_VERSION, db, type DataTableName } from '@/db/db'
import { nowIso, todayLocal } from './date'
import { uuid } from './id'

export const BACKUP_FORMAT = 'daynest-backup'
export const BACKUP_FORMAT_VERSION = 1

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  formatVersion: number
  schemaVersion: number
  appVersion: string
  exportedAt: string
  tables: Partial<Record<DataTableName, unknown[]>>
}

export interface BackupSummary {
  profiles: number
  tasks: number
  taskOccurrences: number
  habits: number
  habitEntries: number
  events: number
  goals: number
  reminders: number
  wellnessSessions: number
  settings: number
}

export type ValidationResult =
  | { ok: true; backup: BackupFile; summary: BackupSummary; warnings: string[] }
  | { ok: false; error: string }

const KEY_FIELD: Record<DataTableName, string> = {
  profiles: 'id',
  tasks: 'id',
  taskOccurrences: 'id',
  habits: 'id',
  habitEntries: 'id',
  events: 'id',
  goals: 'id',
  reminders: 'id',
  wellnessSessions: 'id',
  settings: 'key',
}

/** Settings that must never travel between devices (e.g. folder handles). */
const LOCAL_ONLY_SETTINGS = new Set(['backupFolderHandle'])

export async function buildBackup(): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {}
  await db.transaction(
    'r',
    DATA_TABLES.map((t) => db.table(t)),
    async () => {
      for (const name of DATA_TABLES) {
        let rows = await db.table(name).toArray()
        if (name === 'settings')
          rows = rows.filter((r: { key: string }) => !LOCAL_ONLY_SETTINGS.has(r.key))
        tables[name] = rows
      }
    },
  )
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
    exportedAt: nowIso(),
    tables,
  }
}

export function backupFilename(date = todayLocal()): string {
  const t = new Date()
  const hhmm = `${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}`
  return `daynest-backup-${date}-${hhmm}.json`
}

export function summarize(tables: BackupFile['tables']): BackupSummary {
  const n = (k: DataTableName) => tables[k]?.length ?? 0
  return {
    profiles: n('profiles'),
    tasks: n('tasks'),
    taskOccurrences: n('taskOccurrences'),
    habits: n('habits'),
    habitEntries: n('habitEntries'),
    events: n('events'),
    goals: n('goals'),
    reminders: n('reminders'),
    wellnessSessions: n('wellnessSessions'),
    settings: n('settings'),
  }
}

/** Validate an untrusted backup string *before* touching the database. */
export function validateBackup(text: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file is not valid JSON. It may be corrupted or incomplete.' }
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Backup file is empty.' }
  const b = parsed as Partial<BackupFile>
  if (b.format !== BACKUP_FORMAT) return { ok: false, error: 'This is not a DayNest backup file.' }
  if (typeof b.formatVersion !== 'number' || b.formatVersion > BACKUP_FORMAT_VERSION)
    return {
      ok: false,
      error: 'This backup was made by a newer version of DayNest. Please update the app first.',
    }
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > SCHEMA_VERSION)
    return {
      ok: false,
      error: 'This backup uses a newer database schema. Please update the app first.',
    }
  if (!b.tables || typeof b.tables !== 'object')
    return { ok: false, error: 'Backup has no data tables.' }

  const warnings: string[] = []
  const tables: BackupFile['tables'] = {}
  for (const name of DATA_TABLES) {
    const rows = (b.tables as Record<string, unknown>)[name]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) return { ok: false, error: `Table "${name}" is malformed.` }
    const key = KEY_FIELD[name]
    const seen = new Set<string>()
    const clean: unknown[] = []
    let dupes = 0
    for (const row of rows) {
      if (
        !row ||
        typeof row !== 'object' ||
        typeof (row as Record<string, unknown>)[key] !== 'string'
      )
        return { ok: false, error: `Table "${name}" contains an invalid record.` }
      const id = (row as Record<string, string>)[key]
      if (seen.has(id)) {
        dupes++
        continue
      }
      seen.add(id)
      clean.push(row)
    }
    if (dupes) warnings.push(`${dupes} duplicate ${name} record(s) were skipped.`)
    tables[name] = clean
  }
  // de-duplicate habit entries on [habitId+localDate] & occurrences on [taskId+localDate]
  for (const [name, a, c] of [
    ['habitEntries', 'habitId', 'localDate'],
    ['taskOccurrences', 'taskId', 'localDate'],
  ] as const) {
    const rows = (tables[name] ?? []) as Record<string, string>[]
    const seen = new Set<string>()
    const kept = rows.filter((r) => {
      const k = `${r[a]}|${r[c]}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    if (kept.length !== rows.length)
      warnings.push(`${rows.length - kept.length} duplicate ${name} for the same day were skipped.`)
    tables[name] = kept
  }

  const summary = summarize(tables)
  const total = Object.values(summary).reduce((a, n) => a + n, 0)
  if (total === 0) return { ok: false, error: 'This backup does not contain any records.' }
  if (b.schemaVersion < SCHEMA_VERSION)
    warnings.push('Backup is from an older version; it will be upgraded on import.')
  return { ok: true, backup: { ...(b as BackupFile), tables }, summary, warnings }
}

/**
 * Import inside a single transaction: either everything is written or nothing is.
 * `replace` clears existing data first; `merge` upserts by id (backup wins on conflicts).
 */
export async function importBackup(backup: BackupFile, mode: 'replace' | 'merge') {
  const tables = DATA_TABLES.map((t) => db.table(t))
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') for (const t of tables) await t.clear()
    for (const name of DATA_TABLES) {
      const rows = backup.tables[name] as Record<string, unknown>[] | undefined
      if (!rows?.length) continue
      const filtered =
        name === 'settings' ? rows.filter((r) => !LOCAL_ONLY_SETTINGS.has(r.key as string)) : rows
      if (mode === 'merge' && (name === 'habitEntries' || name === 'taskOccurrences')) {
        // keep the unique [parent+localDate] constraint intact when merging
        const parent = name === 'habitEntries' ? 'habitId' : 'taskId'
        for (const row of filtered) {
          const clash = await db
            .table(name)
            .where(`[${parent}+localDate]`)
            .equals([row[parent] as string, row.localDate as string])
            .first()
          if (clash && clash.id !== row.id) continue
          await db.table(name).put(row)
        }
        continue
      }
      await db.table(name).bulkPut(filtered)
    }
  })
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function recordBackup(entry: {
  filename: string
  destination: 'download' | 'folder'
  status: 'success' | 'error'
  errorMessage?: string
}) {
  await db.backupHistory.add({ id: uuid(), createdAt: nowIso(), ...entry })
  // keep the history table small
  const all = await db.backupHistory.orderBy('createdAt').toArray()
  if (all.length > 100)
    await db.backupHistory.bulkDelete(all.slice(0, all.length - 100).map((r) => r.id))
}

export async function exportToDownload() {
  const backup = await buildBackup()
  const filename = backupFilename()
  downloadJson(backup, filename)
  await recordBackup({ filename, destination: 'download', status: 'success' })
  return filename
}
