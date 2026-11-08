import Dexie, { type EntityTable } from 'dexie'
import type {
  BackupHistory,
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
export const SCHEMA_VERSION = 1

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

  constructor(name = DB_NAME) {
    super(name)
    // Versioned schema. Add new `this.version(n)` blocks for migrations —
    // never edit an already-shipped version.
    this.version(SCHEMA_VERSION).stores({
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
  }
}

export const db = new DayNestDB()

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
