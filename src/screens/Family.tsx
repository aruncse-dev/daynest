import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Pencil, Plus } from 'lucide-react'
import { db } from '@/db/db'
import type { Profile } from '@/db/types'
import { isDueOn } from '@/lib/habits'
import { useMembers, useToday } from '@/lib/hooks'
import { useDayTasks } from '@/lib/queries'
import { useUI } from '@/store/ui'
import { Avatar, Button, LinkButton, Panel, Ring, cx } from '@/components/ui'
import { HabitRow, TaskRow } from '@/components/rows'
import { useTab } from '@/components/Tabs'

/** Family members managed on this one phone. Nothing is shared or synced. */
export function Family() {
  const members = useMembers()
  const openSheet = useUI((s) => s.openSheet)
  const ids = members.map((p) => p.id)
  const [open, setOpen] = useTab([...ids, 'none'], ids[0] ?? 'none', 'member')
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold tracking-[-0.8px]">Family</h1>
        <Button size="sm" variant="soft" onClick={() => openSheet({ type: 'profile' })}>
          <Plus size={15} /> Add
        </Button>
      </div>
      {members.length === 0 ? (
        <Panel>
          <div className="py-4 text-center">
            <div className="text-3xl">🏡</div>
            <div className="mt-1 text-sm font-bold">Add your family</div>
            <p className="mx-auto max-w-xs text-xs text-muted">
              Keep their to-dos, habits and reminders here too, like a child's reading time or
              homework. Everything stays on this phone.
            </p>
            <Button size="sm" className="mt-3" onClick={() => openSheet({ type: 'profile' })}>
              + Add family member
            </Button>
          </div>
        </Panel>
      ) : (
        members.map((p) => (
          <MemberCard
            key={p.id}
            profile={p}
            open={open === p.id}
            onToggle={() => setOpen(open === p.id ? 'none' : p.id)}
          />
        ))
      )}
      <p className="px-1 text-center text-[11px] text-muted">
        Family members live only on this phone. Nothing is shared.
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
          <div className="truncate text-sm font-bold">{profile.name}</div>
          <div className="text-xs text-muted">
            {total
              ? `${done} of ${total} today${done === total ? ' — superstar! ⭐' : ''}`
              : 'Free day 🌼'}
          </div>
        </div>
        {total > 0 && <Ring value={done / total} size={36} stroke={4} />}
        <ChevronDown
          size={18}
          className={cx('text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="border-t border-line-soft px-3.5 pb-3.5 pt-2.5 animate-fade">
          {total === 0 && (
            <p className="pb-2 text-xs text-muted">Nothing planned for {profile.name} today.</p>
          )}
          {habits && habits.length > 0 && (
            <div className="mb-2 grid gap-2.5">
              {habits.map((h) => (
                <HabitRow key={h.habit.id} habit={h.habit} done={h.done} />
              ))}
            </div>
          )}
          {tasks?.map((t) => (
            <TaskRow key={t.task.id} item={t} />
          ))}
          <div className="mt-2 flex flex-wrap gap-1">
            <LinkButton
              onClick={() => openSheet({ type: 'task', defaults: { profileId: profile.id } })}
            >
              + To-do
            </LinkButton>
            <LinkButton
              onClick={() => openSheet({ type: 'habit', defaults: { profileId: profile.id } })}
            >
              + Habit
            </LinkButton>
            <LinkButton onClick={() => openSheet({ type: 'profile', profile })}>
              <Pencil size={12} className="mr-1 inline" />
              Edit
            </LinkButton>
          </div>
        </div>
      )}
    </Panel>
  )
}
