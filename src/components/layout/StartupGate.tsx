import { useEffect, useState, type ReactNode } from 'react'
import { db } from '@/db/db'
import { openBlocked, openDb, reopenDb } from '@/db/open'
import { toast } from '@/store/ui'
import { Button } from '@/components/ui'
import { AUTO_RETRY_MS, STUCK_MS, Startup } from './startup'

type Phase = 'opening' | 'slow' | 'failed' | 'ready'

/**
 * Opens the database before the app mounts, and never leaves the launch screen up for good
 * (see db/open.ts for why opening can hang). The app only mounts once the database is open,
 * so re-opening never pulls it out from under live queries.
 */
export function StartupGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(() => (db.isOpen() ? 'ready' : 'opening'))
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    let latest = 0
    const run = (open: () => Promise<void>) => {
      const id = ++latest
      open().then(
        () => live && setPhase('ready'),
        (err: unknown) => {
          // an open cancelled by a newer one rejects too: only the newest one counts
          if (!live || id !== latest) return
          console.error('Failed to open DayNest database', err)
          setError(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
          setPhase('failed')
        },
      )
    }
    run(attempt === 0 ? openDb : reopenDb)
    const retry = setTimeout(() => {
      if (attempt === 0 && !db.isOpen()) run(reopenDb)
    }, AUTO_RETRY_MS)
    const slow = setTimeout(() => live && setPhase((p) => (p === 'opening' ? 'slow' : p)), STUCK_MS)
    return () => {
      live = false
      clearTimeout(retry)
      clearTimeout(slow)
    }
  }, [attempt])

  // Another DayNest (a newer version in another tab) needs the data: Dexie has closed this
  // connection to let it through. Say so, rather than carrying on with an old copy of the app.
  useEffect(() => {
    // (returns nothing: a listener returning false would stop Dexie's own close-on-versionchange)
    const onChange = () => {
      toast('DayNest was updated in another window.', {
        emoji: '🔄',
        action: { label: 'Reload', run: () => location.reload() },
      })
    }
    db.on('versionchange', onChange)
    return () => db.on('versionchange').unsubscribe(onChange)
  }, [])

  const restart = () => {
    setError('')
    setPhase('opening') // unmounts the app (and its live queries) before the database closes
    setAttempt((a) => a + 1)
  }

  if (phase === 'ready') return <Startup.Provider value={{ restart }}>{children}</Startup.Provider>
  if (phase === 'opening') return <LaunchScreen />
  return <StillOpening onRetry={restart} error={phase === 'failed' ? error : ''} />
}

/** The pulsing icon shown while DayNest opens. */
export function LaunchScreen() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <img src="/favicon.svg" alt="Loading DayNest" className="size-14 animate-pulse rounded-2xl" />
    </div>
  )
}

/** Shown instead of a launch screen that would otherwise stay up for good. */
export function StillOpening({ onRetry, error = '' }: { onRetry: () => void; error?: string }) {
  const why = error
    ? 'DayNest could not open its data on this phone. Private browsing, a full disk, or blocked site data can cause this. Nothing has been deleted.'
    : openBlocked()
      ? 'DayNest is open in another tab or window that is still holding your data. Close it, then try again.'
      : 'Your phone is taking longer than usual to open DayNest’s data. Your data is safe.'
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center" role="alert">
      <div className="max-w-sm">
        <img src="/favicon.svg" alt="" className="mx-auto size-14 rounded-2xl" />
        <h1 className="mt-3 text-xl font-bold">
          {error ? 'Couldn’t open DayNest' : 'Still opening…'}
        </h1>
        <p className="mt-2 text-sm text-muted">{why}</p>
        {error && (
          <pre className="mt-3 overflow-auto rounded-xl bg-surface2 p-3 text-left text-[11px] text-muted">
            {error}
          </pre>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={onRetry}>Try again</Button>
          <Button variant="outline" onClick={() => location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  )
}
