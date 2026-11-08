import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { db } from '@/db/db'
import { setHabitStatus, toggleHabit } from '@/db/actions'
import type { Habit } from '@/db/types'
import {
  compareLocal,
  formatLocal,
  monthGrid,
  parseLocalDate,
  sameMonth,
  toLocalDate,
  WEEKDAY_LETTER,
  WEEK_ORDER,
} from '@/lib/date'
import { currentStreak, isDueOn, isScheduledOn, longestStreak } from '@/lib/habits'
import { useProfileMap, useToday } from '@/lib/hooks'
import { useUI } from '@/store/ui'
import {
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  Panel,
  Ring,
  Skeleton,
  Tag,
  cx,
} from '@/components/ui'
import { HabitRow } from '@/components/rows'
import { ProfileFilter } from './Tasks'

export function Habits() {
  const today = useToday()
  const openSheet = useUI((s) => s.openSheet)
  const filter = useUI((s) => s.profileFilter)
  const profiles = useProfileMap()
  const data = useLiveQuery(async () => {
    const [habits, entries] = await Promise.all([db.habits.toArray(), db.habitEntries.toArray()])
    const byHabit = new Map<string, Set<string>>()
    for (const e of entries) {
      if (!byHabit.has(e.habitId)) byHabit.set(e.habitId, new Set())
      byHabit.get(e.habitId)!.add(e.localDate)
    }
    return { habits: habits.filter((h) => filter === 'all' || h.profileId === filter), byHabit }
  }, [filter])

  if (!data) return <Skeleton lines={5} />
  const active = data.habits.filter((h) => h.status === 'active')
  const todayHabits = active.filter((h) => isDueOn(h, today))
  const doneToday = todayHabits.filter((h) => data.byHabit.get(h.id)?.has(today)).length
  const paused = data.habits.filter((h) => h.status !== 'active')

  return (
    <div>
      <PageHeader
        eyebrow="Habits"
        title="Small actions, repeated"
        sub="Gentle consistency over perfection."
        action={<Button onClick={() => openSheet({ type: 'habit' })}>+ New habit</Button>}
      />
      <ProfileFilter />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel>
          <div className="mb-4 flex items-center gap-4">
            <Ring value={todayHabits.length ? doneToday / todayHabits.length : 0} size={64}>
              {doneToday}/{todayHabits.length}
            </Ring>
            <div>
              <h2 className="text-base font-bold">Today</h2>
              <p className="text-xs text-muted">
                {doneToday === todayHabits.length && todayHabits.length
                  ? 'All done — lovely work 🌿'
                  : 'One tap to check off.'}
              </p>
            </div>
          </div>
          {todayHabits.length === 0 ? (
            <EmptyState emoji="🌱" title="No habits scheduled today" />
          ) : (
            <div className="grid gap-3">
              {todayHabits.map((h) => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  done={!!data.byHabit.get(h.id)?.has(today)}
                  date={today}
                  streak={currentStreak(h, data.byHabit.get(h.id) ?? new Set(), today)}
                  owner={filter === 'all' ? profiles.get(h.profileId ?? '') : undefined}
                />
              ))}
            </div>
          )}
        </Panel>
        <div className="grid gap-4">
          {active.length === 0 && (
            <Panel>
              <EmptyState
                emoji="🌿"
                title="Create your first habit"
                text="Tiny and specific works best: “Drink a glass of water after waking”."
                action={<Button onClick={() => openSheet({ type: 'habit' })}>+ New habit</Button>}
              />
            </Panel>
          )}
          {active.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              done={data.byHabit.get(h.id) ?? new Set()}
              today={today}
            />
          ))}
        </div>
      </div>
      {paused.length > 0 && (
        <Panel className="mt-4">
          <div className="mb-2 text-xs font-bold text-muted">
            Paused & archived — not counted in daily progress
          </div>
          {paused.map((h) => (
            <div
              key={h.id}
              className="flex items-center gap-3 border-b border-line-soft py-2 last:border-0"
            >
              <span className="text-lg">{h.emoji}</span>
              <span className="flex-1 truncate text-sm">{h.title}</span>
              <Tag tone="muted">{h.status}</Tag>
              <Button size="sm" variant="ghost" onClick={() => setHabitStatus(h.id, 'active')}>
                Resume
              </Button>
            </div>
          ))}
        </Panel>
      )}
    </div>
  )
}

function HabitCard({ habit, done, today }: { habit: Habit; done: Set<string>; today: string }) {
  const openSheet = useUI((s) => s.openSheet)
  const [month, setMonth] = useState(today)
  const grid = monthGrid(month)
  const cur = currentStreak(habit, done, today)
  const best = longestStreak(habit, done, today)
  const monthDays = grid.filter(
    (d) => sameMonth(d, month) && compareLocal(d, today) <= 0 && isScheduledOn(habit, d),
  )
  const monthDone = monthDays.filter((d) => done.has(d)).length
  const shift = (n: number) => {
    const d = parseLocalDate(month)
    setMonth(toLocalDate(new Date(d.getFullYear(), d.getMonth() + n, 1)))
  }
  return (
    <Panel>
      <div className="mb-3 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-sage-soft text-xl">
          {habit.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold">{habit.title}</h3>
          <div className="text-[11px] text-muted">
            {habit.targetLabel ? `${habit.targetLabel} · ` : ''}
            {habit.scheduleDays.length
              ? WEEK_ORDER.filter((d) => habit.scheduleDays.includes(d))
                  .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                  .join(' ')
              : 'Every day'}
          </div>
        </div>
        <IconButton
          label={`Edit ${habit.title}`}
          onClick={() => openSheet({ type: 'habit', habit })}
        >
          <Pencil size={15} />
        </IconButton>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <Mini value={`🔥 ${cur}`} label="Current streak" />
        <Mini value={`🏆 ${best}`} label="Longest streak" />
        <Mini
          value={monthDays.length ? `${Math.round((monthDone / monthDays.length) * 100)}%` : '—'}
          label={formatLocal(month, 'MMMM')}
        />
      </div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shift(-1)}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface2"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-bold">{formatLocal(month, 'MMMM yyyy')}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shift(1)}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface2"
          disabled={sameMonth(month, today)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div
        className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted"
        role="grid"
        aria-label={`${habit.title} history`}
      >
        {WEEK_ORDER.map((d) => (
          <span key={d}>{WEEKDAY_LETTER[d]}</span>
        ))}
        {grid.map((d) => {
          const inMonth = sameMonth(d, month)
          const future = compareLocal(d, today) > 0
          const isDone = done.has(d)
          const sched = isScheduledOn(habit, d)
          return (
            <button
              key={d}
              type="button"
              disabled={!inMonth || future}
              onClick={() => toggleHabit(habit.id, d)}
              aria-label={`${formatLocal(d, 'd MMMM')}: ${isDone ? 'done' : 'not done'}`}
              className={cx(
                'aspect-square rounded-[7px] text-[10px] transition',
                !inMonth && 'invisible',
                isDone
                  ? 'bg-sage font-bold text-white'
                  : sched && !future
                    ? 'bg-surface2 text-muted'
                    : 'text-muted/50',
                d === today && 'ring-2 ring-sage/50',
              )}
            >
              {parseLocalDate(d).getDate()}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted">
        Tap a past day to fix a missed check-in. Editing the habit never changes this history.
      </p>
    </Panel>
  )
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-surface2 px-2 py-2">
      <div className="text-sm font-bold">{value}</div>
      <div className="truncate text-[10px] text-muted">{label}</div>
    </div>
  )
}
