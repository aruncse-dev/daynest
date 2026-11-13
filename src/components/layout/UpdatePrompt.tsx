import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'
import { checkLatest, useAppUpdate } from '@/lib/appUpdate'

/**
 * Keeps the app current: checks on start, whenever DayNest comes back to the screen and every
 * 30 minutes, and shows a banner when a newer version is deployed.
 */
export function UpdatePrompt() {
  const reg = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const [updating, setUpdating] = useState(false)
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      reg.current = r
    },
  })
  const { available, dismissed, latest, set } = useAppUpdate()

  // the app shell being cached is not news to the user; just acknowledge it silently
  useEffect(() => {
    if (offlineReady) setOfflineReady(false)
  }, [offlineReady, setOfflineReady])

  // a new service worker downloaded = an update is ready
  useEffect(() => {
    if (needRefresh) set({ available: true })
  }, [needRefresh, set])

  useEffect(() => {
    const check = () => {
      void reg.current?.update().catch(() => undefined)
      void checkLatest()
    }
    check()
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    const every = setInterval(check, 30 * 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(every)
    }
  }, [])

  // "Update": install the waiting version, or fetch it first and then install.
  // Registered once; reads the latest values through refs.
  const latestRef = useRef({ needRefresh, updateServiceWorker })
  useEffect(() => {
    latestRef.current = { needRefresh, updateServiceWorker }
  })
  useEffect(() => {
    set({
      apply: () => {
        setUpdating(true)
        const { needRefresh: ready, updateServiceWorker: install } = latestRef.current
        if (ready) void install(true)
        else {
          void reg.current?.update().catch(() => undefined)
          // no service worker (or it never arrives): a plain reload still gets the new page
          setTimeout(() => window.location.reload(), 12_000)
        }
      },
    })
  }, [set])
  useEffect(() => {
    if (updating && needRefresh) void updateServiceWorker(true)
  }, [updating, needRefresh, updateServiceWorker])

  if (!available || (dismissed && !updating)) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-3 z-50 mx-auto flex w-[calc(100%-24px)] max-w-md items-center gap-3 rounded-2xl bg-[#26352a] p-3 text-sm text-white shadow-xl animate-sheet"
    >
      <RefreshCw size={18} className={updating ? 'shrink-0 animate-spin' : 'shrink-0'} />
      <span className="flex-1">
        {updating ? 'Updating DayNest…' : 'A newer DayNest is available.'}
        {latest && !updating && (
          <small className="block text-[11px] opacity-70">Latest: {latest}</small>
        )}
      </span>
      {!updating && (
        <>
          <button
            type="button"
            className="rounded-lg bg-white/15 px-3 py-2 text-xs font-bold"
            onClick={() => set({ dismissed: true })}
          >
            Later
          </button>
          <button
            type="button"
            className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#26352a]"
            onClick={() => useAppUpdate.getState().apply?.()}
          >
            Update
          </button>
        </>
      )}
    </div>
  )
}
