import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { todayLocal } from '@/lib/date'
import { useSetting } from '@/lib/hooks'
import { PUSH_ENABLED_KEY, syncPush } from '@/lib/push'
import { QUIET_KEY } from '@/lib/quietHours'

/**
 * Keeps the push server's list of wake-up minutes current: whenever reminders, habits,
 * to-dos or phone-free hours change, and when the app goes to the background.
 */
export function PushSync() {
  const enabled = useSetting(PUSH_ENABLED_KEY, false)
  const signature = useLiveQuery(async () => {
    const today = todayLocal()
    const [reminders, entries, occ, tasks, events, quiet] = await Promise.all([
      db.reminders.toArray(),
      db.habitEntries.where('localDate').aboveOrEqual(today).primaryKeys(),
      db.taskOccurrences.where('localDate').aboveOrEqual(today).primaryKeys(),
      db.tasks.toArray(),
      db.events.toArray(),
      db.settings.get(QUIET_KEY),
    ])
    return JSON.stringify([
      reminders.map((r) => [r.id, r.updatedAt, r.enabled, r.snoozedUntil]),
      entries,
      occ,
      tasks.map((t) => [t.id, t.updatedAt]),
      events.map((e) => [e.id, e.updatedAt]),
      quiet?.updatedAt,
      today,
    ])
  }, [])

  useEffect(() => {
    if (!enabled || !signature) return
    const t = setTimeout(
      () => void syncPush().catch((e) => console.warn('Reminder sync failed', e)),
      1500,
    )
    return () => clearTimeout(t)
  }, [enabled, signature])

  useEffect(() => {
    if (!enabled) return
    const onHide = () =>
      document.visibilityState === 'hidden' && void syncPush().catch(() => undefined)
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [enabled])
  return null
}
