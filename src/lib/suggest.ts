import { REMINDER_PRESETS, type ReminderPreset } from '@/db/reminderPresets'
import type { RecurrenceRule } from '@/db/types'
import { minutesToTime, timeToMinutes } from './date'
import { FOCUS_AREAS, HABIT_TEMPLATES, type FocusArea, type HabitTemplate } from './templates'

export interface SetupAnswers {
  areas: FocusArea[]
  wake: string // HH:mm
  /** when the phone goes down at night; null = not wanted */
  phoneFreeAt: string | null
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
      remindAt: string | null
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
      remindAt: string | null
    }

const shift = (t: string, mins: number) =>
  minutesToTime((((timeToMinutes(t) + mins) % 1440) + 1440) % 1440)

/** Personalise nudge times to the person's rhythm. */
export function tunePreset(p: ReminderPreset, a: SetupAnswers): ReminderPreset {
  const night = a.phoneFreeAt ?? '22:00'
  switch (p.presetKey) {
    case 'phonefree-soon':
      return { ...p, times: [shift(night, -15)] }
    case 'phonefree':
      return { ...p, times: [night] }
    case 'water':
      return { ...p, startTime: shift(a.wake, 90), endTime: shift(night, -120) }
    default:
      return p
  }
}

/**
 * Pre-ticked items: only things that follow from the person's own answers (the phone-down
 * time they chose) or simple planning routines. Health and calm items are never pre-ticked;
 * we don't know enough about anyone to recommend them.
 */
const RECOMMENDED = new Set([
  'phone-free-night',
  'top3',
  'plan-tomorrow',
  'p:phonefree',
  'p:phonefree-soon',
  't:plan-week',
])

export function suggest(a: SetupAnswers): Suggestion[] {
  const valid = new Set(FOCUS_AREAS.map((f) => f.key))
  const areas = new Set(a.areas.filter((x) => valid.has(x)))
  if (a.phoneFreeAt) areas.add('digital')
  const night = a.phoneFreeAt ?? '22:00'
  const out: Suggestion[] = []

  for (const h of HABIT_TEMPLATES) {
    if (!areas.has(h.area)) continue
    if (h.key === 'phone-free-night' && !a.phoneFreeAt) continue
    const title =
      h.key === 'phone-free-night' ? `No phone after ${formatShort(a.phoneFreeAt!)}` : h.title
    const remindAt = h.remind
      ? shift(h.remind.from === 'wake' ? a.wake : night, h.remind.minutes)
      : null
    out.push({
      id: `h:${h.key}`,
      kind: 'habit',
      area: h.area,
      title,
      emoji: h.emoji,
      detail: ['daily', remindAt && `🔔 ${formatShort(remindAt)}`].filter(Boolean).join(' · '),
      recommended: RECOMMENDED.has(h.key),
      template: h,
      remindAt,
    })
  }
  for (const raw of REMINDER_PRESETS) {
    if (!areas.has(raw.area)) continue
    if (raw.presetKey.startsWith('phonefree') && !a.phoneFreeAt) continue
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
          : `every ${p.intervalMinutes! / 60}h, ${formatShort(p.startTime!)}–${formatShort(p.endTime!)}`,
      recommended: RECOMMENDED.has(`p:${p.presetKey}`),
      preset: p,
    })
  }
  if (areas.has('organised'))
    out.push({
      id: 't:plan-week',
      kind: 'task',
      area: 'organised',
      title: 'Plan the week',
      emoji: '🗓️',
      detail: 'Sundays · 🔔 6 PM',
      recommended: true,
      rule: { type: 'weekly' },
      weekday: 0,
      time: '18:00',
      remindAt: '18:00',
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
