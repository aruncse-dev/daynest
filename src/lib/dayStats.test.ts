import { describe, expect, it } from 'vitest'
import type { Habit, Task } from '@/db/types'
import { bestStreak, computeDayStats, dayMessage, habitsKept, statRatio } from './dayStats'
import { weekOf } from './date'

const ts = '2026-11-01T09:00:00' // local, no Z
const task = (p: Partial<Task>): Task => ({
  id: p.id ?? 't',
  title: 'T',
  priority: 'normal',
  category: 'personal',
  status: 'open',
  createdAt: ts,
  updatedAt: ts,
  ...p,
})
const habit = (p: Partial<Habit>): Habit => ({
  id: p.id ?? 'h',
  title: 'H',
  emoji: '📖',
  scheduleDays: [],
  status: 'active',
  createdAt: ts,
  updatedAt: ts,
  ...p,
})
const entry = (habitId: string, localDate: string) => ({
  id: `${habitId}${localDate}`,
  habitId,
  localDate,
  completedAt: ts,
})

describe('day stats', () => {
  const today = '2026-11-13'
  const data = {
    tasks: [
      task({ id: 'a', dueDate: '2026-11-12', status: 'done' }),
      task({ id: 'b', dueDate: '2026-11-10' }), // overdue
      task({ id: 'c', dueDate: '2026-11-11', recurrenceRule: { type: 'daily' } }),
      task({ id: 'd', dueDate: '2026-11-13', profileId: 'mia' }),
    ],
    occurrences: [
      { id: 'o', taskId: 'c', localDate: '2026-11-12', status: 'done' as const, completedAt: ts },
    ],
    habits: [
      habit({ id: 'read' }),
      habit({ id: 'new', createdAt: '2026-11-12T20:00:00' }),
      habit({ id: 'paused', status: 'paused' }),
    ],
    entries: [entry('read', '2026-11-11'), entry('read', '2026-11-12'), entry('new', '2026-11-12')],
  }
  const mine = (p?: string | null) => !p || p === 'me'

  it('counts each date separately, a recurring to-do per occurrence', () => {
    const [d11, d12] = computeDayStats(data, ['2026-11-11', '2026-11-12'], today, mine)
    expect(d11).toMatchObject({ tasksDue: 1, tasksDone: 0, habitsDue: 1, habitsDone: 1 })
    expect(d12).toMatchObject({ tasksDue: 2, tasksDone: 2, habitsDue: 2, habitsDone: 2 })
    expect(statRatio(d12)).toBe(1)
  })
  it('today includes overdue to-dos; family items and paused habits never count', () => {
    const [d13] = computeDayStats(data, [today], today, mine)
    // c (recurring, today) + b (overdue); d is Mia's
    expect(d13).toMatchObject({ tasksDue: 2, tasksDone: 0, habitsDue: 2, habitsDone: 0 })
  })
  it('habits do not count before the day they were created', () => {
    const [d11] = computeDayStats(data, ['2026-11-11'], today, mine)
    expect(d11.habitsDue).toBe(1)
  })
  it('week kept % ignores future days; works across a month boundary', () => {
    const week = weekOf('2026-11-30') // Mon 30 Nov .. Sun 6 Dec
    expect(week[0]).toBe('2026-11-30')
    expect(week[6]).toBe('2026-12-06')
    const stats = computeDayStats(data, weekOf(today), today, mine)
    // Mon 9..Fri 13: read due 5, done 2; new due 12,13 done 1
    expect(habitsKept(stats, today)).toBeCloseTo(3 / 7)
  })
  it('best streak and friendly messages', () => {
    expect(bestStreak(data, today, mine)).toBe(2)
    const [d13] = computeDayStats(data, [today], today, mine)
    expect(dayMessage(d13, today)).toMatch(/Fresh start/)
    const [future] = computeDayStats(data, ['2026-11-20'], today, mine)
    expect(dayMessage(future, today)).toMatch(/planned/)
  })
})
