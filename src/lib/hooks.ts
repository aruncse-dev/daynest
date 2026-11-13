import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { todayLocal } from './date'
import type { Profile } from '@/db/types'
import { useUI } from '@/store/ui'

/** Current local date that rolls over at midnight (and when the tab becomes visible). */
export function useToday(): string {
  const [today, setToday] = useState(todayLocal())
  useEffect(() => {
    const tick = () => setToday((prev) => (prev === todayLocal() ? prev : todayLocal()))
    const id = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return today
}

export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
}

export function useProfiles(): Profile[] | undefined {
  return useLiveQuery(
    async () =>
      (await db.profiles.filter((p) => !p.archivedAt).toArray()).sort(
        (a, b) =>
          Number(!!b.isPrimary) - Number(!!a.isPrimary) || a.createdAt.localeCompare(b.createdAt),
      ),
    [],
  )
}

export function useProfileMap(): Map<string, Profile> {
  const profiles = useProfiles()
  return new Map((profiles ?? []).map((p) => [p.id, p]))
}

export function usePrimaryProfile(): Profile | undefined {
  const profiles = useProfiles()
  return profiles?.find((p) => p.isPrimary) ?? profiles?.[0]
}

export function useSetting<T>(key: string, fallback: T): T {
  const row = useLiveQuery(() => db.settings.get(key), [key])
  return row ? (row.value as T) : fallback
}

/** Family members managed on this phone (everyone except you). Nothing is shared or synced. */
export function useMembers(): Profile[] {
  const profiles = useProfiles()
  return profiles?.filter((p) => !p.isPrimary) ?? []
}

/**
 * The person the tabs are showing: 'all' (Everyone) or a profile id.
 * Falls back to Everyone when there are no family members or the person was removed.
 */
export function usePerson(): {
  person: string
  setPerson: (id: string) => void
  hasFamily: boolean
} {
  const profiles = useProfiles()
  const raw = useUI((s) => s.profileFilter)
  const setPerson = useUI((s) => s.setProfileFilter)
  const hasFamily = (profiles?.length ?? 0) > 1
  const exists = !!profiles?.some((p) => p.id === raw)
  // while profiles load, keep the remembered choice to avoid a flash
  const person = !profiles ? raw : hasFamily && exists ? raw : 'all'
  return { person, setPerson, hasFamily }
}

/** New items start out "for" the person whose tab is open (nobody under Everyone). */
export function useDefaultPeople(): string[] {
  const { person } = usePerson()
  return person === 'all' ? [] : [person]
}
