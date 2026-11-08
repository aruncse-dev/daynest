import { addLocalDays, timeToMinutes, toLocalDate, type LocalDate } from './date'

export interface QuietHours {
  enabled: boolean
  start: string // HH:mm, e.g. 22:00
  end: string // HH:mm, e.g. 06:30
  /** mute normal-priority nudges during phone-free time */
  muteNudges: boolean
}

export const QUIET_KEY = 'quietHours'
export const DEFAULT_QUIET: QuietHours = {
  enabled: false,
  start: '22:00',
  end: '06:30',
  muteNudges: true,
}

/** Is `now` inside the (possibly overnight) quiet window? */
export function isQuietTime(q: Pick<QuietHours, 'enabled' | 'start' | 'end'>, now: Date): boolean {
  if (!q.enabled) return false
  const m = now.getHours() * 60 + now.getMinutes()
  const s = timeToMinutes(q.start)
  const e = timeToMinutes(q.end)
  return s <= e ? m >= s && m < e : m >= s || m < e
}

/**
 * The "night" a moment belongs to, named by the evening's date:
 * 23:30 on the 8th and 01:00 on the 9th are both the night of the 8th.
 */
export function nightOf(q: Pick<QuietHours, 'start' | 'end'>, now: Date): LocalDate {
  const m = now.getHours() * 60 + now.getMinutes()
  const crossesMidnight = timeToMinutes(q.start) > timeToMinutes(q.end)
  const today = toLocalDate(now)
  return crossesMidnight && m < timeToMinutes(q.end) ? addLocalDays(today, -1) : today
}

/** Minutes until quiet time starts (0 if already inside, null if disabled). */
export function minutesUntilQuiet(q: QuietHours, now: Date): number | null {
  if (!q.enabled) return null
  if (isQuietTime(q, now)) return 0
  const m = now.getHours() * 60 + now.getMinutes()
  const s = timeToMinutes(q.start)
  return (s - m + 1440) % 1440
}
