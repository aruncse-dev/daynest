import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'
import { toast } from '@/store/ui'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // check for a new version every hour while the app is open
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (offlineReady) {
      toast('DayNest is ready to work offline', { emoji: '🌿' })
      setOfflineReady(false)
    }
  }, [offlineReady, setOfflineReady])

  if (!needRefresh) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-3 z-50 mx-auto flex w-[calc(100%-24px)] max-w-md items-center gap-3 rounded-2xl bg-[#26352a] p-3 text-sm text-white shadow-xl animate-sheet"
    >
      <RefreshCw size={18} className="shrink-0" />
      <span className="flex-1">A new version of DayNest is ready.</span>
      <button
        type="button"
        className="rounded-lg bg-white/15 px-3 py-2 text-xs font-bold"
        onClick={() => setNeedRefresh(false)}
      >
        Later
      </button>
      <button
        type="button"
        className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#26352a]"
        onClick={() => void updateServiceWorker(true)}
      >
        Update
      </button>
    </div>
  )
}
