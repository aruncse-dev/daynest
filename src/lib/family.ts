import type { EventType, Profile, RecurrenceRule } from '@/db/types'

export type FamilyRole = 'spouse' | 'child' | 'parent' | 'other'

export const ROLES: { value: FamilyRole; label: string; avatar: string; color: string }[] = [
  { value: 'spouse', label: 'Spouse / partner', avatar: '💑', color: '#f0dfdf' },
  { value: 'child', label: 'Child', avatar: '🧒', color: '#e6e2f1' },
  { value: 'parent', label: 'Parent', avatar: '👵', color: '#f4ead2' },
  { value: 'other', label: 'Other', avatar: '🙂', color: '#dfeaf0' },
]

/** Older versions stored free-text roles ("Child", "Partner", "Personal"). */
export function roleOf(p: Pick<Profile, 'role'>): FamilyRole {
  const r = (p.role ?? '').toLowerCase()
  if (r === 'spouse' || r === 'partner') return 'spouse'
  if (r === 'child' || r === 'kid') return 'child'
  if (r === 'parent') return 'parent'
  return 'other'
}

export function roleLabel(p: Pick<Profile, 'role'>): string {
  return ROLES.find((r) => r.value === roleOf(p))!.label
}

/**
 * Ideas for tracking a family member's routines and activities. Each opens a prefilled editor
 * so times can be adjusted before saving; nothing is created without a tap on Save.
 */
export type FamilyIdea =
  | { key: string; kind: 'habit'; title: string; emoji: string; days?: number[]; remind?: string[] }
  | {
      key: string
      kind: 'task'
      title: string
      emoji: string
      time: string
      rule: RecurrenceRule
      before?: number
    }
  | {
      key: string
      kind: 'event'
      title: string
      emoji: string
      type: EventType
      yearly?: boolean
      before?: number
    }

const WEEKDAYS = [1, 2, 3, 4, 5]

export const FAMILY_IDEAS: Record<FamilyRole, FamilyIdea[]> = {
  child: [
    { key: 'read', kind: 'habit', title: 'Reading time', emoji: '📚', remind: ['19:30'] },
    { key: 'teeth', kind: 'habit', title: 'Brush teeth', emoji: '🦷', remind: ['07:30', '20:00'] },
    {
      key: 'homework',
      kind: 'habit',
      title: 'Homework',
      emoji: '✏️',
      days: WEEKDAYS,
      remind: ['17:00'],
    },
    {
      key: 'bag',
      kind: 'task',
      title: 'Pack school bag',
      emoji: '🎒',
      time: '20:00',
      rule: { type: 'selectedDays', days: [0, 1, 2, 3, 4] },
      before: 0,
    },
    {
      key: 'class',
      kind: 'task',
      title: 'Activity class',
      emoji: '⚽',
      time: '17:00',
      rule: { type: 'weekly' },
      before: 60,
    },
    { key: 'play', kind: 'habit', title: 'Outdoor play', emoji: '🌳' },
    {
      key: 'school-event',
      kind: 'event',
      title: 'School event',
      emoji: '🏫',
      type: 'event',
      before: -1,
    },
  ],
  parent: [
    {
      key: 'medicine',
      kind: 'habit',
      title: 'Medicine taken',
      emoji: '💊',
      remind: ['09:00', '21:00'],
    },
    { key: 'call', kind: 'habit', title: 'Call / check in', emoji: '☎️', remind: ['18:00'] },
    { key: 'walk', kind: 'habit', title: 'Walk together', emoji: '🚶' },
    {
      key: 'doctor',
      kind: 'event',
      title: 'Doctor appointment',
      emoji: '🩺',
      type: 'appointment',
      before: 60,
    },
    {
      key: 'groceries',
      kind: 'task',
      title: 'Groceries for them',
      emoji: '🛒',
      time: '11:00',
      rule: { type: 'weekly' },
    },
    {
      key: 'birthday',
      kind: 'event',
      title: 'Birthday',
      emoji: '🎂',
      type: 'birthday',
      yearly: true,
      before: -1,
    },
  ],
  spouse: [
    { key: 'talk', kind: 'habit', title: 'Talk about our day', emoji: '💬', remind: ['21:00'] },
    { key: 'appreciate', kind: 'habit', title: 'Appreciate them', emoji: '🤗' },
    {
      key: 'date',
      kind: 'task',
      title: 'Date night',
      emoji: '🌹',
      time: '19:30',
      rule: { type: 'weekly' },
      before: 60,
    },
    {
      key: 'birthday',
      kind: 'event',
      title: 'Birthday',
      emoji: '🎂',
      type: 'birthday',
      yearly: true,
      before: -1,
    },
    {
      key: 'anniversary',
      kind: 'event',
      title: 'Anniversary',
      emoji: '💍',
      type: 'important',
      yearly: true,
      before: -1,
    },
  ],
  other: [
    { key: 'call', kind: 'habit', title: 'Call / check in', emoji: '☎️', remind: ['18:00'] },
    {
      key: 'birthday',
      kind: 'event',
      title: 'Birthday',
      emoji: '🎂',
      type: 'birthday',
      yearly: true,
      before: -1,
    },
  ],
}
