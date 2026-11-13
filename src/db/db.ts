import Dexie, { type EntityTable } from 'dexie'
import type {
  BackupHistory,
  Tombstone,
  CalendarEvent,
  Goal,
  Habit,
  HabitEntry,
  Profile,
  Reminder,
  Setting,
  Task,
  TaskOccurrence,
  WellnessSession,
} from './types'

export const DB_NAME = 'daynest'
export const SCHEMA_VERSION = 3

export const DATA_TABLES = [
  'profiles',
  'tasks',
  'taskOccurrences',
  'habits',
  'habitEntries',
  'events',
  'goals',
  'reminders',
  'wellnessSessions',
  'settings',
] as const

export type DataTableName = (typeof DATA_TABLES)[number]

/** Fires after the user changes data on this phone (used to schedule a cloud sync). */
export const localChanges = new EventTarget()
const notifyLocalChange = () => localChanges.dispatchEvent(new Event('change'))

export class DayNestDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>
  tasks!: EntityTable<Task, 'id'>
  taskOccurrences!: EntityTable<TaskOccurrence, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitEntries!: EntityTable<HabitEntry, 'id'>
  events!: EntityTable<CalendarEvent, 'id'>
  goals!: EntityTable<Goal, 'id'>
  reminders!: EntityTable<Reminder, 'id'>
  wellnessSessions!: EntityTable<WellnessSession, 'id'>
  settings!: EntityTable<Setting, 'key'>
  backupHistory!: EntityTable<BackupHistory, 'id'>
  tombstones!: EntityTable<Tombstone, 'id'>
  /** true while applying changes that came from the cloud (they need no tombstone) */
  applyingRemote = false

  constructor(name = DB_NAME) {
    super(name)
    // Versioned schema. Add new `this.version(n)` blocks for migrations —
    // never edit an already-shipped version.
    this.version(1).stores({
      profiles: 'id, name, archivedAt',
      tasks: 'id, dueDate, status, profileId, goalId, category, archivedAt',
      // compound unique index guarantees one occurrence record per task per day
      taskOccurrences: 'id, taskId, localDate, &[taskId+localDate]',
      habits: 'id, status, profileId',
      // compound unique index guarantees one completion per habit per local date
      habitEntries: 'id, habitId, localDate, &[habitId+localDate]',
      events: 'id, localDate, profileId, type',
      goals: 'id, status, profileId, horizon',
      reminders: 'id, enabled',
      wellnessSessions: 'id, localDate, kind',
      settings: 'key',
      backupHistory: 'id, createdAt',
    })
    // v2: to-dos and events can be for several people (or nobody): profileId -> profileIds[]
    this.version(2)
      .stores({
        tasks: 'id, dueDate, status, *profileIds, goalId, category, archivedAt',
        events: 'id, localDate, *profileIds, type',
      })
      .upgrade(async (tx) => {
        for (const name of ['tasks', 'events'])
          await tx
            .table(name)
            .toCollection()
            .modify((row: Record<string, unknown>) => toPeopleList(row))
      })
    // v3: remember deletions so they can sync between phones (pruned after syncing)
    this.version(3).stores({ tombstones: 'id, deletedAt' })

    for (const name of DATA_TABLES) {
      // tell the cloud sync something changed (not for per-phone settings or synced-in data)
      if (name !== 'settings') {
        this.table(name).hook('creating', (_k, _o, tx) => {
          if (!this.applyingRemote) tx.on('complete', notifyLocalChange)
        })
        this.table(name).hook('updating', (_m, _k, _o, tx) => {
          if (!this.applyingRemote) tx.on('complete', notifyLocalChange)
        })
      }
      this.table(name).hook('deleting', (key, _obj, tx) => {
        if (this.applyingRemote) return
        const deletedAt = new Date().toISOString()
        const row = { id: `${name}:${String(key)}`, table: name, recordId: String(key), deletedAt }
        // written after the delete commits, so callers needn't include this table
        tx.on('complete', () => {
          void this.tombstones.put(row).catch(() => undefined)
          notifyLocalChange()
        })
      })
    }
  }
}

/**
 * Bring one record written by an older version of DayNest up to today's shape.
 * Used for backups, the family Sheet and (step by step) the database upgrades above.
 * When the data model changes: bump SCHEMA_VERSION, add a `version(n)` block, and add the
 * same step here so older backups and Sheet entries upgrade the same way.
 */
export function upgradeRecord(table: string, row: Record<string, unknown>, fromVersion: number) {
  if (fromVersion < 2 && (table === 'tasks' || table === 'events')) toPeopleList(row)
  // v3 only added the tombstones table: records are unchanged
  return row
}

/** v1 rows had a single `profileId`; v2 keeps a list. Safe to call on v2 rows. */
export function toPeopleList(row: Record<string, unknown>) {
  if (!Array.isArray(row.profileIds))
    row.profileIds = typeof row.profileId === 'string' && row.profileId ? [row.profileId] : []
  delete row.profileId
  return row
}

export const db = new DayNestDB()
