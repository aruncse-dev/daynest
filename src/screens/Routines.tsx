import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { db } from '@/db/db'
import { saveReminder } from '@/db/actions'
import type { Reminder } from '@/db/types'
import { currentStreak, isDueOn } from '@/lib/habits'
import { describeSchedule } from '@/lib/reminders'
import { useSetting, useToday } from '@/lib/hooks'
import { useUI } from '@/store/ui'
import { LinkButton, Panel, Skeleton, Tag, Toggle, cx } from '@/components/ui'
import { HabitRow } from '@/components/rows'
import { AlwaysOnCard } from '@/components/AlwaysOnCard'
import { pushConfigured, PUSH_ENABLED_KEY } from '@/lib/push'

export function Routines() {
  return (
    <div className="grid gap-3">
      <h1 className="text-[24px] font-bold tracking-[-0.8px]">Routines</h1>
      <HabitsSection />
      <NudgesSection />
    </div>
  )
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</h2>
      {action}
    </div>
  )
}

/* ---------------- Habits ---------------- */

function HabitsSection() {
  const today = useToday()
  const openSheet = useUI((s) => s.openSheet)
  const data = useLiveQuery(async () => {
    const [habits, entries] = await Promise.all([
      db.habits.filter((h) => h.status !== 'archived').toArray(),
      db.habitEntries.toArray(),
    ])
    const byHabit = new Map<string, Set<string>>()
    for (const e of entries) {
      if (!byHabit.has(e.habitId)) byHabit.set(e.habitId, new Set())
      byHabit.get(e.habitId)!.add(e.localDate)
    }
    return { habits, byHabit }
  }, [])
  if (!data)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  const list = data.habits.sort(
    (a, b) =>
      Number(b.status === 'active') - Number(a.status === 'active') ||
      a.title.localeCompare(b.title),
  )

  return (
    <section>
      <SectionHead
        title="My habits"
        action={<LinkButton onClick={() => openSheet({ type: 'habit' })}>+ Add</LinkButton>}
      />
      <Panel>
        {list.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">
            No habits yet. Tap “+ Add” and pick what suits you.
          </p>
        ) : (
          <div className="grid gap-2.5">
            {list.map((h) => {
              const dueToday = isDueOn(h, today)
              return (
                <div
                  key={h.id}
                  className={cx('flex items-center gap-1', h.status !== 'active' && 'opacity-60')}
                >
                  <div className="min-w-0 flex-1">
                    {dueToday ? (
                      <HabitRow
                        habit={h}
                        done={!!data.byHabit.get(h.id)?.has(today)}
                        date={today}
                        streak={currentStreak(h, data.byHabit.get(h.id) ?? new Set(), today)}
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="grid size-[38px] place-items-center rounded-xl bg-surface2 text-lg">
                          {h.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <b className="block truncate text-[13.5px]">{h.title}</b>
                          <small className="text-[11px] text-muted">
                            {h.status === 'paused' ? 'Paused' : 'Not today'}
                          </small>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`${h.title} history and settings`}
                    onClick={() => openSheet({ type: 'habitDetail', habitId: h.id })}
                    className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface2"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </section>
  )
}

/* ---------------- Nudges ---------------- */

function NudgesSection() {
  const alwaysOn = useSetting(PUSH_ENABLED_KEY, false)
  const openSheet = useUI((s) => s.openSheet)
  // stand-alone nudges only: habit/to-do/event reminders live on those items
  const reminders = useLiveQuery(() => db.reminders.filter((r) => !r.link).toArray(), [])
  const list = (reminders ?? []).sort(
    (a, b) => Number(b.enabled) - Number(a.enabled) || a.title.localeCompare(b.title),
  )
  return (
    <section>
      <SectionHead
        title="My reminders"
        action={<LinkButton onClick={() => openSheet({ type: 'addNudge' })}>+ Add</LinkButton>}
      />
      <AlwaysOnCard />
      <Panel className="!py-1.5">
        {list.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">
            No reminders yet. Tap “+ Add” for ideas like drinking water.
          </p>
        ) : (
          list.map((r) => <NudgeRow key={r.id} reminder={r} />)
        )}
      </Panel>
      {!(pushConfigured() && alwaysOn) && (
        <p className="mt-2 px-1 text-[11px] text-muted">
          Reminders appear while DayNest is open or running in the background. Install it to your
          home screen for best results.
        </p>
      )}
    </section>
  )
}

function NudgeRow({ reminder: r }: { reminder: Reminder }) {
  const openSheet = useUI((s) => s.openSheet)
  return (
    <div
      className={cx(
        'flex items-center gap-3 border-b border-line-soft py-2 last:border-0',
        !r.enabled && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={() => openSheet({ type: 'reminder', reminder: r })}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={cx(
            'grid size-9 shrink-0 place-items-center rounded-[10px] text-lg',
            r.enabled ? 'bg-sage-soft' : 'bg-surface2 grayscale',
          )}
        >
          {r.emoji}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            <span className="truncate">{r.title}</span>
            {r.priority === 'high' && <Tag tone="rose">Important</Tag>}
          </span>
          <span className="block truncate text-[11px] text-muted">{describeSchedule(r)}</span>
        </span>
      </button>
      <Toggle
        checked={r.enabled}
        label={`${r.title} on`}
        onChange={(v) =>
          saveReminder({
            ...r,
            enabled: v,
            lastFiredSlot: v ? new Date().toISOString() : r.lastFiredSlot,
          })
        }
      />
    </div>
  )
}
