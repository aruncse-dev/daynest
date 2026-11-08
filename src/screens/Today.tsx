import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { setSetting, toggleHabit } from '@/db/actions'
import { addLocalDays, formatLocal, greetingFor, toLocalDate, type LocalDate } from '@/lib/date'
import {
  useFamilyMode,
  usePrimaryProfile,
  useProfiles,
  useToday,
  useNow,
  useSetting,
} from '@/lib/hooks'
import { useDayTasks, useEventsBetween, useHabitsForDay } from '@/lib/queries'
import { kindnessFor, motivationFor } from '@/lib/wellness'
import { nextSlotAfter } from '@/lib/reminders'
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
import { Avatar, Button, LinkButton, Panel, Ring, Skeleton } from '@/components/ui'
import { EventRow, HabitRow, TaskRow } from '@/components/rows'

export function Today() {
  const today = useToday()
  const now = useNow()
  const me = usePrimaryProfile()
  const family = useFamilyMode()
  const openSheet = useUI((s) => s.openSheet)

  const allTasks = useDayTasks(today, { includeOverdue: true })
  const allHabits = useHabitsForDay(today)
  // Self-first: your items plus unassigned ones; other people's items live on the Family tab
  const mine = (pid?: string | null) => !pid || pid === me?.id
  const tasks = allTasks?.filter((t) => mine(t.task.profileId))
  const habits = allHabits?.filter((h) => mine(h.habit.profileId))
  const doneCount =
    (tasks?.filter((t) => t.done).length ?? 0) + (habits?.filter((h) => h.done).length ?? 0)
  const total = (tasks?.length ?? 0) + (habits?.length ?? 0)
  const progress = total ? doneCount / total : 0

  const nextNudge = useLiveQuery(async () => {
    const rs = await db.reminders.filter((r) => r.enabled).toArray()
    return rs
      .map((r) => ({ r, at: nextSlotAfter(r, now) }))
      .filter((x): x is { r: (typeof rs)[number]; at: Date } => !!x.at)
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0]
  }, [now.getTime()])

  return (
    <div className="grid gap-3">
      <section className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            {formatLocal(today, 'EEEE, d MMMM')}
          </div>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.8px]">
            {greetingFor(now)}, {me?.name ?? 'friend'}{' '}
            <span className="inline-block anim-wiggle [animation-iteration-count:2]">👋</span>
          </h1>
        </div>
        <Ring value={progress} size={52}>
          {total ? `${doneCount}/${total}` : '🌱'}
        </Ring>
      </section>

      <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-[#5b8d6d] to-[#3f6e54] px-4 py-3 text-white">
        <span aria-hidden className="absolute -right-1 -top-2 text-4xl opacity-90 anim-sway">
          ☀️
        </span>
        <p className="pr-10 text-[15px] font-semibold leading-snug">“{motivationFor(today)}”</p>
        {family && (
          <p className="mt-1 pr-10 text-xs text-white/80">Smile idea: {kindnessFor(today)}</p>
        )}
      </section>

      <PhoneFreeCheckIn today={today} now={now} />

      <Panel>
        {!tasks || !habits ? (
          <Skeleton />
        ) : total === 0 ? (
          <div className="py-4 text-center">
            <div className="text-3xl">🌤️</div>
            <div className="mt-1 text-sm font-bold">A clear day</div>
            <div className="text-xs text-muted">
              Add one or two things that would make today feel good.
            </div>
            <Button size="sm" className="mt-3" onClick={() => openSheet({ type: 'quickAdd' })}>
              + Add a to-do
            </Button>
          </div>
        ) : (
          <>
            {tasks.length > 0 && <SectionLabel>To-do</SectionLabel>}
            {tasks.map((t) => (
              <TaskRow key={t.task.id} item={t} />
            ))}
            {habits.length > 0 && (
              <SectionLabel className={tasks.length ? 'mt-3' : ''}>Habits</SectionLabel>
            )}
            <div className="grid gap-2.5">
              {habits.map((h) => (
                <HabitRow key={h.habit.id} habit={h.habit} done={h.done} date={today} />
              ))}
            </div>
            {progress === 1 && (
              <p className="mt-3 text-center text-sm font-semibold text-sage-ink">
                All done — wonderful! 🎉
              </p>
            )}
          </>
        )}
      </Panel>

      <ComingUp today={today} nudge={nextNudge} />
      {family && <FamilyStrip />}
    </div>
  )
}

function SectionLabel({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`mb-1 text-[11px] font-bold uppercase tracking-wider text-muted ${className}`}>
      {children}
    </div>
  )
}

function ComingUp({
  today,
  nudge,
}: {
  today: LocalDate
  nudge?: { r: { emoji: string; title: string }; at: Date }
}) {
  const navigate = useNavigate()
  const events = useEventsBetween(today, addLocalDays(today, 14))
  if (!nudge && !events?.length) return null
  return (
    <Panel>
      <div className="mb-1 flex items-center justify-between">
        <SectionLabel>Coming up</SectionLabel>
        {!!events?.length && (
          <LinkButton onClick={() => navigate('/plan?tab=calendar')}>Calendar</LinkButton>
        )}
      </div>
      <div className="grid gap-2.5">
        {nudge && (
          <button
            type="button"
            onClick={() => navigate('/routines')}
            className="flex items-center gap-3 text-left"
          >
            <span className="grid size-11 place-items-center rounded-[10px] bg-sage-soft text-xl">
              {nudge.r.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{nudge.r.title}</span>
              <span className="block text-[11px] text-muted">
                Nudge at {nudge.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </span>
          </button>
        )}
        {events?.slice(0, 2).map((e) => (
          <EventRow key={e.id + e.occursOn} event={e} date={e.occursOn} />
        ))}
      </div>
    </Panel>
  )
}

function FamilyStrip() {
  const profiles = useProfiles()
  const navigate = useNavigate()
  const others = profiles?.filter((p) => !p.isPrimary) ?? []
  if (!others.length) return null
  return (
    <button
      type="button"
      onClick={() => navigate('/family')}
      className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3 text-left"
    >
      <div className="flex -space-x-2">
        {others.slice(0, 4).map((p) => (
          <Avatar
            key={p.id}
            avatar={p.avatar}
            color={p.color}
            size={30}
            className="ring-2 ring-surface"
          />
        ))}
      </div>
      <span className="flex-1 text-sm font-semibold">See the family's day</span>
      <span className="text-muted">›</span>
    </button>
  )
}

/** Evening heads-up and a one-tap morning check-in for the phone-free habit. */
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
  if (mins !== null && mins > 0 && mins <= 60) {
    return (
      <div className="flex items-center gap-3 rounded-[18px] bg-[#e9ecf6] px-4 py-3 text-sm text-[#26314f] dark:bg-[#1f2a44] dark:text-white">
        <span className="text-2xl anim-sway">🌙</span>
        <span>
          Phone-free in {mins} min ({formatShort(quiet.start)}). Time to wrap up.
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
    <div className="rounded-[18px] border border-sage-line bg-sage-soft px-4 py-3 animate-rise">
      <div className="text-sm font-bold">☀️ Did you have a phone-free night?</div>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await toggleHabit(habit.id, night)
            await setSetting('phoneFreeAsked', night)
            toast('Amazing! Your streak grows 🌙✨', { emoji: '🎉' })
          }}
        >
          Yes! 🎉
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
