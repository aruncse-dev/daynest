import { describe, expect, it } from 'vitest'
import { occursOn, taskAppearsOn } from './recurrence'
import type { Task } from '@/db/types'

const base: Task = {
  id: 't',
  title: 'x',
  priority: 'normal',
  category: 'Personal',
  status: 'open',
  createdAt: '',
  updatedAt: '',
}

describe('recurrence', () => {
  it('never occurs before the start date', () => {
    expect(occursOn({ type: 'daily' }, '2026-11-08', '2026-11-07')).toBe(false)
    expect(occursOn({ type: 'daily' }, '2026-11-08', '2026-11-08')).toBe(true)
  })
  it('weekdays skips weekends', () => {
    expect(occursOn({ type: 'weekdays' }, '2026-11-01', '2026-11-07')).toBe(false) // Sat
    expect(occursOn({ type: 'weekdays' }, '2026-11-01', '2026-11-09')).toBe(true) // Mon
  })
  it('selected days', () => {
    const rule = { type: 'selectedDays' as const, days: [1, 4] }
    expect(occursOn(rule, '2026-11-01', '2026-11-09')).toBe(true) // Mon
    expect(occursOn(rule, '2026-11-01', '2026-11-12')).toBe(true) // Thu
    expect(occursOn(rule, '2026-11-01', '2026-11-10')).toBe(false)
  })
  it('weekly repeats on the start weekday', () => {
    expect(occursOn({ type: 'weekly' }, '2026-11-04', '2026-11-11')).toBe(true)
    expect(occursOn({ type: 'weekly' }, '2026-11-04', '2026-11-12')).toBe(false)
  })
  it('monthly clamps the 31st to shorter months', () => {
    expect(occursOn({ type: 'monthly' }, '2026-01-31', '2026-02-28')).toBe(true)
    expect(occursOn({ type: 'monthly' }, '2026-01-31', '2026-04-30')).toBe(true)
    expect(occursOn({ type: 'monthly' }, '2026-01-31', '2026-03-31')).toBe(true)
    expect(occursOn({ type: 'monthly' }, '2026-01-31', '2026-03-30')).toBe(false)
    expect(occursOn({ type: 'monthly' }, '2028-01-31', '2028-02-29')).toBe(true)
  })
  it('one-off tasks only appear on their due date; archived never', () => {
    expect(taskAppearsOn({ ...base, dueDate: '2026-11-08' }, '2026-11-08')).toBe(true)
    expect(taskAppearsOn({ ...base, dueDate: '2026-11-08' }, '2026-11-09')).toBe(false)
    expect(
      taskAppearsOn({ ...base, dueDate: '2026-11-08', status: 'archived' }, '2026-11-08'),
    ).toBe(false)
  })
})
