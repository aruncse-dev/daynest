import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { CalendarEvent, Habit, Task } from '@/db/types'
import { compareLocal, parseLocalDate, type LocalDate } from './date'
import { isDueOn } from './habits'
import { taskAppearsOn } from './recurrence'

export interface DayTask {
  task: Task
  date: LocalDate
  done: boolean
  overdue: boolean
}

const PRIORITY_RANK = { high: 0, important: 1, normal: 2, low: 3 } as const

export function sortDayTasks(a: DayTask, b: DayTask) {
  if (a.done !== b.done) return a.done ? 1 : -1
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
  const p = PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority]
  if (p) return p
  return (a.task.dueTime ?? '99').localeCompare(b.task.dueTime ?? '99')
}

/** Tasks for one day: recurring occurrences, one-offs due that day, and (for today) gentle overdue items. */
export function useDayTasks(
  date: LocalDate,
  opts: { includeOverdue?: boolean; profileId?: string } = {},
) {
  return useLiveQuery(async () => {
    const [tasks, occ] = await Promise.all([
      db.tasks.filter((t) => t.status !== 'archived' && !t.archivedAt).toArray(),
      db.taskOccurrences.where('localDate').equals(date).toArray(),
    ])
    const doneIds = new Set(occ.filter((o) => o.status === 'done').map((o) => o.taskId))
    const out: DayTask[] = []
    for (const t of tasks) {
      if (opts.profileId && opts.profileId !== 'all' && t.profileId !== opts.profileId) continue
      if (taskAppearsOn(t, date)) {
        out.push({
          task: t,
          date,
          done: t.recurrenceRule ? doneIds.has(t.id) : t.status === 'done',
          overdue: false,
        })
      } else if (
        opts.includeOverdue &&
        !t.recurrenceRule &&
        t.status === 'open' &&
        t.dueDate &&
        compareLocal(t.dueDate, date) < 0
      ) {
        out.push({ task: t, date, done: false, overdue: true })
      }
    }
    return out.sort(sortDayTasks)
  }, [date, opts.includeOverdue, opts.profileId])
}

export interface HabitWithState {
  habit: Habit
  done: boolean
}

export function useHabitsForDay(date: LocalDate, profileId?: string) {
  return useLiveQuery(async () => {
    const [habits, entries] = await Promise.all([
      db.habits.filter((h) => h.status !== 'archived').toArray(),
      db.habitEntries.where('localDate').equals(date).toArray(),
    ])
    const done = new Set(entries.map((e) => e.habitId))
    return habits
      .filter((h) => isDueOn(h, date))
      .filter((h) => !profileId || profileId === 'all' || h.profileId === profileId)
      .map((habit) => ({ habit, done: done.has(habit.id) }))
  }, [date, profileId])
}

/** Event instances (including yearly repeats) between two local dates, inclusive. */
export function eventsBetween(events: CalendarEvent[], from: LocalDate, to: LocalDate) {
  const out: (CalendarEvent & { occursOn: LocalDate })[] = []
  const fromYear = parseLocalDate(from).getFullYear()
  const toYear = parseLocalDate(to).getFullYear()
  for (const e of events) {
    if (e.repeatYearly) {
      for (let y = fromYear; y <= toYear; y++) {
        const d = `${y}${e.localDate.slice(4)}`
        // Feb 29 birthdays show on Feb 28 in non-leap years
        const valid = d.endsWith('-02-29') && new Date(y, 1, 29).getMonth() !== 1 ? `${y}-02-28` : d
        if (
          compareLocal(valid, e.localDate) >= 0 &&
          compareLocal(valid, from) >= 0 &&
          compareLocal(valid, to) <= 0
        )
          out.push({ ...e, occursOn: valid })
      }
    } else if (compareLocal(e.localDate, from) >= 0 && compareLocal(e.localDate, to) <= 0) {
      out.push({ ...e, occursOn: e.localDate })
    }
  }
  return out.sort(
    (a, b) =>
      compareLocal(a.occursOn, b.occursOn) || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
  )
}

export function useEventsBetween(from: LocalDate, to: LocalDate) {
  return useLiveQuery(async () => eventsBetween(await db.events.toArray(), from, to), [from, to])
}
