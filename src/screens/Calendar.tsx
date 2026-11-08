import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '@/db/db'
import {
  addLocalDays,
  formatLocal,
  isLocalDate,
  monthGrid,
  parseLocalDate,
  sameMonth,
  toLocalDate,
  weekOf,
  WEEKDAY_LETTER,
  WEEK_ORDER,
} from '@/lib/date'
import { useToday } from '@/lib/hooks'
import { eventsBetween, useDayTasks, useEventsBetween, useHabitsForDay } from '@/lib/queries'
import { taskAppearsOn } from '@/lib/recurrence'
import { useUI } from '@/store/ui'
import { Button, EmptyState, PageHeader, Panel, Segmented, cx } from '@/components/ui'
import { EventRow, TaskRow } from '@/components/rows'

type View = 'month' | 'week' | 'agenda'

export function Calendar() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const qd = params.get('date')
  const selected = qd && isLocalDate(qd) ? qd : today
  const select = (d: string) => setParams({ date: d }, { replace: true })
  const [view, setView] = useState<View>('month')
  const openSheet = useUI((s) => s.openSheet)

  const days = view === 'month' ? monthGrid(selected) : weekOf(selected)
  const marks = useLiveQuery(async () => {
    const [tasks, events] = await Promise.all([
      db.tasks.filter((t) => t.status !== 'archived').toArray(),
      db.events.toArray(),
    ])
    const ev = eventsBetween(events, days[0], days[days.length - 1])
    const map = new Map<string, { tasks: number; events: number }>()
    for (const d of days)
      map.set(d, {
        tasks: tasks.filter((t) => taskAppearsOn(t, d)).length,
        events: ev.filter((e) => e.occursOn === d).length,
      })
    return map
  }, [days[0], days.length])

  const shift = (dir: number) => {
    if (view === 'month') {
      const d = parseLocalDate(selected)
      select(toLocalDate(new Date(d.getFullYear(), d.getMonth() + dir, 1)))
    } else select(addLocalDays(selected, dir * 7))
  }

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title={formatLocal(selected, 'MMMM yyyy')}
        sub="Tasks, events and the dates that matter."
        action={
          <Button onClick={() => openSheet({ type: 'event', date: selected })}>+ New event</Button>
        }
      />
      <div className="mb-4">
        <Segmented
          label="Calendar view"
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'agenda', label: 'Agenda' },
          ]}
        />
      </div>

      {view === 'agenda' ? (
        <Agenda from={today} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Panel>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous"
                onClick={() => shift(-1)}
                className="grid size-10 place-items-center rounded-xl hover:bg-surface2"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => select(today)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-sage-ink hover:bg-sage-soft"
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => shift(1)}
                className="grid size-10 place-items-center rounded-xl hover:bg-surface2"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEK_ORDER.map((d) => (
                <div key={d} className="pb-1 text-[11px] font-semibold text-muted">
                  {WEEKDAY_LETTER[d]}
                </div>
              ))}
              {days.map((d) => {
                const m = marks?.get(d)
                const isSel = d === selected
                const inMonth = view === 'week' || sameMonth(d, selected)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => select(d)}
                    aria-label={`${formatLocal(d, 'EEEE d MMMM')}${m?.events ? `, ${m.events} events` : ''}${m?.tasks ? `, ${m.tasks} tasks` : ''}`}
                    aria-pressed={isSel}
                    className={cx(
                      'relative grid justify-items-center rounded-xl py-1.5 text-[13px] transition',
                      view === 'week' ? 'min-h-16' : 'aspect-square sm:aspect-auto sm:min-h-14',
                      isSel
                        ? 'bg-sage font-bold text-white shadow-[0_6px_14px_#47765b40]'
                        : d === today
                          ? 'bg-sage-soft font-bold text-sage-ink'
                          : 'hover:bg-surface2',
                      !inMonth && !isSel && 'text-muted/50',
                    )}
                  >
                    {parseLocalDate(d).getDate()}
                    <span className="flex h-1.5 gap-0.5">
                      {!!m?.events && (
                        <i
                          className={cx(
                            'size-1.5 rounded-full',
                            isSel ? 'bg-white' : 'bg-[#d7a64a]',
                          )}
                        />
                      )}
                      {!!m?.tasks && (
                        <i
                          className={cx('size-1.5 rounded-full', isSel ? 'bg-white/70' : 'bg-sage')}
                        />
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <i className="size-1.5 rounded-full bg-[#d7a64a]" /> Events & dates
              </span>
              <span className="flex items-center gap-1">
                <i className="size-1.5 rounded-full bg-sage" /> Tasks
              </span>
            </div>
          </Panel>
          <DayAgenda date={selected} />
        </div>
      )}
    </div>
  )
}

function DayAgenda({ date }: { date: string }) {
  const today = useToday()
  const tasks = useDayTasks(date, { includeOverdue: date === today })
  const events = useEventsBetween(date, date)
  const habits = useHabitsForDay(date)
  const openSheet = useUI((s) => s.openSheet)
  const empty = tasks?.length === 0 && events?.length === 0
  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">
            {date === today ? 'Today' : formatLocal(date, 'EEEE')}
          </h2>
          <div className="text-xs text-muted">{formatLocal(date, 'd MMMM yyyy')}</div>
        </div>
        <Button
          size="sm"
          variant="soft"
          onClick={() => openSheet({ type: 'task', defaults: { dueDate: date } })}
        >
          + Task
        </Button>
      </div>
      {empty ? (
        <EmptyState emoji="🍃" title="A free day" text="Nothing scheduled." />
      ) : (
        <>
          {!!events?.length && (
            <div className="mb-3 grid gap-3">
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
      {!!habits?.length && (
        <div className="mt-4 rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">
          Habits: {habits.filter((h) => h.done).length}/{habits.length} done{' '}
          {habits.map((h) => (h.done ? h.habit.emoji : '')).join('')}
        </div>
      )}
    </Panel>
  )
}

function Agenda({ from }: { from: string }) {
  const to = addLocalDays(from, 30)
  const events = useEventsBetween(from, to)
  const tasks = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) =>
            t.status === 'open' &&
            !t.recurrenceRule &&
            !!t.dueDate &&
            t.dueDate >= from &&
            t.dueDate <= to,
        )
        .toArray(),
    [from, to],
  )
  if (!events || !tasks) return null
  const byDay = new Map<string, { events: typeof events; tasks: typeof tasks }>()
  for (const e of events) {
    const g = byDay.get(e.occursOn) ?? { events: [], tasks: [] }
    g.events.push(e)
    byDay.set(e.occursOn, g)
  }
  for (const t of tasks) {
    const g = byDay.get(t.dueDate!) ?? { events: [], tasks: [] }
    g.tasks.push(t)
    byDay.set(t.dueDate!, g)
  }
  const keys = [...byDay.keys()].sort()
  if (!keys.length)
    return (
      <Panel>
        <EmptyState emoji="🗓️" title="Nothing in the next 30 days" />
      </Panel>
    )
  return (
    <div className="grid gap-3">
      {keys.map((d) => (
        <Panel key={d}>
          <div className="mb-2 text-xs font-bold text-muted">
            {d === from ? 'Today' : formatLocal(d, 'EEEE, d MMMM')}
          </div>
          <div className="grid gap-3">
            {byDay.get(d)!.events.map((e) => (
              <EventRow key={e.id} event={e} date={d} />
            ))}
          </div>
          {byDay.get(d)!.tasks.map((t) => (
            <TaskRow key={t.id} item={{ task: t, date: d, done: false, overdue: false }} />
          ))}
        </Panel>
      ))}
    </div>
  )
}
