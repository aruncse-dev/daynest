import type { Habit, HabitEntry, Task, TaskOccurrence } from '@/db/types'
import { compareLocal, toLocalDate, type LocalDate } from './date'
import { currentStreak, isDueOn } from './habits'
import { taskAppearsOn } from './recurrence'

export interface DayStat {
  date: LocalDate
  tasksDue: number
  tasksDone: number
  habitsDue: number
  habitsDone: number
}

export const statDone = (s: DayStat) => s.tasksDone + s.habitsDone
export const statTotal = (s: DayStat) => s.tasksDue + s.habitsDue
/** 0..1, or null when nothing was planned that day. */
export const statRatio = (s: DayStat) => (statTotal(s) ? statDone(s) / statTotal(s) : null)

interface Data {
  tasks: Task[]
  occurrences: TaskOccurrence[]
  habits: Habit[]
  entries: HabitEntry[]
}

/**
 * Done / planned counts for each date — the same items Today lists for that date.
 *
 * - To-dos: everything due that day (a recurring to-do counts its own occurrence).
 *   On `today`, open to-dos from earlier days are included too, as on the list.
 * - Habits: active habits scheduled that day, from the day they were created.
 *   Paused/archived habits never count against a day.
 *
 * `mine` filters to the person whose dashboard it is.
 */
export function computeDayStats(
  data: Data,
  dates: LocalDate[],
  today: LocalDate,
  mine: (profileId?: string | null) => boolean = () => true,
): DayStat[] {
  const tasks = data.tasks.filter(
    (t) => t.status !== 'archived' && !t.archivedAt && mine(t.profileId),
  )
  const habits = data.habits.filter((h) => mine(h.profileId))
  const occDone = new Set(
    data.occurrences.filter((o) => o.status === 'done').map((o) => `${o.taskId}|${o.localDate}`),
  )
  const entry = new Set(data.entries.map((e) => `${e.habitId}|${e.localDate}`))

  return dates.map((date) => {
    const s: DayStat = { date, tasksDue: 0, tasksDone: 0, habitsDue: 0, habitsDone: 0 }
    for (const t of tasks) {
      if (taskAppearsOn(t, date)) {
        s.tasksDue++
        if (t.recurrenceRule ? occDone.has(`${t.id}|${date}`) : t.status === 'done') s.tasksDone++
      } else if (
        date === today &&
        !t.recurrenceRule &&
        t.status === 'open' &&
        t.dueDate &&
        compareLocal(t.dueDate, date) < 0
      ) {
        s.tasksDue++ // overdue, carried onto today
      }
    }
    for (const h of habits) {
      if (!isDueOn(h, date)) continue
      if (compareLocal(date, toLocalDate(new Date(h.createdAt))) < 0) continue
      s.habitsDue++
      if (entry.has(`${h.id}|${date}`)) s.habitsDone++
    }
    return s
  })
}

/** Share of habits kept across the given days (only days up to today count). */
export function habitsKept(stats: DayStat[], today: LocalDate): number | null {
  let due = 0
  let done = 0
  for (const s of stats) {
    if (compareLocal(s.date, today) > 0) continue
    due += s.habitsDue
    done += s.habitsDone
  }
  return due ? done / due : null
}

/** The longest current streak among the person's active habits. */
export function bestStreak(data: Data, today: LocalDate, mine: (p?: string | null) => boolean) {
  const byHabit = new Map<string, Set<LocalDate>>()
  for (const e of data.entries) {
    if (!byHabit.has(e.habitId)) byHabit.set(e.habitId, new Set())
    byHabit.get(e.habitId)!.add(e.localDate)
  }
  let best = 0
  for (const h of data.habits) {
    if (h.status !== 'active' || !mine(h.profileId)) continue
    best = Math.max(best, currentStreak(h, byHabit.get(h.id) ?? new Set(), today))
  }
  return best
}

/** A short, encouraging line for a day's progress. Never a score that shames. */
export function dayMessage(s: DayStat, today: LocalDate): string {
  const total = statTotal(s)
  const done = statDone(s)
  const cmp = compareLocal(s.date, today)
  if (cmp > 0) return total ? `${total} planned so far` : 'Nothing planned yet'
  if (!total) return cmp < 0 ? 'A free day' : 'A clear day — add one small thing'
  if (done === total) return cmp < 0 ? 'Everything done 🎉' : 'All done — wonderful! 🎉'
  if (cmp < 0) return done ? `${done} done that day` : 'A rest day — that’s okay'
  if (done === 0) return 'Fresh start — pick one to begin'
  if (done / total >= 0.5) return 'Over halfway — nice pace'
  return 'Good start — keep going'
}
