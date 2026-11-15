import { describe, expect, it } from 'vitest'
import { nextTimeOfDay } from './snooze'

describe('snooze to a time of day', () => {
  const now = new Date(2026, 10, 15, 14, 0) // 15 Nov, 2:00 PM local
  it('later today', () => {
    const at = nextTimeOfDay('16:30', now)!
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([15, 16, 30])
  })
  it('a time already past means tomorrow (also across a month end)', () => {
    expect(nextTimeOfDay('09:00', now)!.getDate()).toBe(16)
    const endOfMonth = new Date(2026, 10, 30, 23, 0)
    const at = nextTimeOfDay('07:00', endOfMonth)!
    expect([at.getMonth(), at.getDate()]).toEqual([11, 1])
  })
  it('rejects nonsense', () => expect(nextTimeOfDay('soon', now)).toBeNull())
})
