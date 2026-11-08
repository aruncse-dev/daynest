import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { saveReminder } from '@/db/actions'
import { REMINDER_PRESETS } from '@/db/reminderPresets'
import { describeSchedule } from '@/lib/reminders'
import { toast, useUI } from '@/store/ui'
import { Button, Sheet, Tag } from '@/components/ui'

/** One place to add a nudge: tap an idea, or create your own. */
export function AddNudgeSheet() {
  const close = useUI((s) => s.closeSheet)
  const openSheet = useUI((s) => s.openSheet)
  const existing = useLiveQuery(() => db.reminders.toArray(), [])
  const ideas = REMINDER_PRESETS.filter(
    (p) =>
      !p.presetKey.startsWith('phonefree') && !existing?.some((r) => r.presetKey === p.presetKey),
  )
  return (
    <Sheet
      title="Add a reminder"
      onClose={close}
      footer={
        <Button className="flex-1" onClick={() => openSheet({ type: 'reminder' })}>
          Create my own
        </Button>
      }
    >
      <p className="text-xs text-muted">
        Tap an idea to add it. You can change the time afterwards.
      </p>
      <div className="grid gap-1">
        {ideas.map(({ area: _area, ...p }) => (
          <button
            key={p.presetKey}
            type="button"
            onClick={async () => {
              await saveReminder({ ...p, enabled: true, lastFiredSlot: new Date().toISOString() })
              toast(`${p.title} added`, { emoji: p.emoji })
              close()
            }}
            className="flex items-center gap-3 rounded-xl p-2 text-left hover:bg-surface2"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface2 text-xl">
              {p.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                {p.title} {p.priority === 'high' && <Tag tone="rose">Important</Tag>}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {describeSchedule({ ...p, id: '', enabled: true, createdAt: '', updatedAt: '' })}
              </span>
            </span>
            <span className="text-lg font-bold text-sage-ink">+</span>
          </button>
        ))}
        {ideas.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">You've added every idea 🎉</p>
        )}
      </div>
    </Sheet>
  )
}
