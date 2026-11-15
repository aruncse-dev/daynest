import { getSetting } from '@/db/actions'
import type { Reminder } from '@/db/types'

/**
 * Per-phone identity in a shared family: which profile is "Me" on this phone, and whose
 * reminders ring here. Both stay on this phone (never synced or backed up).
 */
export const ME_KEY = 'meProfileId'
export const RING_KEY = 'ringFor'
export type RingFor = 'all' | 'mine'
/** After restoring a family copy on a phone: ask once which person this phone belongs to. */
export const ASK_WHO_KEY = 'askWhoAmI'

/** Which reminders this phone should ring: everyone's (the family manager) or mine + shared. */
export async function ringsHere(): Promise<(r: Reminder) => boolean> {
  const ring = await getSetting<RingFor>(RING_KEY, 'all')
  const me = await getSetting<string | null>(ME_KEY, null)
  if (ring === 'all' || !me) return () => true
  return (r) => !r.profileId || r.profileId === me
}
