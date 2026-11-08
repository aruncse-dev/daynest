import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Pencil } from 'lucide-react'
import { db } from '@/db/db'
import type { Profile } from '@/db/types'
import { addLocalDays, todayLocal } from '@/lib/date'
import { FAMILY_IDEAS, ROLES, roleLabel, roleOf, type FamilyIdea } from '@/lib/family'
import { isDueOn } from '@/lib/habits'
import { useMembers, useToday } from '@/lib/hooks'
import { useDayTasks, useEventsBetween } from '@/lib/queries'
import { useUI } from '@/store/ui'
import { Avatar, LinkButton, Panel, Ring, cx } from '@/components/ui'
import { EventRow, HabitRow, TaskRow } from '@/components/rows'
import { useTab } from '@/components/Tabs'

/**
 * Keep track of your spouse's, kids' and parents' routines and activities on this one phone.
 * Nothing is shared or synced; reminders for them ring on this phone.
 */
export function Family() {
  const members = useMembers()
  const openSheet = useUI((s) => s.openSheet)
  const ids = members.map((p) => p.id)
  const [open, setOpen] = useTab([...ids, 'none'], ids[0] ?? 'none', 'member')

  return (
    <div className="grid gap-3">
      <h1 className="text-[24px] font-bold tracking-[-0.8px]">Family</h1>

      {members.length === 0 && (
        <Panel>
          <div className="text-center">
            <div className="text-3xl">🏡</div>
            <div className="mt-1 text-sm font-bold">Keep track of your family's day</div>
            <p className="mx-auto max-w-xs text-xs text-muted">
              Kids' homework and classes, a parent's medicine and appointments, time with your
              spouse, with reminders on this phone.
            </p>
          </div>
        </Panel>
      )}

      {members.map((p) => (
        <MemberCard
          key={p.id}
          profile={p}
          open={open === p.id}
          onToggle={() => setOpen(open === p.id ? 'none' : p.id)}
        />
      ))}

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Add a family member">
        {ROLES.filter((r) => r.value !== 'other').map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => openSheet({ type: 'profile', role: r.value })}
            className="grid justify-items-center gap-1 rounded-[16px] border border-dashed border-sage-line bg-surface/70 px-2 py-3 text-xs font-semibold text-sage-ink transition active:scale-95"
          >
            <span className="text-2xl">{r.avatar}</span>+{' '}
            {r.value === 'spouse' ? 'Spouse' : r.label}
          </button>
        ))}
      </div>
      <LinkButton
        className="justify-self-center"
        onClick={() => openSheet({ type: 'profile', role: 'other' })}
      >
        + Someone else
      </LinkButton>

      <FamilyUpcoming />
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
  const existingTitles = useLiveQuery(async () => {
    const [hs, ts, evs] = await Promise.all([
      db.habits.where('profileId').equals(profile.id).toArray(),
      db.tasks.where('profileId').equals(profile.id).toArray(),
      db.events.where('profileId').equals(profile.id).toArray(),
    ])
    return new Set(
      [...hs, ...ts, ...evs]
        .filter((x) => !('status' in x) || x.status !== 'archived')
        .map((x) => x.title),
    )
  }, [profile.id])
  const total = (tasks?.length ?? 0) + (habits?.length ?? 0)
  const done =
    (tasks?.filter((t) => t.done).length ?? 0) + (habits?.filter((h) => h.done).length ?? 0)
  const ideas = FAMILY_IDEAS[roleOf(profile)].filter((i) => !existingTitles?.has(i.title))

  const startIdea = (idea: FamilyIdea) => {
    if (idea.kind === 'habit') {
      openSheet({
        type: 'habit',
        defaults: {
          title: idea.title,
          emoji: idea.emoji,
          scheduleDays: idea.days ?? [],
          profileId: profile.id,
        },
        remindTimes: idea.remind,
      })
    } else if (idea.kind === 'task') {
      openSheet({
        type: 'task',
        defaults: {
          title: idea.title,
          dueDate: todayLocal(),
          dueTime: idea.time,
          recurrenceRule: idea.rule,
          profileId: profile.id,
        },
        remindBefore: idea.before,
      })
    } else {
      openSheet({
        type: 'event',
        date: addLocalDays(todayLocal(), 1),
        defaults: {
          title: idea.title,
          type: idea.type,
          repeatYearly: idea.yearly,
          profileId: profile.id,
        },
        remindBefore: idea.before,
      })
    }
  }

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
            {roleLabel(profile)} ·{' '}
            {total ? `${done} of ${total} today${done === total ? ' ⭐' : ''}` : 'nothing today'}
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
          {total === 0 && (
            <p className="pb-1 text-xs text-muted">Nothing planned for {profile.name} today.</p>
          )}

          {ideas.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                Ideas to track for {profile.name}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ideas.map((i) => (
                  <button
                    key={i.key}
                    type="button"
                    onClick={() => startIdea(i)}
                    className="min-h-9 rounded-full border border-line bg-surface px-3 text-xs font-semibold transition hover:border-sage active:scale-95"
                  >
                    {i.emoji} {i.title} <span className="text-sage-ink">+</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1">
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
            <LinkButton
              onClick={() => openSheet({ type: 'event', defaults: { profileId: profile.id } })}
            >
              + Event
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

/** Upcoming events for family members (appointments, birthdays, school events) in the next 2 weeks. */
function FamilyUpcoming() {
  const today = useToday()
  const members = useMembers()
  const events = useEventsBetween(today, addLocalDays(today, 14))
  const ids = new Set(members.map((m) => m.id))
  const list = (events ?? []).filter((e) => e.profileId && ids.has(e.profileId))
  if (!list.length) return null
  return (
    <Panel>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
        Coming up for the family
      </div>
      <div className="grid gap-2.5">
        {list.slice(0, 4).map((e) => (
          <EventRow key={e.id + e.occursOn} event={e} date={e.occursOn} />
        ))}
      </div>
    </Panel>
  )
}
