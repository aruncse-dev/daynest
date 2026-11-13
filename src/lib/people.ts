import type { CalendarEvent, EventType, Profile } from '@/db/types'

/** 'all' = the whole family (global dashboard); otherwise a profile id. */
export type PersonFilter = 'all' | (string & {})

/** Anything that belongs to people: to-dos/events (`profileIds`) or habits (`profileId`). */
export type Owned = { profileIds?: string[]; profileId?: string | null }

/** Who an item is for. Habits belong to one person; to-dos and events can be shared. */
export function ownersOf(item: Owned): string[] {
  if (Array.isArray(item.profileIds)) return item.profileIds
  return item.profileId ? [item.profileId] : []
}

/**
 * Does the item show under `person`?
 * Everyone shows everything. A person shows only what's for them; items for nobody
 * appear under Everyone only.
 */
export function isFor(item: Owned, person: PersonFilter): boolean {
  return person === 'all' || ownersOf(item).includes(person)
}

/** Group key for the Everyone view: the first person it's for, or '' for nobody. */
export function groupOf(item: Owned): string {
  return ownersOf(item)[0] ?? ''
}

export const displayName = (p: Pick<Profile, 'name' | 'isPrimary'>) => (p.isPrimary ? 'Me' : p.name)

export const EVENT_EMOJI: Record<EventType, string> = {
  event: '📅',
  appointment: '🩺',
  school: '🎒',
  birthday: '🎂',
  anniversary: '💍',
  important: '⭐',
}

export const eventEmoji = (e: Pick<CalendarEvent, 'emoji' | 'type'>) =>
  e.emoji || EVENT_EMOJI[e.type] || '📅'

/** Birthdays, anniversaries and other important dates (renewals, due dates…). */
export const isImportantDate = (e: Pick<CalendarEvent, 'type'>) =>
  e.type === 'birthday' || e.type === 'anniversary' || e.type === 'important'
