import { db } from '@/db/db'
import type { Reminder } from '@/db/types'
import { formatTime12, todayLocal } from './date'
import { computeDayStats, statDone, statTotal } from './dayStats'
import { drawReminderCard, reminderUrl } from './notifyCard'

const NIGHT_KEYS = new Set(['phonefree', 'phonefree-soon', 'sleep'])

/** "Today 3 of 5 done" for the phone's owner, or null when nothing is planned. */
async function todayLine(now: Date): Promise<string | null> {
  const today = todayLocal(now)
  const [me, tasks, occurrences, habits, entries] = await Promise.all([
    db.profiles.filter((p) => !!p.isPrimary).first(),
    db.tasks.toArray(),
    db.taskOccurrences.where('localDate').equals(today).toArray(),
    db.habits.toArray(),
    db.habitEntries.where('localDate').equals(today).toArray(),
  ])
  const mine = (p?: string | null) => !p || p === me?.id
  const [s] = computeDayStats({ tasks, occurrences, habits, entries }, [today], today, mine)
  return statTotal(s) ? `Today ${statDone(s)} of ${statTotal(s)} done` : null
}

/** Picture card + tap target for a reminder notification. */
export async function richReminder(r: Reminder, at: Date) {
  const time = formatTime12(
    `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
  )
  const progress = await todayLine(at).catch(() => null)
  const image = await drawReminderCard({
    emoji: r.emoji,
    title: r.title,
    line: progress ? `${time} · ${progress}` : time,
    theme: NIGHT_KEYS.has(r.presetKey ?? '')
      ? 'night'
      : r.priority === 'high'
        ? 'important'
        : 'day',
  })
  return { url: reminderUrl(r.id), ...(image ? { image } : {}) }
}
