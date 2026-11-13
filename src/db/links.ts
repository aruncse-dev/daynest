import { EVENT_EMOJI } from '@/lib/people'
import { db } from './db'
import { toggleHabit, toggleTask } from './actions'
import { uuid } from '@/lib/id'
import {
  formatTime12,
  minutesToTime,
  nowIso,
  timeToMinutes,
  todayLocal,
  type LocalDate,
} from '@/lib/date'
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

/** "Mia: Brush teeth" / "Mia & Leo: Swimming" when the item is for family members. */
async function titleFor(title: string, ids: string[]) {
  if (!ids.length) return title
  const names = (await db.profiles.bulkGet(ids))
    .filter((p) => p && !p.isPrimary)
    .map((p) => p!.name)
  if (!names.length) return title
  const who = names.length <= 2 ? names.join(' & ') : `${names[0]} +${names.length - 1}`
  return `${who}: ${title}`
}

async function upsertLinked(
  link: ReminderLink,
  {
    people,
    ...rest
  }: Pick<Reminder, 'title' | 'message' | 'emoji' | 'times' | 'days'> &
    Partial<Pick<Reminder, 'priority' | 'presetKey'>> & { people: string[] },
) {
  const existing = await getLinkedReminder(link.type, link.id)
  const fields = {
    ...rest,
    profileId: people[0] ?? null,
    title: await titleFor(rest.title, people),
  }
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

/**
 * The phone-free habit's reminder: 15 minutes before phone-down time, marked important so it
 * always comes through. It's a heads-up, so it has no "Mark done" (the habit is ticked in the morning).
 */
export async function syncPhoneFreeReminder(habit: Habit, phoneDownAt: string) {
  await upsertLinked(
    { type: 'habit', id: habit.id },
    {
      title: habit.title,
      people: habit.profileId ? [habit.profileId] : [],
      emoji: '🌙',
      message: `Phone-free time at ${formatTime12(phoneDownAt)}. Time to wrap up and plug in away from bed.`,
      times: [minutesToTime((timeToMinutes(phoneDownAt) - 15 + 1440) % 1440)],
      days: [],
      priority: 'high',
      presetKey: PHONE_FREE_PRESET,
    },
  )
}

/** Reminders that are a heads-up only (no "Mark done"). */
export const PHONE_FREE_PRESET = 'phonefree'
export const canCompleteFromReminder = (r: Reminder) =>
  !!r.link && r.link.type !== 'event' && r.presetKey !== PHONE_FREE_PRESET

/** Habit reminder at one or more times on the habit's scheduled days. `times` empty = no reminder. */
export async function syncHabitReminder(habit: Habit, times: string[]) {
  if (!times.length) return deleteLinkedReminders('habit', habit.id)
  await upsertLinked(
    { type: 'habit', id: habit.id },
    {
      title: habit.title,
      people: habit.profileId ? [habit.profileId] : [],
      emoji: habit.emoji,
      message: habit.targetLabel
        ? `${habit.targetLabel}. Tap “Mark done” when finished.`
        : 'Tap “Mark done” when finished.',
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
      people: task.profileIds ?? [],
      emoji: '📝',
      message: task.dueTime ? `Today at ${formatTime12(task.dueTime)}.` : 'On your list for today.',
      times: [at],
      days: [],
    },
  )
}

export async function syncEventReminder(event: CalendarEvent, before: number | null) {
  const at = before === null ? null : slotFor(event.startTime, before)
  if (!at) return deleteLinkedReminders('event', event.id)
  const emoji = event.emoji || EVENT_EMOJI[event.type] || '📅'
  await upsertLinked(
    { type: 'event', id: event.id, before: before! },
    {
      title: event.title,
      people: event.profileIds ?? [],
      emoji,
      message: event.startTime ? `Today at ${formatTime12(event.startTime)}.` : 'Today.',
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
  if (!r.link || !canCompleteFromReminder(r)) return false
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
