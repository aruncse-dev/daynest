import { useUI } from '@/store/ui'

export function Toasts() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismissToast)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[150px] z-50 grid justify-items-center gap-2 px-4 md:bottom-24"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#26352a] py-2.5 pl-4 pr-2 text-xs text-white shadow-lg animate-sheet"
        >
          {t.emoji && <span>{t.emoji}</span>}
          <span className="pr-2">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="rounded-full bg-white/15 px-3 py-1.5 font-bold hover:bg-white/25"
              onClick={() => {
                t.action?.run()
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
