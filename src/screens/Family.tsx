import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Pencil, Plus } from 'lucide-react'
import { db } from '@/db/db'
import type { Profile } from '@/db/types'
import { isDueOn } from '@/lib/habits'
import { useProfiles, useToday } from '@/lib/hooks'
import { useDayTasks } from '@/lib/queries'
import { useUI } from '@/store/ui'
import { Avatar, Button, EmptyState, LinkButton, Panel, Ring, cx } from '@/components/ui'
import { HabitRow, TaskRow } from '@/components/rows'
import { useTab } from '@/components/Tabs'

export function Family() {
  const profiles = useProfiles()
  const openSheet = useUI((s) => s.openSheet)
  const ids = (profiles ?? []).map((p) => p.id)
  const [open, setOpen] = useTab([...ids, 'shared', 'none'], ids[0] ?? 'none', 'member')
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-[26px] font-bold tracking-[-1px]">Family</h1>
        <Button size="sm" variant="soft" onClick={() => openSheet({ type: 'profile' })}>
          <Plus size={15} /> Add member
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted">
        Everyone's day at a glance — little wins, never a scoreboard. Tap a person to see their day.
      </p>
      <div className="grid gap-2">
        {profiles?.map((p) => (
          <MemberCard
            key={p.id}
            profile={p}
            open={open === p.id}
            onToggle={() => setOpen(open === p.id ? 'none' : p.id)}
          />
        ))}
        <SharedCard
          open={open === 'shared'}
          onToggle={() => setOpen(open === 'shared' ? 'none' : 'shared')}
        />
      </div>
      <p className="mt-4 text-center text-[11px] text-muted">
        Profiles are stored only on this phone and are not shared online.
      </p>
    </div>
  )
}

function MemberCard({
  profile,
  open,
  onToggle,
}: {
  profile: Profile
  open: boolean
  onToggle: () => void
}) {
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
    <Panel className="!p-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <Avatar avatar={profile.avatar} color={profile.color} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">
            {profile.name}
            {profile.isPrimary && (
              <span className="ml-1 text-xs font-normal text-muted">(you)</span>
            )}
          </div>
          <div className="text-xs text-muted">
            {total
              ? `${done} of ${total} today${done === total ? ' — superstar! ⭐' : ''}`
              : 'Free day 🌼'}
          </div>
        </div>
        {total > 0 && <Ring value={done / total} size={38} stroke={4} />}
        <ChevronDown
          size={18}
          className={cx('text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="border-t border-line-soft px-4 pb-4 pt-3 animate-fade">
          {total === 0 && (
            <p className="pb-2 text-xs text-muted">Nothing planned for {profile.name} today.</p>
          )}
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
          <div className="mt-3 flex flex-wrap gap-1">
            <LinkButton
              onClick={() => openSheet({ type: 'task', defaults: { profileId: profile.id } })}
            >
              + To-do
            </LinkButton>
            <LinkButton onClick={() => openSheet({ type: 'habit' })}>+ Habit</LinkButton>
            <LinkButton onClick={() => openSheet({ type: 'profile', profile })}>
              <Pencil size={12} className="mr-1 inline" />
              Edit profile
            </LinkButton>
          </div>
        </div>
      )}
    </Panel>
  )
}

function SharedCard({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const today = useToday()
  const items = useDayTasks(today)
  const shared = items?.filter((t) => !t.task.profileId) ?? []
  return (
    <Panel className="!p-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <span className="grid size-11 place-items-center rounded-full bg-amber-soft text-xl">
          🏡
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Shared family to-dos</div>
          <div className="text-xs text-muted">
            {shared.length
              ? `${shared.filter((s) => s.done).length} of ${shared.length} done — anyone can help`
              : 'Nothing shared today'}
          </div>
        </div>
        <ChevronDown
          size={18}
          className={cx('text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="border-t border-line-soft px-4 pb-4 pt-2">
          {shared.length ? (
            shared.map((t) => <TaskRow key={t.task.id} item={t} />)
          ) : (
            <EmptyState emoji="🏡" title="Nothing shared today" />
          )}
        </div>
      )}
    </Panel>
  )
}
