import { createContext, useContext, useEffect, useState } from 'react'

/** Quietly start the database open again after this long, as relaunching the app would. */
export const AUTO_RETRY_MS = 2_500
/** Then show "Still opening…" with Try again / Reload instead of the launch screen. */
export const STUCK_MS = 5_000

export const Startup = createContext<{ restart: () => void }>({
  restart: () => location.reload(),
})
/** Start over from the launch screen (re-open the database, then mount the app afresh). */
export const useStartup = () => useContext(Startup)

/** true once `waiting` has stayed true for `ms` (e.g. a first query that never answers). */
export function useTakingLong(waiting: boolean, ms = STUCK_MS) {
  const [long, setLong] = useState(false)
  useEffect(() => {
    if (!waiting) return
    const t = setTimeout(() => setLong(true), ms)
    return () => clearTimeout(t)
  }, [waiting, ms])
  return waiting && long
}
