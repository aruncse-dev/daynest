import { useEffect } from 'react'
import { db } from '@/db/db'
import { dueReminder } from '@/lib/reminders'
import { showSystemNotification } from '@/lib/notifications'
import { DEFAULT_QUIET, isQuietTime, QUIET_KEY, type QuietHours } from '@/lib/quietHours'
import { chime, vibrate } from '@/lib/sound'
import { useUI } from '@/store/ui'
import { getSetting } from '@/db/actions'
import { linkedStillDue } from '@/db/links'
import { richReminder } from '@/lib/notifyRich'

const TICK_MS = 20_000

/**
 * Checks nudges while DayNest is open (foreground, background tab, or an installed
 * app kept alive by the OS). There is no push server, so a fully closed browser can't
 * be woken — this is explained on the Nudges tab.
 *
 * During phone-free time, normal nudges are quietly skipped; high-priority ones still come through.
 */
export function ReminderRunner() {
  useEffect(() => {
    let running = false
    const tick = async () => {
      if (running) return
      running = true
      try {
        const now = new Date()
        const quiet = await getSetting<QuietHours>(QUIET_KEY, DEFAULT_QUIET)
        const muted = quiet.muteNudges && isQuietTime(quiet, now)
        const reminders = await db.reminders.filter((r) => r.enabled).toArray()
        for (const r of reminders) {
          const due = dueReminder(r, now)
          if (!due) continue
          await db.reminders.update(r.id, {
            lastFiredSlot: due.snooze ? r.lastFiredSlot : due.slot.toISOString(),
            snoozedUntil: null,
          })
          // a habit/to-do reminder stays quiet if the item isn't due today or is already done
          if (r.link && !(await linkedStillDue(r))) continue
          const high = r.priority === 'high'
          if (muted && !high) continue
          useUI.getState().pushReminder(r)
          if (await getSetting('reminderSound', true)) chime(high ? 'bell' : 'soft')
          vibrate(high ? [200, 100, 200, 100, 300] : [120, 60, 120])
          if (
            document.visibilityState !== 'visible' ||
            (await getSetting('notifyWhenOpen', false))
          ) {
            const rich = await richReminder(r, now)
            await showSystemNotification({
              title: `${r.emoji} ${r.title}`,
              body: r.message,
              tag: `reminder-${r.id}`,
              requireInteraction: high,
              ...rich,
            })
          }
        }
      } catch (e) {
        console.warn('Nudge check failed', e)
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
