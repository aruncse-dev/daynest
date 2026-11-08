import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  addLocalDays,
  formatLocal,
  isLocalDate,
  monthGrid,
  parseLocalDate,
  toLocalDate,
  weekOf,
  weekdayOf,
} from './date'

// Node-only test env; avoid pulling Node types into the browser tsconfig
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env

describe('local date handling', () => {
  const originalTZ = env.TZ
  beforeAll(() => {
    // A timezone west of UTC is where `new Date('YYYY-MM-DD')` bugs show up.
    env.TZ = 'America/New_York'
  })
  afterAll(() => {
    env.TZ = originalTZ
  })

  it('parses date-only strings as local midnight, not UTC', () => {
    const d = parseLocalDate('2026-11-08')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(10)
    expect(d.getDate()).toBe(8)
    expect(d.getHours()).toBe(0)
    expect(formatLocal('2026-11-08', 'EEEE d MMMM')).toBe('Sunday 8 November')
  })

  it('round-trips a late-evening local time to the same local date', () => {
    const lateEvening = new Date(2026, 10, 8, 23, 59)
    expect(toLocalDate(lateEvening)).toBe('2026-11-08')
    const justAfterMidnight = new Date(2026, 10, 9, 0, 0, 1)
    expect(toLocalDate(justAfterMidnight)).toBe('2026-11-09')
  })

  it('adds days across month and year boundaries', () => {
    expect(addLocalDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addLocalDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addLocalDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('handles leap years', () => {
    expect(addLocalDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addLocalDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(isLocalDate('2027-02-29')).toBe(false)
    expect(isLocalDate('2028-02-29')).toBe(true)
  })

  it('is stable across daylight-saving changes', () => {
    // US DST starts 2026-03-08 and ends 2026-11-01
    expect(addLocalDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addLocalDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addLocalDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addLocalDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(addLocalDays('2026-03-01', 14)).toBe('2026-03-15')
  })

  it('builds Monday-first weeks and month grids', () => {
    expect(weekdayOf('2026-11-08')).toBe(0)
    expect(weekOf('2026-11-08')).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ])
    const grid = monthGrid('2026-11-15')
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-10-26')
    expect(grid).toContain('2026-11-30')
  })

  it('rejects malformed dates', () => {
    expect(isLocalDate('2026-13-01')).toBe(false)
    expect(isLocalDate('2026-1-1')).toBe(false)
    expect(isLocalDate(null)).toBe(false)
    expect(() => parseLocalDate('nope')).toThrow()
  })
})
