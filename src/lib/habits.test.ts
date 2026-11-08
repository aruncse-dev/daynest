import { describe, expect, it } from 'vitest'
import { currentStreak, isDueOn, longestStreak } from './habits'
import type { Habit } from '@/db/types'

const daily = { scheduleDays: [] as number[], createdAt: '' }
const set = (...d: string[]) => new Set(d)

describe('habit streaks', () => {
  it('counts consecutive days and keeps the streak alive if today is not done yet', () => {
    const done = set('2026-11-05', '2026-11-06', '2026-11-07')
    expect(currentStreak(daily, done, '2026-11-08')).toBe(3)
    expect(currentStreak(daily, set(...done, '2026-11-08'), '2026-11-08')).toBe(4)
  })
  it('breaks on a missed scheduled day', () => {
    expect(currentStreak(daily, set('2026-11-04', '2026-11-06', '2026-11-07'), '2026-11-08')).toBe(
      2,
    )
  })
  it('unscheduled days neither break nor extend', () => {
    const mwf = { scheduleDays: [1, 3, 5], createdAt: '' }
    // Mon 2, Wed 4, Fri 6 done; today Sun 8 (unscheduled)
    expect(currentStreak(mwf, set('2026-11-02', '2026-11-04', '2026-11-06'), '2026-11-08')).toBe(3)
  })
  it('streak crosses a month boundary', () => {
    expect(currentStreak(daily, set('2026-10-30', '2026-10-31', '2026-11-01'), '2026-11-02')).toBe(
      3,
    )
  })
  it('longest streak', () => {
    const done = set(
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-06',
      '2026-10-07',
    )
    expect(longestStreak(daily, done, '2026-10-08')).toBe(4)
    expect(longestStreak(daily, new Set(), '2026-10-08')).toBe(0)
  })
  it('paused and archived habits never count toward today', () => {
    const h = { scheduleDays: [], status: 'active' } as unknown as Habit
    expect(isDueOn(h, '2026-11-08')).toBe(true)
    expect(isDueOn({ ...h, status: 'paused' }, '2026-11-08')).toBe(false)
    expect(isDueOn({ ...h, status: 'archived' }, '2026-11-08')).toBe(false)
  })
})
