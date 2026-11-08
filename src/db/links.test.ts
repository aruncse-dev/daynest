import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  deleteHabit,
  deleteTask,
  saveHabit,
  saveTask,
  setHabitStatus,
  toggleHabit,
  toggleTask,
} from './actions'
import { linkedStillDue, MORNING_OF, syncHabitReminder, syncTaskReminder } from './links'
import { dueReminder } from '@/lib/reminders'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const TODAY = '2026-11-09' // a Monday

describe('reminders linked to habits and to-dos', () => {
  it('a habit reminder stays quiet once the habit is done, on unscheduled days, and when paused', async () => {
    const h = await saveHabit({
      title: 'Read',
      emoji: '📖',
      scheduleDays: [1, 3, 5],
      status: 'active',
    })
    await syncHabitReminder(h, ['20:00'])
    const r = (await db.reminders.toArray())[0]
    expect(r.link).toEqual({ type: 'habit', id: h.id })
    expect(r.days).toEqual([1, 3, 5])
    expect(await linkedStillDue(r, TODAY)).toBe(true)
    expect(await linkedStillDue(r, '2026-11-10')).toBe(false) // Tuesday, not scheduled
    await toggleHabit(h.id, TODAY)
    expect(await linkedStillDue(r, TODAY)).toBe(false)
    await setHabitStatus(h.id, 'paused')
    expect(await linkedStillDue(r, '2026-11-11')).toBe(false)
  })

  it('a to-do reminder fires before its time, only on its day, and not after it is done', async () => {
    const t = await saveTask({
      title: 'Dentist call',
      priority: 'normal',
      category: 'Personal',
      status: 'open',
      dueDate: TODAY,
      dueTime: '10:00',
    })
    await syncTaskReminder(t, 15)
    const r = (await db.reminders.toArray())[0]
    expect(r.times).toEqual(['09:45'])
    expect(dueReminder({ ...r, lastFiredSlot: null }, new Date(2026, 10, 9, 9, 46))).not.toBeNull()
    expect(await linkedStillDue(r, TODAY)).toBe(true)
    expect(await linkedStillDue(r, '2026-11-10')).toBe(false)
    await toggleTask(t)
    expect(await linkedStillDue(r, TODAY)).toBe(false)
  })

  it('a to-do without a time can be reminded the morning of', async () => {
    const t = await saveTask({
      title: 'Pay rent',
      priority: 'normal',
      category: 'Personal',
      status: 'open',
      dueDate: TODAY,
    })
    await syncTaskReminder(t, MORNING_OF)
    expect((await db.reminders.toArray())[0].times).toEqual(['08:00'])
    await syncTaskReminder(t, null)
    expect(await db.reminders.count()).toBe(0)
  })

  it('recurring to-dos are reminded per occurrence', async () => {
    const t = await saveTask({
      title: 'Plan the week',
      priority: 'normal',
      category: 'Personal',
      status: 'open',
      dueDate: '2026-11-08',
      dueTime: '18:00',
      recurrenceRule: { type: 'weekly' },
    })
    await syncTaskReminder(t, 0)
    const r = (await db.reminders.toArray())[0]
    expect(await linkedStillDue(r, '2026-11-15')).toBe(true) // next Sunday
    expect(await linkedStillDue(r, '2026-11-16')).toBe(false)
    await toggleTask(t, '2026-11-15')
    expect(await linkedStillDue(r, '2026-11-15')).toBe(false)
    expect(await linkedStillDue(r, '2026-11-22')).toBe(true)
  })

  it('deleting the habit or to-do removes its reminder', async () => {
    const h = await saveHabit({ title: 'Walk', emoji: '🚶', scheduleDays: [], status: 'active' })
    await syncHabitReminder(h, ['07:00', '18:00'])
    const t = await saveTask({
      title: 'Call',
      priority: 'normal',
      category: 'Personal',
      status: 'open',
      dueDate: TODAY,
      dueTime: '12:00',
    })
    await syncTaskReminder(t, 0)
    expect(await db.reminders.count()).toBe(2)
    await deleteHabit(h.id)
    await deleteTask(t.id)
    expect(await db.reminders.count()).toBe(0)
  })
})
