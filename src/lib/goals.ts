import type { Task } from '@/db/types'

/**
 * Goal progress = completed one-off linked tasks ÷ all one-off linked tasks (archived excluded).
 * Recurring linked tasks are routines that support the goal; they're listed but don't
 * count toward the percentage, because they never "finish".
 */
export function goalProgress(tasks: Task[]) {
  const oneOff = tasks.filter((t) => !t.recurrenceRule && t.status !== 'archived')
  const done = oneOff.filter((t) => t.status === 'done').length
  return { done, total: oneOff.length, ratio: oneOff.length ? done / oneOff.length : 0 }
}

export const CATEGORIES = ['Personal', 'Work', 'Family', 'Home', 'Health', 'Learning']
