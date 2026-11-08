import type { LocalDate } from '@/lib/date'

export type ISODate = string

export interface Profile {
  id: string
  name: string
  avatar: string // emoji or initial
  color: string // hex background
  role?: string // e.g. "Personal", "Learning & play"
  isPrimary?: boolean
  createdAt: ISODate
  updatedAt: ISODate
  archivedAt?: ISODate | null
}

export type Priority = 'low' | 'normal' | 'high' | 'important'
export type TaskStatus = 'open' | 'done' | 'archived'

export type RecurrenceRule =
  | { type: 'daily' }
  | { type: 'weekdays' }
  | { type: 'selectedDays'; days: number[] } // 0=Sun..6=Sat
  | { type: 'weekly' } // same weekday as dueDate
  | { type: 'monthly' } // same day-of-month as dueDate (clamped to month end)

export interface Task {
  id: string
  title: string
  notes?: string
  /** Start date for recurring tasks; due date for one-off tasks. Empty = Someday */
  dueDate?: LocalDate | null
  dueTime?: string | null // HH:mm
  priority: Priority
  category: string
  profileId?: string | null
  goalId?: string | null
  recurrenceRule?: RecurrenceRule | null
  /** For one-off tasks. Recurring tasks track completion per occurrence. */
  status: TaskStatus
  completedAt?: ISODate | null
  createdAt: ISODate
  updatedAt: ISODate
  archivedAt?: ISODate | null
}

export interface TaskOccurrence {
  id: string
  taskId: string
  localDate: LocalDate
  status: 'done' | 'skipped'
  completedAt: ISODate
}

export type HabitStatus = 'active' | 'paused' | 'archived'

export interface Habit {
  id: string
  title: string
  description?: string
  emoji: string
  profileId?: string | null
  /** Weekdays (0=Sun..6=Sat). Empty array = every day. */
  scheduleDays: number[]
  targetLabel?: string
  status: HabitStatus
  createdAt: ISODate
  updatedAt: ISODate
  archivedAt?: ISODate | null
}

export interface HabitEntry {
  id: string
  habitId: string
  localDate: LocalDate
  completedAt: ISODate
  note?: string
}

export type EventType = 'event' | 'important' | 'birthday' | 'school' | 'appointment'

export interface CalendarEvent {
  id: string
  title: string
  localDate: LocalDate
  startTime?: string | null
  endTime?: string | null
  profileId?: string | null
  notes?: string
  type: EventType
  repeatYearly?: boolean
  createdAt: ISODate
  updatedAt: ISODate
}

export type GoalStatus = 'active' | 'achieved' | 'paused' | 'dropped'
export type GoalHorizon = 'week' | 'month' | 'long'

export interface Goal {
  id: string
  title: string
  description?: string
  profileId?: string | null
  targetDate?: LocalDate | null
  status: GoalStatus
  /** Plans are a named grouping: this week / this month / long-term. */
  horizon: GoalHorizon
  emoji?: string
  createdAt: ISODate
  updatedAt: ISODate
}

export type ReminderKind = 'interval' | 'times'

export interface Reminder {
  id: string
  title: string
  message: string
  emoji: string
  kind: ReminderKind
  /** interval reminders: every N minutes between startTime and endTime */
  intervalMinutes?: number
  startTime?: string // HH:mm
  endTime?: string // HH:mm
  /** fixed-time reminders */
  times?: string[]
  /** weekdays (0=Sun..6=Sat). Empty = every day */
  days: number[]
  enabled: boolean
  profileId?: string | null
  /** ISO of the scheduled slot most recently delivered */
  lastFiredSlot?: ISODate | null
  snoozedUntil?: ISODate | null
  presetKey?: string
  createdAt: ISODate
  updatedAt: ISODate
}

export type WellnessKind = 'breathing' | 'meditation' | 'yoga' | 'exercise'

export interface WellnessSession {
  id: string
  kind: WellnessKind
  routineId: string
  title: string
  localDate: LocalDate
  durationSec: number
  completedAt: ISODate
  profileId?: string | null
}

export interface Setting {
  key: string
  value: unknown
  updatedAt: ISODate
}

export interface BackupHistory {
  id: string
  createdAt: ISODate
  filename: string
  destination: 'download' | 'folder'
  status: 'success' | 'error'
  errorMessage?: string
}
