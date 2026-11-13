import { bestStreak, computeDayStats, type DayStat } from './dayStats'
import { isFor, type PersonFilter } from './people'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Habit, Task } from '@/db/types'
import { compareLocal, type LocalDate } from './date'
import { eventsBetween } from './events'

export { eventsBetween }
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
  opts: { includeOverdue?: boolean; person?: PersonFilter } = {},
) {
  return useLiveQuery(async () => {
    const [tasks, occ] = await Promise.all([
      db.tasks.filter((t) => t.status !== 'archived' && !t.archivedAt).toArray(),
      db.taskOccurrences.where('localDate').equals(date).toArray(),
    ])
    const doneIds = new Set(occ.filter((o) => o.status === 'done').map((o) => o.taskId))
    const out: DayTask[] = []
    for (const t of tasks) {
      if (opts.person && !isFor(t, opts.person)) continue
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
  }, [date, opts.includeOverdue, opts.person])
}

export interface HabitWithState {
  habit: Habit
  done: boolean
}

export function useHabitsForDay(date: LocalDate, person: PersonFilter = 'all') {
  return useLiveQuery(async () => {
    const [habits, entries] = await Promise.all([
      db.habits.filter((h) => h.status !== 'archived').toArray(),
      db.habitEntries.where('localDate').equals(date).toArray(),
    ])
    const done = new Set(entries.map((e) => e.habitId))
    return habits
      .filter((h) => isDueOn(h, date))
      .filter((h) => isFor(h, person))
      .map((habit) => ({ habit, done: done.has(habit.id) }))
  }, [date, person])
}

export function useEventsBetween(from: LocalDate, to: LocalDate) {
  return useLiveQuery(async () => eventsBetween(await db.events.toArray(), from, to), [from, to])
}

/** Per-date done/planned counts for the given dates (see `computeDayStats`). */
export function useDayStats(dates: LocalDate[], today: LocalDate, person: PersonFilter = 'all') {
  return useLiveQuery(async () => {
    const [tasks, occurrences, habits, entries] = await Promise.all([
      db.tasks.toArray(),
      db.taskOccurrences
        .where('localDate')
        .between(dates[0], dates[dates.length - 1], true, true)
        .toArray(),
      db.habits.toArray(),
      db.habitEntries.toArray(),
    ])
    const data = { tasks, occurrences, habits, entries }
    return {
      days: computeDayStats(data, dates, today, person),
      streak: bestStreak(data, today, person),
    }
  }, [dates.join(), today, person])
}

/** Today's numbers for Everyone and for each person (for the people bar and family overview). */
export function usePeopleDay(date: LocalDate, today: LocalDate, ids: string[]) {
  return useLiveQuery(async () => {
    const [tasks, occurrences, habits, entries] = await Promise.all([
      db.tasks.toArray(),
      db.taskOccurrences.where('localDate').equals(date).toArray(),
      db.habits.toArray(),
      db.habitEntries.where('localDate').equals(date).toArray(),
    ])
    const data = { tasks, occurrences, habits, entries }
    const out: Record<string, DayStat> = {}
    for (const id of ['all', ...ids]) out[id] = computeDayStats(data, [date], today, id)[0]
    return out
  }, [date, today, ids.join()])
}
