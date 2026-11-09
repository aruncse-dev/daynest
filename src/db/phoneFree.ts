import { db } from './db'
import { getSetting, saveHabit, setHabitStatus, setSetting } from './actions'
import { deleteLinkedReminders, PHONE_FREE_PRESET, syncPhoneFreeReminder } from './links'
import { DEFAULT_QUIET, QUIET_KEY, type QuietHours } from '@/lib/quietHours'
import { formatShort } from '@/lib/suggest'

export const PHONE_FREE_TEMPLATE = 'phone-free-night'

export function phoneFreeHabit() {
  return db.habits
    .filter((h) => h.templateKey === PHONE_FREE_TEMPLATE && h.status !== 'archived')
    .first()
}

/**
 * Phone-free nights are built from ordinary pieces:
 *  - quiet hours (gentle reminders stay silent overnight; important ones still come through)
 *  - a "No phone after 10 PM" habit, ticked each morning
 *  - that habit's reminder, 15 minutes before phone-down time
 */
export async function setPhoneFree(next: QuietHours, profileId: string | null) {
  await setSetting(QUIET_KEY, next)
  const title = `No phone after ${formatShort(next.start)}`
  let habit = await phoneFreeHabit()
  if (next.enabled) {
    if (!habit)
      habit = await saveHabit({
        title,
        emoji: '📵',
        scheduleDays: [],
        profileId,
        templateKey: PHONE_FREE_TEMPLATE,
        status: 'active',
      })
    else if (habit.status !== 'active' || habit.title !== title)
      habit = await saveHabit({ ...habit, title, status: 'active', archivedAt: null })
    await syncPhoneFreeReminder(habit, next.start)
  } else if (habit) {
    await setHabitStatus(habit.id, 'paused')
    await deleteLinkedReminders('habit', habit.id)
  }
}

/**
 * One-time upgrade from the older design, which had two special phone-free reminders and a
 * separate card. Keeps the person's settings; only the plumbing changes.
 */
export async function migratePhoneFree() {
  if (await getSetting('phoneFreeMigrated', false)) return
  const old = await db.reminders
    .filter((r) => !r.link && (r.presetKey === 'phonefree' || r.presetKey === 'phonefree-soon'))
    .toArray()
  await db.reminders.bulkDelete(old.map((r) => r.id))
  const quiet = await getSetting<QuietHours>(QUIET_KEY, DEFAULT_QUIET)
  const habit = await phoneFreeHabit()
  if (quiet.enabled && habit && habit.status === 'active')
    await syncPhoneFreeReminder(habit, quiet.start)
  await setSetting('phoneFreeMigrated', true)
}

export { PHONE_FREE_PRESET }
