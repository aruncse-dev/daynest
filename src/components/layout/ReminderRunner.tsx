import { useEffect } from 'react'
import { db } from '@/db/db'
import { dueReminder } from '@/lib/reminders'
import { showSystemNotification } from '@/lib/notifications'
import { chime, vibrate } from '@/lib/sound'
import { useUI } from '@/store/ui'
import { getSetting } from '@/db/actions'

const TICK_MS = 20_000

/**
 * Checks reminders while DayNest is open (foreground or background tab / installed app
 * kept alive by the OS). Without a push server, browsers cannot wake a closed app —
 * this is stated clearly in the Reminders screen.
 */
export function ReminderRunner() {
  useEffect(() => {
    let running = false
    const tick = async () => {
      if (running) return
      running = true
      try {
        const now = new Date()
        const reminders = await db.reminders.filter((r) => r.enabled).toArray()
        for (const r of reminders) {
          const due = dueReminder(r, now)
          if (!due) continue
          await db.reminders.update(r.id, {
            lastFiredSlot: due.snooze ? r.lastFiredSlot : due.slot.toISOString(),
            snoozedUntil: null,
          })
          useUI.getState().pushReminder(r)
          if (await getSetting('reminderSound', true)) chime('soft')
          vibrate([120, 60, 120])
          if (
            document.visibilityState !== 'visible' ||
            (await getSetting('notifyWhenOpen', false))
          ) {
            await showSystemNotification({
              title: `${r.emoji} ${r.title}`,
              body: r.message,
              tag: `reminder-${r.id}`,
              url: '/',
            })
          }
        }
      } catch (e) {
        console.warn('Reminder check failed', e)
      } finally {
        running = false
      }
    }
    void tick()
    const id = setInterval(tick, TICK_MS)
    const onVisible = () => document.visibilityState === 'visible' && void tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return null
}
