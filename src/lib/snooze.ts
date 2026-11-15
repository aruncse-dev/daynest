/** Snooze choices on a reminder card (minutes). The phone's own notification keeps 10 min. */
export const SNOOZE_MINUTES = [10, 30, 60] as const

/** "16:30" → the next 16:30 (today, or tomorrow if it has passed). */
export function nextTimeOfDay(hhmm: string, now = new Date()): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const at = new Date(now)
  at.setHours(Number(m[1]), Number(m[2]), 0, 0)
  if (at.getTime() <= now.getTime() + 30_000) at.setDate(at.getDate() + 1)
  return at
}

export const snoozeLabel = (min: number) => (min < 60 ? `${min} min` : `${min / 60} h`)
