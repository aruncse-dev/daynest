import { db } from './db'
import { toggleHabit, toggleTask } from './actions'
import { uuid } from '@/lib/id'
import { minutesToTime, nowIso, timeToMinutes, todayLocal, type LocalDate } from '@/lib/date'
import { isDueOn } from '@/lib/habits'
import { eventsBetween } from '@/lib/events'
import { taskAppearsOn } from '@/lib/recurrence'
import type { CalendarEvent, Habit, Reminder, ReminderLink, Task } from './types'

export const MORNING_OF = -1
export const MORNING_TIME = '08:00'

export async function getLinkedReminder(type: ReminderLink['type'], id: string) {
  return db.reminders.filter((r) => r.link?.type === type && r.link.id === id).first()
}

export async function deleteLinkedReminders(type: ReminderLink['type'], id: string) {
  const rows = await db.reminders.filter((r) => r.link?.type === type && r.link.id === id).toArray()
  await db.reminders.bulkDelete(rows.map((r) => r.id))
}

/** "Mia: Brush teeth" when the item belongs to a family member. */
async function titleFor(title: string, profileId?: string | null) {
  if (!profileId) return title
  const p = await db.profiles.get(profileId)
  return p && !p.isPrimary ? `${p.name}: ${title}` : title
}

async function upsertLinked(
  link: ReminderLink,
  fields: Pick<Reminder, 'title' | 'message' | 'emoji' | 'times' | 'days' | 'profileId'>,
) {
  const existing = await getLinkedReminder(link.type, link.id)
  fields = { ...fields, title: await titleFor(fields.title, fields.profileId) }
  const now = nowIso()
  const row: Reminder = {
    ...(existing ?? { id: uuid(), createdAt: now, priority: 'normal' as const }),
    ...fields,
    kind: 'times',
    link,
    enabled: true,
    lastFiredSlot: now, // don't fire a slot that was already due
    snoozedUntil: null,
    updatedAt: now,
  }
  await db.reminders.put(row)
}

/** Habit reminder at one or more times on the habit's scheduled days. `times` empty = no reminder. */
export async function syncHabitReminder(habit: Habit, times: string[]) {
  if (!times.length) return deleteLinkedReminders('habit', habit.id)
  await upsertLinked(
    { type: 'habit', id: habit.id },
    {
      title: habit.title,
      profileId: habit.profileId,
      emoji: habit.emoji,
      message: habit.targetLabel
        ? `${habit.targetLabel} — tap Done when you've finished.`
        : "Tap Done when you've finished.",
      times: [...new Set(times)].sort(),
      days: habit.scheduleDays,
    },
  )
}

function slotFor(time: string | null | undefined, before: number): string | null {
  if (before === MORNING_OF) return MORNING_TIME
  if (!time) return null
  return minutesToTime((timeToMinutes(time) - before + 1440) % 1440)
}

/** To-do reminder: `before` minutes before its time, or the morning of the day. null = no reminder. */
export async function syncTaskReminder(task: Task, before: number | null) {
  const at = before === null ? null : slotFor(task.dueTime, before)
  if (!at || !task.dueDate) return deleteLinkedReminders('task', task.id)
  await upsertLinked(
    { type: 'task', id: task.id, before: before! },
    {
      title: task.title,
      profileId: task.profileId,
      emoji: '📝',
      message: task.dueTime ? `To-do at ${task.dueTime}.` : 'On your list for today.',
      times: [at],
      days: [],
    },
  )
}

export async function syncEventReminder(event: CalendarEvent, before: number | null) {
  const at = before === null ? null : slotFor(event.startTime, before)
  if (!at) return deleteLinkedReminders('event', event.id)
  const emoji = event.type === 'birthday' ? '🎂' : event.type === 'appointment' ? '🩺' : '📅'
  await upsertLinked(
    { type: 'event', id: event.id, before: before! },
    {
      title: event.title,
      profileId: event.profileId,
      emoji,
      message: event.startTime ? `Today at ${event.startTime}.` : 'Today.',
      times: [at],
      days: [],
    },
  )
}

/**
 * Should a linked reminder still fire today? Skips days the item isn't due and items already done,
 * so people are never nagged about something they've finished.
 */
export async function linkedStillDue(
  r: Reminder,
  today: LocalDate = todayLocal(),
): Promise<boolean> {
  if (!r.link) return true
  const { type, id } = r.link
  if (type === 'habit') {
    const h = await db.habits.get(id)
    if (!h || !isDueOn(h, today)) return false
    return !(await db.habitEntries.where('[habitId+localDate]').equals([id, today]).first())
  }
  if (type === 'task') {
    const t = await db.tasks.get(id)
    if (!t || !taskAppearsOn(t, today)) return false
    if (!t.recurrenceRule) return t.status === 'open'
    return !(await db.taskOccurrences.where('[taskId+localDate]').equals([id, today]).first())
  }
  const e = await db.events.get(id)
  return !!e && eventsBetween([e], today, today).length > 0
}

/**
 * "Mark done" from a reminder (in-app card or phone notification): completes the linked
 * habit or to-do for today, if it isn't already done. Returns true if something was completed.
 */
export async function completeLinked(
  r: Reminder,
  today: LocalDate = todayLocal(),
): Promise<boolean> {
  if (!r.link || r.link.type === 'event') return false
  if (!(await linkedStillDue(r, today))) return false
  if (r.link.type === 'habit') {
    await toggleHabit(r.link.id, today)
    return true
  }
  const task = await db.tasks.get(r.link.id)
  if (!task) return false
  await toggleTask(task, today)
  return true
}
