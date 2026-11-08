import { REMINDER_PRESETS, type ReminderPreset } from '@/db/reminderPresets'
import type { RecurrenceRule } from '@/db/types'
import { minutesToTime, timeToMinutes } from './date'
import { HABIT_TEMPLATES, type FocusArea, type HabitTemplate } from './templates'

export interface SetupAnswers {
  areas: FocusArea[]
  hasKids: boolean
  wake: string // HH:mm
  /** when phones go down at night; null = not wanted */
  phoneFreeAt: string | null
  worksWeekdays: boolean
}

export type Suggestion =
  | {
      id: string
      kind: 'habit'
      area: FocusArea
      title: string
      emoji: string
      detail: string
      recommended: boolean
      template: HabitTemplate
    }
  | {
      id: string
      kind: 'nudge'
      area: FocusArea
      title: string
      emoji: string
      detail: string
      recommended: boolean
      preset: ReminderPreset
    }
  | {
      id: string
      kind: 'task'
      area: FocusArea
      title: string
      emoji: string
      detail: string
      recommended: boolean
      rule: RecurrenceRule
      weekday: number
      time?: string
    }

const shift = (t: string, mins: number) =>
  minutesToTime((((timeToMinutes(t) + mins) % 1440) + 1440) % 1440)

/** Personalise preset times to the household's rhythm. */
export function tunePreset(p: ReminderPreset, a: SetupAnswers): ReminderPreset {
  const night = a.phoneFreeAt ?? '22:00'
  const t = (times: string[]) => ({ ...p, times })
  switch (p.presetKey) {
    case 'footwear':
      return t([shift(a.wake, 30), '17:30'])
    case 'yoga':
      return t([shift(a.wake, 15)])
    case 'kid-teeth':
      return t([shift(a.wake, 30), shift(night, -120)])
    case 'story':
      return t([shift(night, -90)])
    case 'meditate':
      return t([shift(night, -60)])
    case 'plan-tomorrow':
      return t([shift(night, -75)])
    case 'phonefree-soon':
      return t([shift(night, -15)])
    case 'phonefree':
      return t([night])
    case 'water':
      return { ...p, startTime: shift(a.wake, 60), endTime: shift(night, -120) }
    default:
      return p
  }
}

const RECOMMENDED = new Set([
  'walk',
  'water',
  'meditate',
  'gratitude',
  'family-dinner',
  'hug',
  'kid-read',
  'kid-teeth',
  'phone-free-night',
  'phones-dinner',
  'plan-tomorrow',
  'read',
  'top3',
  'p:water',
  'p:posture',
  'p:footwear',
  'p:phonefree',
  'p:phonefree-soon',
  'p:kid-teeth',
  'p:story',
  'p:family-dinner',
  'p:hug',
  'p:focus',
  't:plan-week',
])

export function suggest(a: SetupAnswers): Suggestion[] {
  const areas = new Set(a.areas)
  if (a.phoneFreeAt) areas.add('digital')
  if (!a.hasKids) areas.delete('kids')
  if (!a.worksWeekdays) areas.delete('work')
  const out: Suggestion[] = []

  for (const h of HABIT_TEMPLATES) {
    if (!areas.has(h.area)) continue
    if (h.key === 'phone-free-night' && !a.phoneFreeAt) continue
    const title =
      h.key === 'phone-free-night' ? `No phone after ${formatShort(a.phoneFreeAt!)}` : h.title
    out.push({
      id: `h:${h.key}`,
      kind: 'habit',
      area: h.area,
      title,
      emoji: h.emoji,
      detail: [
        h.targetLabel,
        h.forKids ? 'for each child' : h.shared ? 'whole family' : null,
        h.days?.length ? daysLabel(h.days) : 'daily',
      ]
        .filter(Boolean)
        .join(' · '),
      recommended: RECOMMENDED.has(h.key),
      template: h,
    })
  }
  for (const raw of REMINDER_PRESETS) {
    if (!areas.has(raw.area)) continue
    if ((raw.presetKey === 'phonefree' || raw.presetKey === 'phonefree-soon') && !a.phoneFreeAt)
      continue
    const p = tunePreset(raw, a)
    out.push({
      id: `p:${p.presetKey}`,
      kind: 'nudge',
      area: p.area,
      title: p.title,
      emoji: p.emoji,
      detail:
        p.kind === 'times'
          ? (p.times ?? []).map(formatShort).join(', ')
          : `every ${p.intervalMinutes} min, ${formatShort(p.startTime!)}–${formatShort(p.endTime!)}`,
      recommended: RECOMMENDED.has(`p:${p.presetKey}`),
      preset: p,
    })
  }
  if (areas.has('home') || areas.has('work'))
    out.push({
      id: 't:plan-week',
      kind: 'task',
      area: 'home',
      title: 'Plan the week',
      emoji: '🗓️',
      detail: 'Sundays',
      recommended: true,
      rule: { type: 'weekly' },
      weekday: 0,
      time: '18:00',
    })
  if (areas.has('family'))
    out.push({
      id: 't:family-meeting',
      kind: 'task',
      area: 'family',
      title: 'Family check-in: wins & plans',
      emoji: '💬',
      detail: 'Sundays',
      recommended: false,
      rule: { type: 'weekly' },
      weekday: 0,
      time: '17:00',
    })
  if (areas.has('home'))
    out.push({
      id: 't:laundry',
      kind: 'task',
      area: 'home',
      title: 'Laundry',
      emoji: '🧺',
      detail: 'Saturdays',
      recommended: false,
      rule: { type: 'weekly' },
      weekday: 6,
    })
  return out
}

export function formatShort(t: string) {
  const m = timeToMinutes(t)
  const h = Math.floor(m / 60)
  const mm = m % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}

function daysLabel(days: number[]) {
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'weekdays'
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'weekends'
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => days.includes(d))
    .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
    .join(' ')
}
