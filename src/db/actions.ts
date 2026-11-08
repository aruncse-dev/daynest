import { db } from './db'
import { uuid } from '@/lib/id'
import { nowIso, todayLocal, type LocalDate } from '@/lib/date'
import type { CalendarEvent, Goal, Habit, Profile, Reminder, Task, WellnessSession } from './types'

type Draft<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }

function stamp<T extends object>(draft: T, existing?: { createdAt: string }) {
  const now = nowIso()
  return { ...draft, createdAt: existing?.createdAt ?? now, updatedAt: now }
}

/* ---------- settings ---------- */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}
export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value, updatedAt: nowIso() })
}

/* ---------- profiles ---------- */
export async function saveProfile(draft: Draft<Profile>) {
  const existing = draft.id ? await db.profiles.get(draft.id) : undefined
  const row = { ...stamp(draft, existing), id: draft.id ?? uuid() } as Profile
  await db.profiles.put(row)
  return row
}
export async function archiveProfile(id: string) {
  await db.profiles.update(id, { archivedAt: nowIso(), updatedAt: nowIso() })
}

/* ---------- tasks ---------- */
export async function saveTask(draft: Draft<Task>) {
  const existing = draft.id ? await db.tasks.get(draft.id) : undefined
  const row = { ...stamp(draft, existing), id: draft.id ?? uuid() } as Task
  await db.tasks.put(row)
  return row
}

/**
 * Toggle completion. Recurring tasks record a per-date occurrence so that
 * completing today never completes future (or past) occurrences.
 */
export async function toggleTask(task: Task, date: LocalDate = todayLocal()) {
  if (task.recurrenceRule) {
    await db.transaction('rw', db.taskOccurrences, async () => {
      const existing = await db.taskOccurrences
        .where('[taskId+localDate]')
        .equals([task.id, date])
        .first()
      if (existing) await db.taskOccurrences.delete(existing.id)
      else
        await db.taskOccurrences.add({
          id: uuid(),
          taskId: task.id,
          localDate: date,
          status: 'done',
          completedAt: nowIso(),
        })
    })
    return
  }
  const done = task.status === 'done'
  await db.tasks.update(task.id, {
    status: done ? 'open' : 'done',
    completedAt: done ? null : nowIso(),
    updatedAt: nowIso(),
  })
}

export async function archiveTask(id: string) {
  await db.tasks.update(id, { status: 'archived', archivedAt: nowIso(), updatedAt: nowIso() })
}
export async function deleteTask(id: string) {
  await db.transaction('rw', db.tasks, db.taskOccurrences, async () => {
    await db.taskOccurrences.where('taskId').equals(id).delete()
    await db.tasks.delete(id)
  })
}

/* ---------- habits ---------- */
export async function saveHabit(draft: Draft<Habit>) {
  const existing = draft.id ? await db.habits.get(draft.id) : undefined
  // Editing only touches the habit row — historical entries are never rewritten.
  const row = { ...stamp(draft, existing), id: draft.id ?? uuid() } as Habit
  await db.habits.put(row)
  return row
}

export async function toggleHabit(habitId: string, date: LocalDate = todayLocal()) {
  return db.transaction('rw', db.habitEntries, async () => {
    const existing = await db.habitEntries
      .where('[habitId+localDate]')
      .equals([habitId, date])
      .first()
    if (existing) {
      await db.habitEntries.delete(existing.id)
      return false
    }
    await db.habitEntries.add({ id: uuid(), habitId, localDate: date, completedAt: nowIso() })
    return true
  })
}

export async function setHabitStatus(id: string, status: Habit['status']) {
  await db.habits.update(id, {
    status,
    archivedAt: status === 'archived' ? nowIso() : null,
    updatedAt: nowIso(),
  })
}
export async function deleteHabit(id: string) {
  await db.transaction('rw', db.habits, db.habitEntries, async () => {
    await db.habitEntries.where('habitId').equals(id).delete()
    await db.habits.delete(id)
  })
}

/* ---------- events ---------- */
export async function saveEvent(draft: Draft<CalendarEvent>) {
  const existing = draft.id ? await db.events.get(draft.id) : undefined
  const row = { ...stamp(draft, existing), id: draft.id ?? uuid() } as CalendarEvent
  await db.events.put(row)
  return row
}
export const deleteEvent = (id: string) => db.events.delete(id)

/* ---------- goals ---------- */
export async function saveGoal(draft: Draft<Goal>) {
  const existing = draft.id ? await db.goals.get(draft.id) : undefined
  const row = { ...stamp(draft, existing), id: draft.id ?? uuid() } as Goal
  await db.goals.put(row)
  return row
}
export async function deleteGoal(id: string) {
  await db.transaction('rw', db.goals, db.tasks, async () => {
    await db.tasks.where('goalId').equals(id).modify({ goalId: null })
    await db.goals.delete(id)
  })
}

/* ---------- reminders ---------- */
export async function saveReminder(draft: Draft<Reminder>) {
  const existing = draft.id ? await db.reminders.get(draft.id) : undefined
  const row = { ...stamp(draft, existing), id: draft.id ?? uuid() } as Reminder
  await db.reminders.put(row)
  return row
}
export const deleteReminder = (id: string) => db.reminders.delete(id)

/* ---------- wellness ---------- */
export async function logWellness(
  draft: Omit<WellnessSession, 'id' | 'completedAt' | 'localDate'>,
) {
  await db.wellnessSessions.add({
    ...draft,
    id: uuid(),
    localDate: todayLocal(),
    completedAt: nowIso(),
  })
}

/* ---------- maintenance ---------- */
export async function clearAllData() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      if (t.name === 'backupHistory') continue
      await t.clear()
    }
  })
}
