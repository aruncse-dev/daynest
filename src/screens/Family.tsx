import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus } from 'lucide-react'
import { db } from '@/db/db'
import type { Profile } from '@/db/types'
import { isDueOn } from '@/lib/habits'
import { useProfiles, useToday } from '@/lib/hooks'
import { useDayTasks } from '@/lib/queries'
import { useUI } from '@/store/ui'
import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  Panel,
  ProgressBar,
} from '@/components/ui'
import { HabitRow, TaskRow } from '@/components/rows'

export function Family() {
  const profiles = useProfiles()
  const openSheet = useUI((s) => s.openSheet)
  return (
    <div>
      <PageHeader
        eyebrow="Family"
        title="Your little nest"
        sub="Everyone's day at a glance — encouraging, never a scoreboard."
        action={
          <Button onClick={() => openSheet({ type: 'profile' })}>
            <Plus size={16} /> Add member
          </Button>
        }
      />
      <div className="grid items-start gap-4 md:grid-cols-2 stagger">
        {profiles?.map((p) => (
          <MemberCard key={p.id} profile={p} />
        ))}
      </div>
      <SharedToday />
      <p className="mt-6 text-center text-[11px] text-muted">
        Profiles are stored only on this device and are not synced or shared online.
      </p>
    </div>
  )
}

function MemberCard({ profile }: { profile: Profile }) {
  const today = useToday()
  const openSheet = useUI((s) => s.openSheet)
  const tasks = useDayTasks(today, { profileId: profile.id, includeOverdue: true })
  const habits = useLiveQuery(async () => {
    const [hs, es] = await Promise.all([
      db.habits.where('profileId').equals(profile.id).toArray(),
      db.habitEntries.where('localDate').equals(today).toArray(),
    ])
    const done = new Set(es.map((e) => e.habitId))
    return hs.filter((h) => isDueOn(h, today)).map((habit) => ({ habit, done: done.has(habit.id) }))
  }, [profile.id, today])
  const total = (tasks?.length ?? 0) + (habits?.length ?? 0)
  const done =
    (tasks?.filter((t) => t.done).length ?? 0) + (habits?.filter((h) => h.done).length ?? 0)
  return (
    <Panel>
      <div className="mb-3 flex items-center gap-3">
        <Avatar avatar={profile.avatar} color={profile.color} size={46} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold">
            {profile.name}
            {profile.isPrimary && (
              <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>
            )}
          </h2>
          <div className="text-xs text-muted">
            {profile.role ?? 'Family'} · {total ? `${done} of ${total} things today` : 'A free day'}
          </div>
        </div>
        <IconButton
          label={`Edit ${profile.name}`}
          onClick={() => openSheet({ type: 'profile', profile })}
        >
          <Pencil size={15} />
        </IconButton>
      </div>
      {total > 0 && <ProgressBar value={done / total} className="mb-3" />}
      {habits && habits.length > 0 && (
        <div className="mb-2 grid gap-3">
          {habits.map((h) => (
            <HabitRow key={h.habit.id} habit={h.habit} done={h.done} />
          ))}
        </div>
      )}
      {tasks?.map((t) => (
        <TaskRow key={t.task.id} item={t} />
      ))}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="soft"
          onClick={() => openSheet({ type: 'task', defaults: { profileId: profile.id } })}
        >
          + Task
        </Button>
        <Button size="sm" variant="outline" onClick={() => openSheet({ type: 'habit' })}>
          + Habit
        </Button>
      </div>
    </Panel>
  )
}

function SharedToday() {
  const today = useToday()
  const items = useDayTasks(today)
  const shared = items?.filter((t) => !t.task.profileId)
  return (
    <Panel className="mt-4">
      <h2 className="mb-1 text-base font-bold">Shared family tasks</h2>
      <p className="mb-2 text-xs text-muted">Unassigned tasks anyone can pick up.</p>
      {shared?.length ? (
        shared.map((t) => <TaskRow key={t.task.id} item={t} />)
      ) : (
        <EmptyState emoji="🏡" title="Nothing shared today" />
      )}
    </Panel>
  )
}
