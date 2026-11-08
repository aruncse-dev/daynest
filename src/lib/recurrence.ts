import type { RecurrenceRule, Task } from '@/db/types'
import { compareLocal, parseLocalDate, weekdayOf, type LocalDate } from './date'

/** Does a recurring task have an occurrence on `date`? */
export function occursOn(rule: RecurrenceRule, start: LocalDate, date: LocalDate): boolean {
  if (compareLocal(date, start) < 0) return false
  const wd = weekdayOf(date)
  switch (rule.type) {
    case 'daily':
      return true
    case 'weekdays':
      return wd >= 1 && wd <= 5
    case 'selectedDays':
      return rule.days.includes(wd)
    case 'weekly':
      return wd === weekdayOf(start)
    case 'monthly': {
      const s = parseLocalDate(start)
      const d = parseLocalDate(date)
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      // 31st → clamps to the last day of shorter months
      return d.getDate() === Math.min(s.getDate(), lastDay)
    }
  }
}

export function isRecurring(task: Pick<Task, 'recurrenceRule'>): boolean {
  return !!task.recurrenceRule
}

/** Does this task appear on the given day (as an occurrence or a one-off due item)? */
export function taskAppearsOn(task: Task, date: LocalDate): boolean {
  if (task.archivedAt || task.status === 'archived') return false
  if (task.recurrenceRule) {
    if (!task.dueDate) return false
    return occursOn(task.recurrenceRule, task.dueDate, date)
  }
  return task.dueDate === date
}

export function describeRule(rule?: RecurrenceRule | null): string {
  if (!rule) return 'Does not repeat'
  switch (rule.type) {
    case 'daily':
      return 'Every day'
    case 'weekdays':
      return 'Weekdays'
    case 'weekly':
      return 'Weekly'
    case 'monthly':
      return 'Monthly'
    case 'selectedDays': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const order = [1, 2, 3, 4, 5, 6, 0]
      return (
        order
          .filter((d) => rule.days.includes(d))
          .map((d) => names[d])
          .join(', ') || 'No days'
      )
    }
  }
}
