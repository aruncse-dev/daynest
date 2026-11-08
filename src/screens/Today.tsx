import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { setSetting, toggleHabit } from '@/db/actions'
import { addLocalDays, formatLocal, greetingFor, toLocalDate, type LocalDate } from '@/lib/date'
import { usePrimaryProfile, useProfiles, useToday, useNow, useSetting } from '@/lib/hooks'
import { useDayTasks, useEventsBetween, useHabitsForDay } from '@/lib/queries'
import { kindnessFor, motivationFor } from '@/lib/wellness'
import { nextSlotAfter } from '@/lib/reminders'
import { isDueOn } from '@/lib/habits'
import {
  DEFAULT_QUIET,
  isQuietTime,
  minutesUntilQuiet,
  nightOf,
  QUIET_KEY,
  type QuietHours,
} from '@/lib/quietHours'
import { formatShort } from '@/lib/suggest'
import { toast, useUI } from '@/store/ui'
import {
  Avatar,
  Button,
  EmptyState,
  LinkButton,
  Panel,
  ProgressBar,
  Ring,
  Skeleton,
} from '@/components/ui'
import { EventRow, HabitRow, TaskRow } from '@/components/rows'
import { TabBar, useTab } from '@/components/Tabs'

const TABS = ['todo', 'habits', 'family'] as const

export function Today() {
  const today = useToday()
  const now = useNow()
  const me = usePrimaryProfile()
  const [tab, setTab] = useTab(TABS, 'todo')

  const allTasks = useDayTasks(today, { includeOverdue: true })
  const allHabits = useHabitsForDay(today)
  const mine = (pid?: string | null) => !pid || pid === me?.id
  const tasks = allTasks?.filter((t) => mine(t.task.profileId))
  const habits = allHabits?.filter((h) => mine(h.habit.profileId))
  const tasksDone = tasks?.filter((t) => t.done).length ?? 0
  const habitsDone = habits?.filter((h) => h.done).length ?? 0
  const total = (tasks?.length ?? 0) + (habits?.length ?? 0)
  const progress = total ? (tasksDone + habitsDone) / total : 0

  const nextNudge = useLiveQuery(async () => {
    const rs = await db.reminders.filter((r) => r.enabled).toArray()
    return rs
      .map((r) => ({ r, at: nextSlotAfter(r, now) }))
      .filter((x): x is { r: (typeof rs)[number]; at: Date } => !!x.at)
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0]
  }, [now.getTime()])

  return (
    <div>
      <section className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          {formatLocal(today, 'EEEE, d MMMM')}
        </div>
        <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-[-1px]">
          {greetingFor(now)}, {me?.name?.replace(' (sample)', '') ?? 'friend'}{' '}
          <span className="inline-block anim-wiggle [animation-iteration-count:2]">👋</span>
        </h1>
      </section>

      <SunshineCard today={today} />
      <PhoneFreeCheckIn today={today} now={now} />

      <Panel className="mb-4 !p-4">
        <div className="flex items-center gap-4">
          <Ring value={progress} size={60}>
            {Math.round(progress * 100)}%
          </Ring>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-bold">
              {progress >= 1 && total
                ? 'All done — wonderful! 🎉'
                : progress >= 0.5
                  ? 'Lovely progress 🌿'
                  : 'One small step at a time 🌱'}
            </div>
            <div className="text-xs text-muted">
              {tasksDone}/{tasks?.length ?? 0} to-dos · {habitsDone}/{habits?.length ?? 0} habits
            </div>
            {nextNudge && (
              <div className="mt-1 truncate text-xs font-semibold text-sage-ink">
                Next nudge{' '}
                {nextNudge.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ·{' '}
                {nextNudge.r.emoji} {nextNudge.r.title}
              </div>
            )}
          </div>
        </div>
      </Panel>

      <TabBar
        label="Today"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'todo', label: 'To-do', badge: tasks ? tasks.length - tasksDone : 0 },
          { value: 'habits', label: 'Habits', badge: habits ? habits.length - habitsDone : 0 },
          { value: 'family', label: 'Family' },
        ]}
      />
      {tab === 'todo' && <TodoPanel today={today} tasks={tasks} />}
      {tab === 'habits' && <HabitsPanel today={today} habits={habits} />}
      {tab === 'family' && <FamilyPanel today={today} />}
    </div>
  )
}

function SunshineCard({ today }: { today: LocalDate }) {
  return (
    <section className="relative mb-3 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#5b8d6d] via-[#47765b] to-[#365c47] p-4 text-white shadow-[0_12px_30px_#2f4f3c40]">
      <div aria-hidden className="absolute -right-8 -top-10 size-32 rounded-full bg-[#f4ead2]/25" />
      <div aria-hidden className="absolute -right-2 -top-3 text-5xl anim-sway">
        ☀️
      </div>
      <div className="relative pr-12">
        <p className="text-[17px] font-semibold leading-snug">“{motivationFor(today)}”</p>
        <p className="mt-2 text-xs text-white/80">
          <b className="text-white">Family smile idea:</b> {kindnessFor(today)}
        </p>
      </div>
    </section>
  )
}

/** Morning: one-tap honest check-in for the "no phone after 10" habit (marks last night). */
function PhoneFreeCheckIn({ today, now }: { today: LocalDate; now: Date }) {
  const quiet = useSetting<QuietHours>(QUIET_KEY, DEFAULT_QUIET)
  const asked = useSetting<string | null>('phoneFreeAsked', null)
  const night = addLocalDays(today, -1)
  const habit = useLiveQuery(
    () =>
      db.habits
        .filter((h) => h.templateKey === 'phone-free-night' && h.status === 'active')
        .first(),
    [],
  )
  const doneLastNight = useLiveQuery(
    async () =>
      habit
        ? !!(await db.habitEntries.where('[habitId+localDate]').equals([habit.id, night]).first())
        : true,
    [habit?.id, night],
  )
  const mins = minutesUntilQuiet(quiet, now)
  const evening = mins !== null && mins > 0 && mins <= 60

  if (evening) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[#2f3d63]/20 bg-[#e9ecf6] px-4 py-3 text-sm text-[#26314f] dark:bg-[#1f2a44] dark:text-white">
        <span className="text-2xl anim-sway">🌙</span>
        <span>
          Phone-free time in {mins} min ({formatShort(quiet.start)}). Wrap up and plug in away from
          bed.
        </span>
      </div>
    )
  }
  const morning =
    quiet.enabled &&
    !isQuietTime(quiet, now) &&
    now.getHours() < 14 &&
    nightOf(quiet, now) === toLocalDate(now)
  if (!habit || !morning || doneLastNight !== false || asked === night) return null
  return (
    <div className="mb-3 rounded-2xl border border-sage-line bg-sage-soft p-4 animate-rise">
      <div className="text-sm font-bold">☀️ Good morning! Did you have a phone-free night?</div>
      <div className="text-xs text-muted">
        Phone down by {formatShort(quiet.start)} last night — be honest, no judgement 💛
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await toggleHabit(habit.id, night)
            await setSetting('phoneFreeAsked', night)
            toast('Amazing! Your streak grows 🌙✨', { emoji: '🎉' })
          }}
        >
          Yes, I did! 🎉
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await setSetting('phoneFreeAsked', night)
            toast("That's okay — tonight is a fresh start 🌙")
          }}
        >
          Not quite
        </Button>
      </div>
    </div>
  )
}

function TodoPanel({ today, tasks }: { today: LocalDate; tasks: ReturnType<typeof useDayTasks> }) {
  const openSheet = useUI((s) => s.openSheet)
  const navigate = useNavigate()
  const events = useEventsBetween(today, addLocalDays(today, 14))
  return (
    <div className="grid gap-3">
      <Panel>
        {!tasks ? (
          <Skeleton />
        ) : tasks.length === 0 ? (
          <EmptyState
            emoji="🌤️"
            title="A clear day"
            text="Add one or two things that would make today feel good."
            action={
              <Button size="sm" onClick={() => openSheet({ type: 'quickAdd' })}>
                + Add a to-do
              </Button>
            }
          />
        ) : (
          tasks.map((t) => <TaskRow key={t.task.id} item={t} />)
        )}
      </Panel>
      {!!events?.length && (
        <Panel>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">Coming up</h2>
            <LinkButton onClick={() => navigate('/plan?tab=calendar')}>Calendar</LinkButton>
          </div>
          <div className="grid gap-3">
            {events.slice(0, 3).map((e) => (
              <EventRow key={e.id + e.occursOn} event={e} date={e.occursOn} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}

function HabitsPanel({
  today,
  habits,
}: {
  today: LocalDate
  habits: ReturnType<typeof useHabitsForDay>
}) {
  const navigate = useNavigate()
  if (!habits)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  const done = habits.filter((h) => h.done).length
  return (
    <Panel>
      {habits.length === 0 ? (
        <EmptyState
          emoji="🌱"
          title="No habits for today"
          text="Pick a couple from the ideas list."
          action={
            <Button size="sm" onClick={() => navigate('/routines')}>
              Browse habit ideas
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3">
            {habits.map((h) => (
              <HabitRow key={h.habit.id} habit={h.habit} done={h.done} date={today} />
            ))}
          </div>
          <ProgressBar className="mt-4" value={habits.length ? done / habits.length : 0} />
        </>
      )}
    </Panel>
  )
}

function FamilyPanel({ today }: { today: LocalDate }) {
  const profiles = useProfiles()
  const navigate = useNavigate()
  const stats = useLiveQuery(async () => {
    const [hs, es, ts, occ] = await Promise.all([
      db.habits.toArray(),
      db.habitEntries.where('localDate').equals(today).toArray(),
      db.tasks.filter((t) => t.status !== 'archived').toArray(),
      db.taskOccurrences.where('localDate').equals(today).toArray(),
    ])
    const doneH = new Set(es.map((e) => e.habitId))
    const doneT = new Set(occ.map((o) => o.taskId))
    const map = new Map<string, { total: number; done: number }>()
    const bump = (pid: string, isDone: boolean) => {
      const s = map.get(pid) ?? { total: 0, done: 0 }
      s.total++
      if (isDone) s.done++
      map.set(pid, s)
    }
    for (const h of hs) if (h.profileId && isDueOn(h, today)) bump(h.profileId, doneH.has(h.id))
    for (const t of ts) {
      if (!t.profileId) continue
      if (t.recurrenceRule) {
        if (doneT.has(t.id)) bump(t.profileId, true)
      } else if (t.dueDate === today) bump(t.profileId, t.status === 'done')
    }
    return map
  }, [today])
  if (!profiles)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  return (
    <Panel>
      <div className="grid gap-3">
        {profiles.map((p) => {
          const s = stats?.get(p.id)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/family?member=${p.id}`)}
              className="flex items-center gap-3 text-left"
            >
              <Avatar avatar={p.avatar} color={p.color} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-muted">
                  {s?.total ? `${s.done} of ${s.total} today` : 'Free day'}
                  {s && s.total && s.done === s.total ? ' — superstar! ⭐' : ''}
                </div>
              </div>
              {s?.total ? (
                <Ring value={s.done / s.total} size={36} stroke={4} />
              ) : (
                <span className="text-lg">🌼</span>
              )}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}
