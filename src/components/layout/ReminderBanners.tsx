import { X } from 'lucide-react'
import { useUI } from '@/store/ui'
import { db } from '@/db/db'
import { nowIso } from '@/lib/date'

/** In-app reminder cards — shown whenever a reminder fires while DayNest is open. */
export function ReminderBanners() {
  const active = useUI((s) => s.activeReminders)
  const dismiss = useUI((s) => s.dismissReminder)
  if (!active.length) return null
  return (
    <div
      className="fixed inset-x-0 top-3 z-50 mx-auto grid w-full max-w-md gap-2 px-3"
      aria-live="assertive"
    >
      {active.map(({ reminder: r }) => (
        <div
          key={r.id}
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-sage-line bg-surface p-3.5 shadow-xl animate-sheet"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sage-soft text-2xl animate-bell">
            {r.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{r.title}</div>
            <div className="text-xs text-muted">{r.message}</div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="min-h-9 rounded-lg bg-sage px-3 text-xs font-bold text-white"
                onClick={() => dismiss(r.id)}
              >
                Done ✓
              </button>
              <button
                type="button"
                className="min-h-9 rounded-lg bg-surface2 px-3 text-xs font-bold text-ink"
                onClick={async () => {
                  await db.reminders.update(r.id, {
                    snoozedUntil: new Date(Date.now() + 10 * 60_000).toISOString(),
                    updatedAt: nowIso(),
                  })
                  dismiss(r.id)
                }}
              >
                Snooze 10 min
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface2"
            onClick={() => dismiss(r.id)}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
