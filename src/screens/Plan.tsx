import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { db } from '@/db/db'
import { saveTask } from '@/db/actions'
import type { Goal, GoalHorizon, Task } from '@/db/types'
import {
  addLocalDays,
  formatLocal,
  isLocalDate,
  monthGrid,
  parseLocalDate,
  sameMonth,
  toLocalDate,
  WEEKDAY_LETTER,
  WEEK_ORDER,
} from '@/lib/date'
import { goalProgress } from '@/lib/goals'
import { useProfileMap, useToday } from '@/lib/hooks'
import {
  eventsBetween,
  sortDayTasks,
  useDayTasks,
  useEventsBetween,
  type DayTask,
} from '@/lib/queries'
import { taskAppearsOn } from '@/lib/recurrence'
import { useUI } from '@/store/ui'
import {
  Avatar,
  Button,
  EmptyState,
  LinkButton,
  Panel,
  Ring,
  Skeleton,
  Tag,
  cx,
} from '@/components/ui'
import { EventRow, TaskRow } from '@/components/rows'
import { ChipTabs, TabBar, useTab } from '@/components/Tabs'

const TABS = ['tasks', 'calendar', 'goals'] as const

export function Plan() {
  const [tab, setTab] = useTab(TABS, 'tasks')
  return (
    <div>
      <h1 className="mb-3 text-[26px] font-bold tracking-[-1px]">Plan</h1>
      <TabBar
        label="Plan"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'tasks', label: 'To-dos' },
          { value: 'calendar', label: 'Calendar' },
          { value: 'goals', label: 'Goals' },
        ]}
      />
      {tab === 'tasks' && <TasksTab />}
      {tab === 'calendar' && <CalendarTab />}
      {tab === 'goals' && <GoalsTab />}
    </div>
  )
}

/* ---------------- To-dos ---------------- */

type TaskView = 'today' | 'upcoming' | 'someday' | 'done'

function TasksTab() {
  const [view, setView] = useTab(['today', 'upcoming', 'someday', 'done'] as const, 'today', 'view')
  return (
    <>
      <ChipTabs<TaskView>
        label="Which to-dos"
        value={view}
        onChange={setView}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'upcoming', label: 'Next 2 weeks' },
          { value: 'someday', label: 'Someday' },
          { value: 'done', label: 'Done' },
        ]}
      />
      {view === 'today' && <TodayList />}
      {view === 'upcoming' && <UpcomingList />}
      {view === 'someday' && <SomedayList />}
      {view === 'done' && <DoneList />}
    </>
  )
}

function TodayList() {
  const today = useToday()
  const items = useDayTasks(today, { includeOverdue: true })
  if (!items)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  return (
    <Panel>
      {items.length === 0 ? (
        <EmptyState
          emoji="🌤️"
          title="Nothing for today"
          text="Enjoy the space, or tap + to add something small."
        />
      ) : (
        items.map((i) => <TaskRow key={i.task.id} item={i} />)
      )}
    </Panel>
  )
}

function UpcomingList() {
  const today = useToday()
  const groups = useLiveQuery(async () => {
    const [tasks, occ] = await Promise.all([
      db.tasks.filter((t) => t.status !== 'archived').toArray(),
      db.taskOccurrences
        .where('localDate')
        .between(addLocalDays(today, 1), addLocalDays(today, 14), true, true)
        .toArray(),
    ])
    const done = new Set(occ.map((o) => `${o.taskId}|${o.localDate}`))
    const out: { date: string; items: DayTask[] }[] = []
    for (let i = 1; i <= 14; i++) {
      const date = addLocalDays(today, i)
      const items = tasks
        .filter((t) => taskAppearsOn(t, date))
        .map((t) => ({
          task: t,
          date,
          overdue: false,
          done: t.recurrenceRule ? done.has(`${t.id}|${date}`) : t.status === 'done',
        }))
        .sort(sortDayTasks)
      if (items.length) out.push({ date, items })
    }
    return out
  }, [today])
  if (!groups)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  if (!groups.length)
    return (
      <Panel>
        <EmptyState emoji="🗓️" title="Nothing in the next two weeks" />
      </Panel>
    )
  return (
    <Panel>
      {groups.map((g) => (
        <div key={g.date} className="mb-3 last:mb-0">
          <div className="text-xs font-bold text-muted">
            {g.date === addLocalDays(today, 1) ? 'Tomorrow' : formatLocal(g.date, 'EEEE, d MMM')}
          </div>
          {g.items.map((i) => (
            <TaskRow key={i.task.id} item={i} />
          ))}
        </div>
      ))}
    </Panel>
  )
}

function SomedayList() {
  const today = useToday()
  const items = useLiveQuery(
    () => db.tasks.filter((t) => !t.dueDate && !t.recurrenceRule && t.status === 'open').toArray(),
    [],
  )
  if (!items)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  return (
    <Panel>
      {items.length === 0 ? (
        <EmptyState
          emoji="💭"
          title="No someday ideas yet"
          text="A home for things without a deadline."
        />
      ) : (
        items.map((t) => (
          <TaskRow key={t.id} item={{ task: t, date: today, done: false, overdue: false }} />
        ))
      )}
    </Panel>
  )
}

function DoneList() {
  const data = useLiveQuery(async () => {
    const tasks = await db.tasks.toArray()
    const byId = new Map(tasks.map((t) => [t.id, t]))
    const occ = (
      await db.taskOccurrences.orderBy('localDate').reverse().limit(40).toArray()
    ).filter((o) => byId.has(o.taskId))
    const items: DayTask[] = [
      ...tasks
        .filter((t) => t.status === 'done')
        .map((t) => ({
          task: t,
          date: t.completedAt ? toLocalDate(new Date(t.completedAt)) : (t.dueDate ?? ''),
          done: true,
          overdue: false,
        })),
      ...occ.map((o) => ({
        task: byId.get(o.taskId)!,
        date: o.localDate,
        done: true,
        overdue: false,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date))
    return { items: items.slice(0, 40), archived: tasks.filter((t) => t.status === 'archived') }
  }, [])
  if (!data)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  return (
    <Panel>
      {data.items.length === 0 ? (
        <EmptyState emoji="🌱" title="Finished to-dos will appear here" />
      ) : (
        data.items.map((i) => <TaskRow key={`${i.task.id}${i.date}`} item={i} />)
      )}
      {data.archived.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-bold text-muted">
            Archived ({data.archived.length})
          </summary>
          {data.archived.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 border-b border-line-soft py-2 last:border-0"
            >
              <span className="flex-1 truncate text-muted">{t.title}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveTask({ ...t, status: 'open', archivedAt: null })}
              >
                <RotateCcw size={14} /> Restore
              </Button>
            </div>
          ))}
        </details>
      )}
    </Panel>
  )
}

/* ---------------- Calendar ---------------- */

function CalendarTab() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const qd = params.get('date')
  const selected = qd && isLocalDate(qd) ? qd : today
  const select = (d: string) => {
    const next = new URLSearchParams(params)
    next.set('date', d)
    setParams(next, { replace: true })
  }
  const openSheet = useUI((s) => s.openSheet)
  const days = monthGrid(selected)
  const marks = useLiveQuery(async () => {
    const [tasks, events] = await Promise.all([
      db.tasks.filter((t) => t.status !== 'archived').toArray(),
      db.events.toArray(),
    ])
    const ev = eventsBetween(events, days[0], days[41])
    const map = new Map<string, { tasks: number; events: number }>()
    for (const d of days)
      map.set(d, {
        tasks: tasks.filter((t) => taskAppearsOn(t, d)).length,
        events: ev.filter((e) => e.occursOn === d).length,
      })
    return map
  }, [days[0]])
  const shift = (dir: number) => {
    const d = parseLocalDate(selected)
    select(toLocalDate(new Date(d.getFullYear(), d.getMonth() + dir, 1)))
  }

  return (
    <div className="grid gap-3">
      <Panel className="!p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shift(-1)}
            className="grid size-10 place-items-center rounded-xl hover:bg-surface2"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => select(today)}
            className="rounded-lg px-3 py-1.5 text-sm font-bold"
          >
            {formatLocal(selected, 'MMMM yyyy')}
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shift(1)}
            className="grid size-10 place-items-center rounded-xl hover:bg-surface2"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEK_ORDER.map((d) => (
            <div key={d} className="pb-1 text-[11px] font-semibold text-muted">
              {WEEKDAY_LETTER[d]}
            </div>
          ))}
          {days.map((d) => {
            const m = marks?.get(d)
            const isSel = d === selected
            return (
              <button
                key={d}
                type="button"
                onClick={() => select(d)}
                aria-pressed={isSel}
                aria-label={`${formatLocal(d, 'EEEE d MMMM')}${m?.events ? `, ${m.events} events` : ''}${m?.tasks ? `, ${m.tasks} to-dos` : ''}`}
                className={cx(
                  'grid aspect-square justify-items-center rounded-xl pt-1.5 text-[13px] transition',
                  isSel
                    ? 'bg-sage font-bold text-white'
                    : d === today
                      ? 'bg-sage-soft font-bold text-sage-ink'
                      : 'hover:bg-surface2',
                  !sameMonth(d, selected) && !isSel && 'text-muted/40',
                )}
              >
                {parseLocalDate(d).getDate()}
                <span className="flex h-1.5 gap-0.5">
                  {!!m?.events && (
                    <i
                      className={cx('size-1.5 rounded-full', isSel ? 'bg-white' : 'bg-[#d7a64a]')}
                    />
                  )}
                  {!!m?.tasks && (
                    <i className={cx('size-1.5 rounded-full', isSel ? 'bg-white/70' : 'bg-sage')} />
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </Panel>
      <DayAgenda date={selected} onAddEvent={() => openSheet({ type: 'event', date: selected })} />
    </div>
  )
}

function DayAgenda({ date, onAddEvent }: { date: string; onAddEvent: () => void }) {
  const today = useToday()
  const tasks = useDayTasks(date)
  const events = useEventsBetween(date, date)
  const openSheet = useUI((s) => s.openSheet)
  return (
    <Panel>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">
          {date === today ? 'Today' : formatLocal(date, 'EEEE d MMMM')}
        </h2>
        <div className="flex gap-1">
          <LinkButton onClick={onAddEvent}>+ Event</LinkButton>
          <LinkButton onClick={() => openSheet({ type: 'task', defaults: { dueDate: date } })}>
            + To-do
          </LinkButton>
        </div>
      </div>
      {!events?.length && !tasks?.length ? (
        <p className="py-3 text-center text-xs text-muted">🍃 Nothing planned — a free day.</p>
      ) : (
        <>
          {!!events?.length && (
            <div className="mb-2 grid gap-3">
              {events.map((e) => (
                <EventRow key={e.id} event={e} date={date} />
              ))}
            </div>
          )}
          {tasks?.map((t) => (
            <TaskRow key={t.task.id} item={t} />
          ))}
        </>
      )}
    </Panel>
  )
}

/* ---------------- Goals ---------------- */

function GoalsTab() {
  const [horizon, setHorizon] = useState<GoalHorizon>('month')
  const openSheet = useUI((s) => s.openSheet)
  const data = useLiveQuery(
    async () => ({
      goals: await db.goals.toArray(),
      tasks: await db.tasks.filter((t) => !!t.goalId).toArray(),
    }),
    [],
  )
  const goals =
    data?.goals.filter(
      (g) => g.horizon === horizon && (g.status === 'active' || g.status === 'paused'),
    ) ?? []
  const finished = data?.goals.filter((g) => g.status === 'achieved') ?? []
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <ChipTabs<GoalHorizon>
          label="Plan horizon"
          value={horizon}
          onChange={setHorizon}
          options={[
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
            { value: 'long', label: 'Long-term' },
          ]}
        />
      </div>
      <div className="grid gap-3">
        {goals.length === 0 && (
          <Panel>
            <EmptyState
              emoji="🎯"
              title="No goals here yet"
              text="One gentle goal is plenty — like “Family walk every weekend”."
            />
          </Panel>
        )}
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            tasks={data?.tasks.filter((t) => t.goalId === g.id) ?? []}
          />
        ))}
        <Button variant="soft" onClick={() => openSheet({ type: 'goal' })}>
          + New goal
        </Button>
        {finished.length > 0 && (
          <p className="text-center text-xs text-muted">
            🎉 {finished.length} goal{finished.length > 1 ? 's' : ''} achieved so far
          </p>
        )}
        <p className="text-center text-[11px] text-muted">
          Progress = finished one-off steps ÷ all one-off steps. Repeating to-dos support a goal but
          aren't counted.
        </p>
      </div>
    </>
  )
}

function GoalCard({ goal, tasks }: { goal: Goal; tasks: Task[] }) {
  const today = useToday()
  const openSheet = useUI((s) => s.openSheet)
  const owner = useProfileMap().get(goal.profileId ?? '')
  const p = goalProgress(tasks)
  const [open, setOpen] = useState(false)
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <Ring value={p.ratio} size={52}>
          {p.total ? `${Math.round(p.ratio * 100)}%` : (goal.emoji ?? '🎯')}
        </Ring>
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <div className="truncate text-sm font-bold">
            {goal.emoji} {goal.title}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            {owner && <Avatar avatar={owner.avatar} color={owner.color} size={16} />}
            {p.done}/{p.total} steps
            {goal.targetDate ? ` · by ${formatLocal(goal.targetDate, 'd MMM')}` : ''}
            {goal.status === 'paused' && <Tag tone="muted">Paused</Tag>}
          </div>
        </button>
        <LinkButton onClick={() => openSheet({ type: 'goal', goal })}>Edit</LinkButton>
      </div>
      {open && (
        <div className="mt-2">
          {tasks
            .filter((t) => t.status !== 'archived')
            .map((t) => (
              <TaskRow
                key={t.id}
                item={{
                  task: t,
                  date: t.dueDate ?? today,
                  done: t.status === 'done',
                  overdue: false,
                }}
                showDate
              />
            ))}
          <LinkButton
            className="mt-2"
            onClick={() =>
              openSheet({ type: 'task', defaults: { goalId: goal.id, dueDate: null } })
            }
          >
            + Add a step
          </LinkButton>
        </div>
      )}
    </Panel>
  )
}
