import { describe, expect, it } from 'vitest'
import { isQuietTime, minutesUntilQuiet, nightOf } from './quietHours'

const q = { enabled: true, start: '22:00', end: '06:30', muteNudges: true }
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m)

describe('phone-free hours', () => {
  it('handles a window that crosses midnight', () => {
    expect(isQuietTime(q, at(8, 21, 59))).toBe(false)
    expect(isQuietTime(q, at(8, 22, 0))).toBe(true)
    expect(isQuietTime(q, at(9, 2, 0))).toBe(true)
    expect(isQuietTime(q, at(9, 6, 30))).toBe(false)
  })
  it('handles a same-day window', () => {
    const day = { ...q, start: '13:00', end: '14:00' }
    expect(isQuietTime(day, at(8, 13, 30))).toBe(true)
    expect(isQuietTime(day, at(8, 14, 30))).toBe(false)
  })
  it('is off when disabled', () => {
    expect(isQuietTime({ ...q, enabled: false }, at(8, 23))).toBe(false)
  })
  it('names the night by the evening it started', () => {
    expect(nightOf(q, at(8, 23, 30))).toBe('2026-11-08')
    expect(nightOf(q, at(9, 1, 0))).toBe('2026-11-08')
    expect(nightOf(q, at(9, 8, 0))).toBe('2026-11-09')
  })
  it('counts down to phone-free time', () => {
    expect(minutesUntilQuiet(q, at(8, 21, 15))).toBe(45)
    expect(minutesUntilQuiet(q, at(8, 22, 15))).toBe(0)
  })
})
