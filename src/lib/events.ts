import type { CalendarEvent } from '@/db/types'
import { compareLocal, parseLocalDate, type LocalDate } from './date'

/** Event instances (including yearly repeats) between two local dates, inclusive. */
export function eventsBetween(events: CalendarEvent[], from: LocalDate, to: LocalDate) {
  const out: (CalendarEvent & { occursOn: LocalDate })[] = []
  const fromYear = parseLocalDate(from).getFullYear()
  const toYear = parseLocalDate(to).getFullYear()
  for (const e of events) {
    if (e.repeatYearly) {
      for (let y = fromYear; y <= toYear; y++) {
        const d = `${y}${e.localDate.slice(4)}`
        // Feb 29 birthdays show on Feb 28 in non-leap years
        const valid = d.endsWith('-02-29') && new Date(y, 1, 29).getMonth() !== 1 ? `${y}-02-28` : d
        if (
          compareLocal(valid, e.localDate) >= 0 &&
          compareLocal(valid, from) >= 0 &&
          compareLocal(valid, to) <= 0
        )
          out.push({ ...e, occursOn: valid })
      }
    } else if (compareLocal(e.localDate, from) >= 0 && compareLocal(e.localDate, to) <= 0) {
      out.push({ ...e, occursOn: e.localDate })
    }
  }
  return out.sort(
    (a, b) =>
      compareLocal(a.occursOn, b.occursOn) || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
  )
}
