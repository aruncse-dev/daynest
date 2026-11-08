import { addDays, format, getDay, isValid } from 'date-fns'

/**
 * DayNest stores all-day values as local `YYYY-MM-DD` strings.
 * Never pass these to `new Date(str)` — that parses as UTC and shifts the day
 * for users west of Greenwich. Always go through `parseLocalDate`.
 */
export type LocalDate = string

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function toLocalDate(d: Date): LocalDate {
  return format(d, 'yyyy-MM-dd')
}

export function todayLocal(now: Date = new Date()): LocalDate {
  return toLocalDate(now)
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false
  const m = LOCAL_DATE_RE.exec(value)
  if (!m) return false
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isValid(d) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
}

/** Parse `YYYY-MM-DD` as local midnight (not UTC). */
export function parseLocalDate(value: LocalDate): Date {
  const m = LOCAL_DATE_RE.exec(value)
  if (!m) throw new Error(`Invalid local date: ${value}`)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function addLocalDays(value: LocalDate, days: number): LocalDate {
  return toLocalDate(addDays(parseLocalDate(value), days))
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(value: LocalDate): number {
  return getDay(parseLocalDate(value))
}

export function compareLocal(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function formatLocal(value: LocalDate, pattern: string): string {
  return format(parseLocalDate(value), pattern)
}

/** Monday-first week containing `value`. */
export function weekOf(value: LocalDate): LocalDate[] {
  const wd = weekdayOf(value)
  const mondayOffset = wd === 0 ? -6 : 1 - wd
  const monday = addLocalDays(value, mondayOffset)
  return Array.from({ length: 7 }, (_, i) => addLocalDays(monday, i))
}

/** 6x7 Monday-first grid for the month containing `value`. */
export function monthGrid(value: LocalDate): LocalDate[] {
  const d = parseLocalDate(value)
  const first = toLocalDate(new Date(d.getFullYear(), d.getMonth(), 1))
  const start = weekOf(first)[0]
  return Array.from({ length: 42 }, (_, i) => addLocalDays(start, i))
}

export function sameMonth(a: LocalDate, b: LocalDate): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** "HH:mm" → minutes since midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatTime12(t?: string | null): string {
  if (!t) return ''
  const mins = timeToMinutes(t)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function greetingFor(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
/** Display order Monday→Sunday using JS weekday numbers */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
