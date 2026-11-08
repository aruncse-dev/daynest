import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import { saveHabit, saveReminder, setSetting, toggleHabit } from '@/db/actions'
import { syncHabitReminder } from '@/db/links'
import { computeSlots, remindersDueAt } from './pushSchedule'
import { QUIET_KEY } from './quietHours'

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m)
const minute = (d: Date) => Math.floor(d.getTime() / 60000)

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('push schedule', () => {
  it('lists upcoming reminder minutes and nothing about their content', async () => {
    await saveReminder({
      title: 'Posture check',
      message: 'x',
      emoji: '🪑',
      kind: 'times',
      times: ['11:00', '15:00'],
      days: [],
      enabled: true,
    })
    const slots = await computeSlots(at(9, 12, 0), 1)
    expect(slots).toContain(minute(at(9, 15)))
    expect(slots).toContain(minute(at(10, 11)))
    expect(slots).not.toContain(minute(at(9, 11))) // already past
    expect(slots.every((s) => Number.isInteger(s))).toBe(true)
  })

  it("skips a habit's reminder today once the habit is done, but keeps tomorrow's", async () => {
    const h = await saveHabit({ title: 'Read', emoji: '📖', scheduleDays: [], status: 'active' })
    await syncHabitReminder(h, ['20:00'])
    await toggleHabit(h.id, '2026-11-09')
    const slots = await computeSlots(at(9, 12), 2)
    expect(slots).not.toContain(minute(at(9, 20)))
    expect(slots).toContain(minute(at(10, 20)))
  })

  it('mutes gentle reminders in phone-free hours but keeps important ones and snoozes', async () => {
    await setSetting(QUIET_KEY, { enabled: true, start: '22:00', end: '06:30', muteNudges: true })
    await saveReminder({
      title: 'Gentle',
      message: 'x',
      emoji: '⏰',
      kind: 'times',
      times: ['22:30'],
      days: [],
      enabled: true,
    })
    const imp = await saveReminder({
      title: 'Important',
      message: 'x',
      emoji: '💊',
      kind: 'times',
      times: ['22:45'],
      days: [],
      enabled: true,
      priority: 'high',
    })
    await db.reminders.update(imp.id, { snoozedUntil: at(9, 12, 10).toISOString() })
    const slots = await computeSlots(at(9, 12), 1)
    expect(slots).not.toContain(minute(at(9, 22, 30)))
    expect(slots).toContain(minute(at(9, 22, 45)))
    expect(slots).toContain(minute(at(9, 12, 10)))
  })

  it('finds which reminders a push is about, and skips ones the open app already showed', async () => {
    const r = await saveReminder({
      title: 'Water',
      message: 'x',
      emoji: '💧',
      kind: 'times',
      times: ['15:00'],
      days: [],
      enabled: true,
    })
    expect((await remindersDueAt(at(9, 15).getTime())).map((x) => x.title)).toEqual(['Water'])
    expect(await remindersDueAt(at(9, 15, 1).getTime())).toEqual([])
    await db.reminders.update(r.id, { lastFiredSlot: at(9, 15).toISOString() })
    expect(await remindersDueAt(at(9, 15).getTime())).toEqual([])
  })
})
