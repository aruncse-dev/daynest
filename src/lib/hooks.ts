import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { todayLocal } from './date'
import type { Profile } from '@/db/types'

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
