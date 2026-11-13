import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { db } from '@/db/db'
import { saveReminder } from '@/db/actions'
import type { Habit, Profile, Reminder } from '@/db/types'
import { currentStreak, isDueOn } from '@/lib/habits'
import { describeSchedule } from '@/lib/reminders'
import { formatTime12 } from '@/lib/date'
import { usePerson, useProfiles, useSetting, useToday } from '@/lib/hooks'
import { PersonGroup } from '@/components/DayList'
import { isFor } from '@/lib/people'
import { PersonBar } from '@/components/PersonBar'
import { useUI } from '@/store/ui'
import { LinkButton, Panel, Skeleton, Tag, Toggle, cx } from '@/components/ui'
import { HabitRow } from '@/components/rows'
import { AlwaysOnCard } from '@/components/AlwaysOnCard'
import { TabBar, useTab } from '@/components/Tabs'
import { pushConfigured, PUSH_ENABLED_KEY } from '@/lib/push'

const TABS = ['habits', 'reminders'] as const

export function Routines() {
  const [tab, setTab] = useTab(TABS, 'habits')
  return (
    <div className="grid gap-3">
      <h1 className="text-[24px] font-bold tracking-[-0.8px]">Routines</h1>
      <PersonBar />
      <TabBar
        label="Routines"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'habits', label: 'Habits', emoji: '🌱' },
          { value: 'reminders', label: 'Reminders', emoji: '🔔' },
        ]}
      />
      {tab === 'habits' ? <HabitsSection /> : <RemindersTab />}
    </div>
  )
}

/** Stand-alone reminders, plus every reminder that rides on a habit, to-do or event. */
function RemindersTab() {
  return (
    <>
      <AlwaysOnCard />
      <NudgesSection />
      <LinkedSection />
    </>
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
  const { person, hasFamily } = usePerson()
  const profiles = useProfiles()
  const grouped = person === 'all' && hasFamily ? (profiles ?? []) : null
  const openSheet = useUI((s) => s.openSheet)
  const data = useLiveQuery(async () => {
    const [habits, entries] = await Promise.all([
      db.habits.filter((h) => h.status !== 'archived' && isFor(h, person)).toArray(),
      db.habitEntries.toArray(),
    ])
    const byHabit = new Map<string, Set<string>>()
    for (const e of entries) {
      if (!byHabit.has(e.habitId)) byHabit.set(e.habitId, new Set())
      byHabit.get(e.habitId)!.add(e.localDate)
    }
    return { habits, byHabit }
  }, [person])
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

  const renderHabit = (h: Habit) => {
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
              hideOwner={grouped ? (h.profileId ?? undefined) : person}
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
  }
  return (
    <section>
      <SectionHead
        title="Habits"
        action={<LinkButton onClick={() => openSheet({ type: 'habit' })}>+ Add</LinkButton>}
      />
      <Panel>
        {list.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">
            No habits yet. Tap “+ Add” and pick what suits you.
          </p>
        ) : (
          <HabitList
            list={list}
            grouped={grouped}
            renderHabit={renderHabit}
            today={today}
            done={data.byHabit}
          />
        )}
      </Panel>
    </section>
  )
}

/** Under Everyone with a family: one block per person, your own open; else a plain list. */
function HabitList({
  list,
  grouped,
  renderHabit,
  today,
  done,
}: {
  list: Habit[]
  grouped: Profile[] | null
  renderHabit: (h: Habit) => React.ReactNode
  today: string
  done: Map<string, Set<string>>
}) {
  if (!grouped) return <div className="grid gap-2.5">{list.map(renderHabit)}</div>
  const groups = [...grouped.map((p) => p.id), '']
    .map((id) => ({
      id,
      profile: grouped.find((p) => p.id === id),
      habits: list.filter((h) => (h.profileId ?? '') === id),
    }))
    .filter((g) => g.habits.length)
  return (
    <div>
      {groups.map((g) => {
        const due = g.habits.filter((h) => isDueOn(h, today))
        const kept = due.filter((h) => done.get(h.id)?.has(today)).length
        return (
          <PersonGroup
            key={g.id || 'none'}
            profile={g.profile}
            defaultOpen={!!g.profile?.isPrimary}
            summary={`${g.habits.length} habit${g.habits.length > 1 ? 's' : ''} · ${kept}/${due.length} today`}
          >
            <div className="grid gap-2.5">{g.habits.map(renderHabit)}</div>
          </PersonGroup>
        )
      })}
    </div>
  )
}

/* ---------------- Reminders ---------------- */

const LINK_LABEL = { habit: 'Habit', task: 'To-do', event: 'Event' } as const

/** Reminders attached to habits, to-dos and events. Edited on the item itself. */
function LinkedSection() {
  const { person } = usePerson()
  const openSheet = useUI((s) => s.openSheet)
  const rows = useLiveQuery(async () => {
    const linked = await db.reminders.filter((r) => !!r.link).toArray()
    const out: { r: Reminder; open: () => void }[] = []
    for (const r of linked) {
      const { type, id } = r.link!
      if (type === 'habit') {
        const habit = await db.habits.get(id)
        if (habit && habit.status !== 'archived' && isFor(habit, person))
          out.push({ r, open: () => openSheet({ type: 'habit', habit }) })
      } else if (type === 'task') {
        const task = await db.tasks.get(id)
        if (task && task.status !== 'archived' && isFor(task, person))
          out.push({ r, open: () => openSheet({ type: 'task', task }) })
      } else {
        const event = await db.events.get(id)
        if (event && isFor(event, person))
          out.push({ r, open: () => openSheet({ type: 'event', event }) })
      }
    }
    return out.sort(
      (a, b) =>
        (a.r.times?.[0] ?? '99').localeCompare(b.r.times?.[0] ?? '99') ||
        a.r.title.localeCompare(b.r.title),
    )
  }, [person])
  if (!rows?.length) return null
  return (
    <section>
      <SectionHead title="On habits, to-dos & events" />
      <Panel className="!py-1.5">
        {rows.map(({ r, open }) => (
          <button
            key={r.id}
            type="button"
            onClick={open}
            className="flex w-full items-center gap-3 border-b border-line-soft py-2 text-left last:border-0"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface2 text-lg">
              {r.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{r.title}</span>
              <span className="block truncate text-[11px] text-muted">
                {LINK_LABEL[r.link!.type]} · {(r.times ?? []).map(formatTime12).join(', ')}
                {r.link!.type === 'habit' ? ' on its days' : ' on the day'}
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-muted" />
          </button>
        ))}
      </Panel>
      <p className="mt-2 px-1 text-[11px] text-muted">
        These only ring when the item is due and not done yet. Change them on the item.
      </p>
    </section>
  )
}

/* ---------------- Stand-alone reminders ---------------- */

function NudgesSection() {
  const alwaysOn = useSetting(PUSH_ENABLED_KEY, false)
  const { person } = usePerson()
  const openSheet = useUI((s) => s.openSheet)
  // stand-alone nudges only: habit/to-do/event reminders live on those items
  const reminders = useLiveQuery(
    () =>
      db.reminders.filter((r) => !r.link && (person === 'all' || r.profileId === person)).toArray(),
    [person],
  )
  const list = (reminders ?? []).sort(
    (a, b) => Number(b.enabled) - Number(a.enabled) || a.title.localeCompare(b.title),
  )
  return (
    <section>
      <SectionHead
        title="Reminders"
        action={<LinkButton onClick={() => openSheet({ type: 'addNudge' })}>+ Add</LinkButton>}
      />
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
