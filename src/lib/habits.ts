import type { Habit } from '@/db/types'
import { addLocalDays, compareLocal, weekdayOf, type LocalDate } from './date'

export function isScheduledOn(habit: Pick<Habit, 'scheduleDays'>, date: LocalDate): boolean {
  return habit.scheduleDays.length === 0 || habit.scheduleDays.includes(weekdayOf(date))
}

/** Habits that count toward a given day: active and scheduled. Paused/archived never count. */
export function isDueOn(habit: Habit, date: LocalDate): boolean {
  return habit.status === 'active' && isScheduledOn(habit, date)
}

/**
 * Current streak: consecutive *scheduled* days completed, walking back from today.
 * If today is scheduled but not yet done, the streak is still alive (counted from yesterday).
 * Unscheduled days neither break nor extend a streak.
 */
export function currentStreak(
  habit: Pick<Habit, 'scheduleDays' | 'createdAt'>,
  doneDates: Set<LocalDate>,
  today: LocalDate,
  maxLookback = 3660,
): number {
  let streak = 0
  let day = today
  if (isScheduledOn(habit, day) && !doneDates.has(day)) day = addLocalDays(day, -1)
  for (let i = 0; i < maxLookback; i++) {
    if (isScheduledOn(habit, day)) {
      if (doneDates.has(day)) streak++
      else break
    } else if (doneDates.has(day)) {
      streak++ // bonus completion on an off-day still counts
    }
    day = addLocalDays(day, -1)
  }
  return streak
}

export function longestStreak(
  habit: Pick<Habit, 'scheduleDays'>,
  doneDates: Set<LocalDate>,
  today: LocalDate,
): number {
  if (doneDates.size === 0) return 0
  const sorted = [...doneDates].sort(compareLocal)
  let best = 0
  let run = 0
  let day = sorted[0]
  const end = compareLocal(today, sorted[sorted.length - 1]) > 0 ? today : sorted[sorted.length - 1]
  while (compareLocal(day, end) <= 0) {
    if (doneDates.has(day)) {
      run++
      best = Math.max(best, run)
    } else if (isScheduledOn(habit, day) && day !== today) {
      run = 0
    }
    day = addLocalDays(day, 1)
  }
  return best
}
