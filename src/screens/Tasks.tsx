import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { RotateCcw } from 'lucide-react'
import { db } from '@/db/db'
import { saveTask } from '@/db/actions'
import { addLocalDays, formatLocal, toLocalDate } from '@/lib/date'
import { useProfiles, useToday } from '@/lib/hooks'
import { sortDayTasks, useDayTasks, type DayTask } from '@/lib/queries'
import { taskAppearsOn } from '@/lib/recurrence'
import { useUI } from '@/store/ui'
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  PageHeader,
  Panel,
  Segmented,
  Skeleton,
} from '@/components/ui'
import { TaskRow } from '@/components/rows'

type View = 'today' | 'upcoming' | 'someday' | 'completed'

export function ProfileFilter() {
  const profiles = useProfiles() ?? []
  const filter = useUI((s) => s.profileFilter)
  const set = useUI((s) => s.setProfileFilter)
  if (profiles.length < 2) return null
  return (
    <div
      className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar"
      role="group"
      aria-label="Filter by family member"
    >
      <Chip active={filter === 'all'} onClick={() => set('all')}>
        👪 Everyone
      </Chip>
      {profiles.map((p) => (
        <Chip key={p.id} active={filter === p.id} onClick={() => set(p.id)}>
          <Avatar avatar={p.avatar} color={p.color} size={20} /> {p.name}
        </Chip>
      ))}
    </div>
  )
}

export function Tasks() {
  const [view, setView] = useState<View>('today')
  const openSheet = useUI((s) => s.openSheet)
  return (
    <div>
      <PageHeader
        eyebrow="Tasks"
        title="What needs doing"
        sub="Pick a few. Let the rest wait kindly."
        action={<Button onClick={() => openSheet({ type: 'task' })}>+ New task</Button>}
      />
      <ProfileFilter />
      <div className="mb-4">
        <Segmented
          label="Task view"
          value={view}
          onChange={setView}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'someday', label: 'Someday' },
            { value: 'completed', label: 'Completed' },
          ]}
        />
      </div>
      {view === 'today' && <TodayList />}
      {view === 'upcoming' && <UpcomingList />}
      {view === 'someday' && <SomedayList />}
      {view === 'completed' && <CompletedList />}
    </div>
  )
}

function TodayList() {
  const today = useToday()
  const filter = useUI((s) => s.profileFilter)
  const items = useDayTasks(today, { includeOverdue: true, profileId: filter })
  if (!items)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  const overdue = items.filter((i) => i.overdue)
  const rest = items.filter((i) => !i.overdue)
  return (
    <div className="grid gap-4">
      {overdue.length > 0 && (
        <Panel>
          <div className="mb-2 text-xs font-semibold text-amber-ink">
            Still open from earlier — no rush, just a nudge
          </div>
          {overdue.map((i) => (
            <TaskRow key={i.task.id} item={i} />
          ))}
        </Panel>
      )}
      <Panel>
        {rest.length === 0 ? (
          <EmptyState
            emoji="🌤️"
            title="Nothing for today"
            text="Enjoy the space, or add something small."
          />
        ) : (
          rest.map((i) => <TaskRow key={i.task.id} item={i} />)
        )}
      </Panel>
    </div>
  )
}

function UpcomingList() {
  const today = useToday()
  const filter = useUI((s) => s.profileFilter)
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
        .filter((t) => (filter === 'all' || t.profileId === filter) && taskAppearsOn(t, date))
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
  }, [today, filter])
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
    <div className="grid gap-4">
      {groups.map((g) => (
        <Panel key={g.date}>
          <div className="mb-1 text-xs font-bold text-muted">
            {g.date === addLocalDays(today, 1) ? 'Tomorrow' : formatLocal(g.date, 'EEEE, d MMMM')}
          </div>
          {g.items.map((i) => (
            <TaskRow key={i.task.id} item={i} />
          ))}
        </Panel>
      ))}
    </div>
  )
}

function SomedayList() {
  const today = useToday()
  const filter = useUI((s) => s.profileFilter)
  const items = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) =>
            !t.dueDate &&
            !t.recurrenceRule &&
            t.status === 'open' &&
            (filter === 'all' || t.profileId === filter),
        )
        .toArray(),
    [filter],
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
          text="A home for things you'd like to do, without a deadline."
        />
      ) : (
        items.map((t) => (
          <TaskRow key={t.id} item={{ task: t, date: today, done: false, overdue: false }} />
        ))
      )}
    </Panel>
  )
}

function CompletedList() {
  const filter = useUI((s) => s.profileFilter)
  const data = useLiveQuery(async () => {
    const tasks = await db.tasks.toArray()
    const byId = new Map(tasks.map((t) => [t.id, t]))
    const match = (pid?: string | null) => filter === 'all' || pid === filter
    const oneOff = tasks.filter((t) => t.status === 'done' && match(t.profileId))
    const occ = (
      await db.taskOccurrences.orderBy('localDate').reverse().limit(60).toArray()
    ).filter((o) => byId.has(o.taskId) && match(byId.get(o.taskId)!.profileId))
    const archived = tasks.filter((t) => t.status === 'archived' && match(t.profileId))
    const items: DayTask[] = [
      ...oneOff.map((t) => ({
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
    return { items, archived }
  }, [filter])
  if (!data)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  return (
    <div className="grid gap-4">
      <Panel>
        {data.items.length === 0 ? (
          <EmptyState emoji="🌱" title="Completed tasks will appear here" />
        ) : (
          data.items.slice(0, 60).map((i) => <TaskRow key={`${i.task.id}${i.date}`} item={i} />)
        )}
      </Panel>
      {data.archived.length > 0 && (
        <Panel>
          <div className="mb-2 text-xs font-bold text-muted">Archived</div>
          {data.archived.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 border-b border-line-soft py-2 last:border-0"
            >
              <span className="flex-1 truncate text-sm text-muted">{t.title}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveTask({ ...t, status: 'open', archivedAt: null })}
              >
                <RotateCcw size={14} /> Restore
              </Button>
            </div>
          ))}
        </Panel>
      )}
    </div>
  )
}
