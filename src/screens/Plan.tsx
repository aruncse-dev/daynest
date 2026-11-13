import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { db } from '@/db/db'
import { saveTask } from '@/db/actions'
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
import { usePerson, useToday } from '@/lib/hooks'
import { isFor } from '@/lib/people'
import { PersonBar } from '@/components/PersonBar'
import {
  eventsBetween,
  sortDayTasks,
  useDayTasks,
  useEventsBetween,
  type DayTask,
} from '@/lib/queries'
import { taskAppearsOn } from '@/lib/recurrence'
import { useUI } from '@/store/ui'
import { Button, EmptyState, LinkButton, Panel, Skeleton, cx } from '@/components/ui'
import { EventRow, TaskRow } from '@/components/rows'
import { TabBar, useTab } from '@/components/Tabs'

const TABS = ['tasks', 'calendar'] as const

export function Plan() {
  const [tab, setTab] = useTab(TABS, 'tasks')
  return (
    <div>
      <h1 className="mb-2 text-[24px] font-bold tracking-[-0.8px]">To-dos</h1>
      <PersonBar className="mb-3" />
      <TabBar
        label="Plan"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'tasks', label: 'List' },
          { value: 'calendar', label: 'Calendar' },
        ]}
      />
      {tab === 'tasks' && <TasksTab />}
      {tab === 'calendar' && <CalendarTab />}
    </div>
  )
}

/* ---------------- To-dos ---------------- */

/** One scrollable list: the next two weeks, then someday ideas, with finished ones tucked away. */
function TasksTab() {
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Today</h2>
        <TodayList />
      </div>
      <div>
        <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          Next 2 weeks
        </h2>
        <UpcomingList />
      </div>
      <div>
        <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          Someday
        </h2>
        <SomedayList />
      </div>
      <details className="rounded-[18px] border border-line bg-surface px-3.5 py-2.5">
        <summary className="cursor-pointer text-xs font-bold text-muted">Done recently</summary>
        <div className="mt-2">
          <DoneList />
        </div>
      </details>
    </div>
  )
}

/** Every to-do for today (yours and the family's), including ones carried over from earlier days. */
function TodayList() {
  const today = useToday()
  const openSheet = useUI((s) => s.openSheet)
  const { person } = usePerson()
  const items = useDayTasks(today, { includeOverdue: true, person })
  if (!items)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  return (
    <Panel>
      {items.length === 0 ? (
        <div className="py-2 text-center text-xs text-muted">
          Nothing for today.{' '}
          <button
            type="button"
            className="font-bold text-sage-ink"
            onClick={() => openSheet({ type: 'quickAdd' })}
          >
            + Add a to-do
          </button>
        </div>
      ) : (
        items.map((i) => <TaskRow key={i.task.id} item={i} hideOwner={person} />)
      )}
    </Panel>
  )
}

function UpcomingList() {
  const today = useToday()
  const { person } = usePerson()
  const groups = useLiveQuery(async () => {
    const [tasks, occ] = await Promise.all([
      db.tasks.filter((t) => t.status !== 'archived' && isFor(t, person)).toArray(),
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
  }, [today, person])
  if (!groups)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  if (!groups.length)
    return (
      <Panel>
        <p className="py-2 text-center text-xs text-muted">
          Nothing planned for the next two weeks.
        </p>
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
            <TaskRow key={i.task.id} item={i} hideOwner={person} />
          ))}
        </div>
      ))}
    </Panel>
  )
}

function SomedayList() {
  const today = useToday()
  const { person } = usePerson()
  const items = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) => !t.dueDate && !t.recurrenceRule && t.status === 'open' && isFor(t, person),
        )
        .toArray(),
    [person],
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
        <p className="py-2 text-center text-xs text-muted">
          Ideas without a deadline go here. Add one with + and leave the date empty.
        </p>
      ) : (
        items.map((t) => (
          <TaskRow
            key={t.id}
            item={{ task: t, date: today, done: false, overdue: false }}
            hideOwner={person}
          />
        ))
      )}
    </Panel>
  )
}

function DoneList() {
  const { person } = usePerson()
  const data = useLiveQuery(async () => {
    const tasks = (await db.tasks.toArray()).filter((t) => isFor(t, person))
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
  }, [person])
  if (!data)
    return (
      <div>
        <Skeleton />
      </div>
    )
  return (
    <div>
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
    </div>
  )
}

/* ---------------- Calendar ---------------- */

function CalendarTab() {
  const { person } = usePerson()
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
      db.tasks.filter((t) => t.status !== 'archived' && isFor(t, person)).toArray(),
      db.events.filter((e) => isFor(e, person)).toArray(),
    ])
    const ev = eventsBetween(events, days[0], days[41])
    const map = new Map<string, { tasks: number; events: number }>()
    for (const d of days)
      map.set(d, {
        tasks: tasks.filter((t) => taskAppearsOn(t, d)).length,
        events: ev.filter((e) => e.occursOn === d).length,
      })
    return map
  }, [days[0], person])
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
  const { person } = usePerson()
  const tasks = useDayTasks(date, { person })
  const events = useEventsBetween(date, date)?.filter((e) => isFor(e, person))
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
                <EventRow key={e.id} event={e} date={date} hideOwner={person} />
              ))}
            </div>
          )}
          {tasks?.map((t) => (
            <TaskRow key={t.task.id} item={t} hideOwner={person} />
          ))}
        </>
      )}
    </Panel>
  )
}
