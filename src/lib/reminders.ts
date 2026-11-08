import type { Reminder } from '@/db/types'
import { addLocalDays, timeToMinutes, toLocalDate, weekdayOf } from './date'

/** Slots older than this when the app wakes up are skipped rather than spammed. */
export const CATCH_UP_WINDOW_MS = 10 * 60 * 1000

/** All scheduled slots for a reminder on the given (local) day. */
export function slotsForDay(r: Reminder, dayStart: Date): Date[] {
  const local = toLocalDate(dayStart)
  if (r.days.length > 0 && !r.days.includes(weekdayOf(local))) return []
  const at = (mins: number) =>
    new Date(
      dayStart.getFullYear(),
      dayStart.getMonth(),
      dayStart.getDate(),
      Math.floor(mins / 60),
      mins % 60,
    )
  if (r.kind === 'times') {
    return (r.times ?? [])
      .map(timeToMinutes)
      .sort((a, b) => a - b)
      .map(at)
  }
  const every = Math.max(5, r.intervalMinutes ?? 60)
  const start = timeToMinutes(r.startTime ?? '08:00')
  const end = timeToMinutes(r.endTime ?? '21:00')
  const out: Date[] = []
  for (let m = start; m <= end; m += every) out.push(at(m))
  return out
}

/** Most recent scheduled slot at or before `now` (today or yesterday). */
export function lastSlotAtOrBefore(r: Reminder, now: Date): Date | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (const offset of [0, -1]) {
    const day = new Date(today)
    day.setDate(day.getDate() + offset)
    const slots = slotsForDay(r, day).filter((s) => s.getTime() <= now.getTime())
    if (slots.length) return slots[slots.length - 1]
  }
  return null
}

/** Next scheduled slot strictly after `now`, searching up to 8 days ahead. */
export function nextSlotAfter(r: Reminder, now: Date): Date | null {
  const todayLocal = toLocalDate(now)
  for (let i = 0; i < 8; i++) {
    const local = addLocalDays(todayLocal, i)
    const [y, m, d] = local.split('-').map(Number)
    const slots = slotsForDay(r, new Date(y, m - 1, d)).filter((s) => s.getTime() > now.getTime())
    if (slots.length) return slots[0]
  }
  return null
}

export type DueReason = { slot: Date; snooze: boolean }

/** Should this reminder fire now? Pure function — easy to test. */
export function dueReminder(r: Reminder, now: Date): DueReason | null {
  if (!r.enabled) return null
  if (r.snoozedUntil) {
    const until = new Date(r.snoozedUntil)
    if (until.getTime() > now.getTime()) return null
    if (now.getTime() - until.getTime() < CATCH_UP_WINDOW_MS) return { slot: until, snooze: true }
  }
  const slot = lastSlotAtOrBefore(r, now)
  if (!slot) return null
  if (now.getTime() - slot.getTime() > CATCH_UP_WINDOW_MS) return null
  if (r.lastFiredSlot && new Date(r.lastFiredSlot).getTime() >= slot.getTime()) return null
  return { slot, snooze: false }
}

export function describeSchedule(r: Reminder): string {
  const days =
    r.days.length === 0 || r.days.length === 7
      ? 'Every day'
      : r.days.length === 5 && [1, 2, 3, 4, 5].every((d) => r.days.includes(d))
        ? 'Weekdays'
        : [1, 2, 3, 4, 5, 6, 0]
            .filter((d) => r.days.includes(d))
            .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
            .join(', ')
  if (r.kind === 'times') return `${(r.times ?? []).join(', ')} · ${days}`
  const every = r.intervalMinutes ?? 60
  const label = every % 60 === 0 ? `${every / 60}h` : `${every} min`
  return `Every ${label}, ${r.startTime}–${r.endTime} · ${days}`
}
