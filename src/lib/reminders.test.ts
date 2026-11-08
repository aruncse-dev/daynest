import { describe, expect, it } from 'vitest'
import { dueReminder, nextSlotAfter } from './reminders'
import type { Reminder } from '@/db/types'

const water: Reminder = {
  id: 'r',
  title: 'Drink water',
  message: '',
  emoji: '💧',
  kind: 'interval',
  intervalMinutes: 60,
  startTime: '08:00',
  endTime: '21:00',
  days: [],
  enabled: true,
  createdAt: '',
  updatedAt: '',
}
const at = (h: number, m = 0, d = 9) => new Date(2026, 10, d, h, m)

describe('reminder scheduling', () => {
  it('fires at an interval slot, once', () => {
    const due = dueReminder(water, at(10, 2))
    expect(due?.slot.getHours()).toBe(10)
    expect(dueReminder({ ...water, lastFiredSlot: due!.slot.toISOString() }, at(10, 3))).toBeNull()
  })
  it('does not fire outside the active window', () => {
    expect(dueReminder(water, at(7, 30))).toBeNull()
    expect(dueReminder(water, at(23, 0))).toBeNull()
  })
  it('skips stale slots instead of spamming after a long absence', () => {
    expect(dueReminder(water, at(10, 30))).toBeNull()
  })
  it('respects weekdays', () => {
    const weekdays = { ...water, days: [1, 2, 3, 4, 5] }
    expect(dueReminder(weekdays, at(10, 1, 8))).toBeNull() // Sunday
    expect(dueReminder(weekdays, at(10, 1, 9))).not.toBeNull() // Monday
  })
  it('fixed-time reminders and next slot', () => {
    const shoes: Reminder = { ...water, kind: 'times', times: ['07:00', '17:30'] }
    expect(dueReminder(shoes, at(7, 5))?.slot.getHours()).toBe(7)
    expect(nextSlotAfter(shoes, at(8, 0))?.getHours()).toBe(17)
    expect(nextSlotAfter(shoes, at(18, 0))?.getDate()).toBe(10)
  })
  it('snooze delays and then fires', () => {
    const snoozed = {
      ...water,
      lastFiredSlot: at(10).toISOString(),
      snoozedUntil: at(10, 15).toISOString(),
    }
    expect(dueReminder(snoozed, at(10, 10))).toBeNull()
    expect(dueReminder(snoozed, at(10, 16))?.snooze).toBe(true)
  })
  it('disabled reminders never fire', () => {
    expect(dueReminder({ ...water, enabled: false }, at(10, 1))).toBeNull()
  })
})
