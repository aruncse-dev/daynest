import { create } from 'zustand'

/**
 * Is this phone running the latest DayNest? An installed app can resume from the background
 * for days without reloading, so the app asks the server what's deployed (/version.json,
 * never cached) and compares it with its own build.
 */
interface UpdateState {
  /** a newer build is deployed (or already downloaded and waiting) */
  available: boolean
  /** e.g. "0.2.0 · b4a9cb3" */
  latest: string | null
  /** "Later" tapped: hide the banner for this session (Settings still shows it) */
  dismissed: boolean
  /** set by UpdatePrompt: installs the new version and reloads */
  apply: (() => void) | null
  set: (patch: Partial<Omit<UpdateState, 'set'>>) => void
}

export const useAppUpdate = create<UpdateState>((set) => ({
  available: false,
  latest: null,
  dismissed: false,
  apply: null,
  set: (patch) => set(patch),
}))

export const CURRENT_BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'local'

/** Compares the deployed build with this one. Quietly does nothing offline or in dev. */
export async function checkLatest(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (CURRENT_BUILD === 'local') return false
  try {
    const res = await fetchImpl('/version.json', { cache: 'no-store' })
    if (!res.ok) return false
    const v = (await res.json()) as { version?: string; build?: string }
    if (!v.build || v.build === CURRENT_BUILD) return false
    useAppUpdate.getState().set({ available: true, latest: `${v.version ?? ''} · ${v.build}` })
    return true
  } catch {
    return false
  }
}
