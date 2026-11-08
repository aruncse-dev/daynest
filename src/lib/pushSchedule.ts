import { db } from '@/db/db'
import { getSetting } from '@/db/actions'
import { linkedStillDue } from '@/db/links'
import type { Reminder } from '@/db/types'
import { addLocalDays, parseLocalDate, toLocalDate, todayLocal } from './date'
import { DEFAULT_QUIET, isQuietTime, QUIET_KEY, type QuietHours } from './quietHours'
import { slotsForDay } from './reminders'

export const SCHEDULE_DAYS = 7
const minuteOf = (d: Date | number) => Math.floor((typeof d === 'number' ? d : d.getTime()) / 60000)

function muted(r: Reminder, at: Date, quiet: QuietHours) {
  return r.priority !== 'high' && quiet.muteNudges && isQuietTime(quiet, at)
}

/**
 * Every minute (epoch minute, UTC) a reminder should ring over the next `days` days.
 * This list — and nothing about what the reminders say — is all the push server ever sees.
 */
export async function computeSlots(now = new Date(), days = SCHEDULE_DAYS): Promise<number[]> {
  const reminders = await db.reminders.filter((r) => r.enabled).toArray()
  const quiet = await getSetting<QuietHours>(QUIET_KEY, DEFAULT_QUIET)
  const end = now.getTime() + days * 86_400_000
  const out = new Set<number>()
  for (let i = 0; i <= days; i++) {
    const day = addLocalDays(todayLocal(now), i)
    for (const r of reminders) {
      const slots = slotsForDay(r, parseLocalDate(day)).filter(
        (s) => s.getTime() > now.getTime() && s.getTime() <= end && !muted(r, s, quiet),
      )
      if (!slots.length) continue
      // habit/to-do/event reminders: only on days the item is due and not already done
      if (r.link && !(await linkedStillDue(r, day))) continue
      for (const s of slots) out.add(minuteOf(s))
    }
  }
  for (const r of reminders) {
    if (r.snoozedUntil && new Date(r.snoozedUntil).getTime() > now.getTime())
      out.add(minuteOf(new Date(r.snoozedUntil)))
  }
  return [...out].sort((a, b) => a - b)
}

/** Which reminders a push for minute `atMs` is about (used by the service worker). */
export async function remindersDueAt(atMs: number): Promise<Reminder[]> {
  const at = new Date(atMs)
  const minute = minuteOf(at)
  const day = toLocalDate(at)
  const quiet = await getSetting<QuietHours>(QUIET_KEY, DEFAULT_QUIET)
  const reminders = await db.reminders.filter((r) => r.enabled).toArray()
  const out: Reminder[] = []
  for (const r of reminders) {
    const snoozeHit = !!r.snoozedUntil && minuteOf(new Date(r.snoozedUntil)) === minute
    const slotHit =
      slotsForDay(r, parseLocalDate(day)).some((s) => minuteOf(s) === minute) &&
      !muted(r, at, quiet)
    if (!snoozeHit && !slotHit) continue
    if (!snoozeHit && r.lastFiredSlot && minuteOf(new Date(r.lastFiredSlot)) >= minute) continue // the open app already showed it
    if (r.link && !(await linkedStillDue(r, day))) continue
    out.push(r)
  }
  return out
}
