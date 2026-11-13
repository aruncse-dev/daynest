import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { setSetting, toggleHabit } from '@/db/actions'
import {
  addLocalDays,
  compareLocal,
  formatLocal,
  greetingFor,
  nowIso,
  toLocalDate,
  type LocalDate,
  weekOf,
} from '@/lib/date'
import {
  usePerson,
  usePrimaryProfile,
  useProfiles,
  useToday,
  useNow,
  useSetting,
} from '@/lib/hooks'
import { displayName, groupOf, isFor, isImportantDate } from '@/lib/people'
import { PersonBar } from '@/components/PersonBar'
import {
  useDayStats,
  useDayTasks,
  useEventsBetween,
  useHabitsForDay,
  usePeopleDay,
} from '@/lib/queries'
import {
  dayMessage,
  habitsKept,
  statDone,
  statRatio,
  statTotal,
  type DayStat,
} from '@/lib/dayStats'
import { motivationFor } from '@/lib/wellness'
import { nextSlotAfter } from '@/lib/reminders'
import { exportToDownload } from '@/lib/backup'
import { isIOS, isStandalone, promptInstall, useCanPromptInstall } from '@/lib/install'
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
import { Avatar, Button, LinkButton, Panel, Skeleton, cx } from '@/components/ui'
import { EventRow, HabitRow, TaskRow } from '@/components/rows'

export function Today() {
  const today = useToday()
  const now = useNow()
  const me = usePrimaryProfile()
  const profiles = useProfiles()
  const { person, hasFamily } = usePerson()
  const openSheet = useUI((s) => s.openSheet)
  const [picked, setPicked] = useState<LocalDate | null>(null)
  // a picked day resets once the date rolls over
  const day = picked && picked !== today ? picked : today
  const isToday = day === today
  const isFuture = compareLocal(day, today) > 0
  const [weekAnchor, setWeekAnchor] = useState<LocalDate | null>(null)
  const week = weekOf(weekAnchor ?? day)
  const ids = (profiles ?? []).map((p) => p.id)

  const tasks = useDayTasks(day, { includeOverdue: isToday, person })
  const habits = useHabitsForDay(day, person)?.filter(
    (h) => compareLocal(day, toLocalDate(new Date(h.habit.createdAt))) >= 0,
  )
  const stats = useDayStats(week, today, person)
  const people = usePeopleDay(day, today, ids)
  const dayStat = people?.[person]
  const total = (tasks?.length ?? 0) + (habits?.length ?? 0)
  const who = profiles?.find((p) => p.id === person)

  const nextNudge = useLiveQuery(async () => {
    const rs = await db.reminders
      .filter((r) => r.enabled && (person === 'all' || r.profileId === person))
      .toArray()
    return rs
      .map((r) => ({ r, at: nextSlotAfter(r, now) }))
      .filter((x): x is { r: (typeof rs)[number]; at: Date } => !!x.at)
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0]
  }, [now.getTime(), person])

  const pick = (d: LocalDate) => {
    setPicked(d === today ? null : d)
    setWeekAnchor(null)
  }
  const progress = people
    ? Object.fromEntries(Object.entries(people).map(([k, v]) => [k, statRatio(v)]))
    : undefined

  // Everyone, with family: one section per person (shared items sit with the first person)
  const grouped = person === 'all' && hasFamily && tasks && habits && profiles
  const sections = grouped
    ? [...profiles.map((p) => p.id), '']
        .map((id) => ({
          id,
          profile: profiles.find((p) => p.id === id),
          tasks: tasks.filter((t) => groupOf(t.task) === id),
          habits: habits.filter((h) => groupOf(h.habit) === id),
        }))
        .filter((g) => g.tasks.length + g.habits.length > 0)
    : []

  const renderItems = (ts: NonNullable<typeof tasks>, hs: NonNullable<typeof habits>) => (
    <>
      {ts.map((t) => (
        <TaskRow key={t.task.id} item={t} hideOwner={grouped ? groupOf(t.task) : person} />
      ))}
      {hs.length > 0 && (
        <div className={cx('grid gap-2.5', ts.length > 0 && 'mt-2.5')}>
          {hs.map((h) => (
            <HabitRow
              key={h.habit.id}
              habit={h.habit}
              done={h.done}
              date={day}
              locked={isFuture}
              hideOwner={grouped ? groupOf(h.habit) : person}
            />
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="grid gap-3">
      <section>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          {formatLocal(today, 'EEEE, d MMMM')}
        </div>
        <h1 className="text-[24px] font-bold leading-tight tracking-[-0.8px]">
          {greetingFor(now)}, {me?.name ?? 'friend'}{' '}
          <span className="inline-block anim-wiggle [animation-iteration-count:2]">👋</span>
        </h1>
      </section>

      <PersonBar progress={isToday ? progress : undefined} />

      <DayHero
        stat={dayStat}
        today={today}
        who={hasFamily ? (who ? displayName(who) : 'Everyone') : null}
        streak={stats?.streak ?? 0}
        quote={isToday && person === 'all' ? motivationFor(today) : null}
      />

      <WeekStrip
        week={week}
        today={today}
        selected={day}
        stats={stats?.days}
        onPick={pick}
        onShift={(n) => setWeekAnchor(addLocalDays(week[0], n * 7))}
      />

      {isToday && person === 'all' && <HelperCard today={today} now={now} />}

      <Panel>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[13px] font-bold">
            {isToday
              ? who
                ? `${displayName(who)} · today`
                : 'Today’s list'
              : formatLocal(day, 'EEEE, d MMM')}
          </h2>
          {isToday ? (
            <LinkButton onClick={() => openSheet({ type: 'quickAdd' })}>+ Add</LinkButton>
          ) : (
            <LinkButton onClick={() => pick(today)}>Back to today</LinkButton>
          )}
        </div>
        {!tasks || !habits ? (
          <Skeleton />
        ) : total === 0 ? (
          <div className="py-4 text-center">
            <div className="text-3xl">{isToday ? '🌤️' : isFuture ? '🗓️' : '🍃'}</div>
            <div className="mt-1 text-sm font-bold">
              {isToday ? 'A clear day' : isFuture ? 'Nothing planned yet' : 'Nothing was planned'}
            </div>
            {isToday && (
              <>
                <div className="text-xs text-muted">
                  {who
                    ? `Nothing for ${displayName(who)} today.`
                    : 'Add one or two things that would make today feel good.'}
                </div>
                <Button size="sm" className="mt-3" onClick={() => openSheet({ type: 'quickAdd' })}>
                  + Add a to-do
                </Button>
              </>
            )}
          </div>
        ) : grouped ? (
          <div className="grid gap-3">
            {sections.map((g) => {
              const done =
                g.tasks.filter((t) => t.done).length + g.habits.filter((h) => h.done).length
              const all = g.tasks.length + g.habits.length
              return (
                <section
                  key={g.id || 'none'}
                  aria-label={g.profile ? displayName(g.profile) : 'Everyone'}
                >
                  <div className="mb-1 flex items-center gap-2 border-b border-line-soft pb-1.5">
                    {g.profile ? (
                      <Avatar avatar={g.profile.avatar} color={g.profile.color} size={24} />
                    ) : (
                      <Avatar avatar="👪" color="var(--green2)" size={24} />
                    )}
                    <b className="flex-1 text-[12.5px]">
                      {g.profile ? displayName(g.profile) : 'Everyone'}
                    </b>
                    <span className="text-[11px] font-semibold tabular-nums text-muted">
                      {done}/{all}
                    </span>
                  </div>
                  {renderItems(g.tasks, g.habits)}
                </section>
              )
            })}
          </div>
        ) : (
          renderItems(tasks, habits)
        )}
        {!isToday && !isFuture && total > 0 && (
          <p className="mt-3 text-[11px] text-muted">
            Forgot to tick something? You can still mark it for this day.
          </p>
        )}
      </Panel>

      {isToday && <ComingUp today={today} nudge={nextNudge} person={person} />}
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
  person,
}: {
  today: LocalDate
  nudge?: { r: { emoji: string; title: string }; at: Date }
  person: string
}) {
  const navigate = useNavigate()
  // events in the next 2 weeks, important dates (birthdays…) a month ahead
  const all = useEventsBetween(today, addLocalDays(today, 30))
  const events = (all ?? [])
    .filter((e) => isFor(e, person))
    .filter((e) => isImportantDate(e) || compareLocal(e.occursOn, addLocalDays(today, 14)) <= 0)
  if (!nudge && !events.length) return null
  return (
    <Panel>
      <div className="mb-1 flex items-center justify-between">
        <SectionLabel>Coming up</SectionLabel>
        {!!events.length && (
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
                Reminder at{' '}
                {nudge.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </span>
          </button>
        )}
        {events.slice(0, 3).map((e) => (
          <EventRow
            key={e.id + e.occursOn}
            event={e}
            date={e.occursOn}
            hideOwner={person}
            countdown={isImportantDate(e)}
          />
        ))}
      </div>
    </Panel>
  )
}

function Card({
  tone = 'sage',
  children,
}: {
  tone?: 'sage' | 'night' | 'amber'
  children: React.ReactNode
}) {
  const cls =
    tone === 'night'
      ? 'bg-[#e9ecf6] text-[#26314f] dark:bg-[#1f2a44] dark:text-white'
      : tone === 'amber'
        ? 'bg-amber-soft text-ink'
        : 'border border-sage-line bg-sage-soft'
  return <div className={`rounded-[18px] px-4 py-3 text-sm animate-rise ${cls}`}>{children}</div>
}

/**
 * At most one small helper card, picked for the moment:
 * phone-free heads-up / morning check-in → evening wrap-up → backup reminder → install tip.
 */
function HelperCard({ today, now }: { today: LocalDate; now: Date }) {
  const quiet = useSetting<QuietHours>(QUIET_KEY, DEFAULT_QUIET)
  const asked = useSetting<string | null>('phoneFreeAsked', null)
  const wrapDismissed = useSetting<string | null>('wrapDismissed', null)
  const backupSnoozeUntil = useSetting<string | null>('backupSnoozeUntil', null)
  const installDismissed = useSetting('installDismissed', false)
  const canInstall = useCanPromptInstall()
  const night = addLocalDays(today, -1)

  const data = useLiveQuery(async () => {
    const habit = await db.habits
      .filter((h) => h.templateKey === 'phone-free-night' && h.status === 'active')
      .first()
    const doneLastNight = habit
      ? !!(await db.habitEntries.where('[habitId+localDate]').equals([habit.id, night]).first())
      : true
    const open = await db.tasks
      .filter(
        (t) =>
          !t.recurrenceRule &&
          t.status === 'open' &&
          !!t.dueDate &&
          compareLocal(t.dueDate, today) <= 0,
      )
      .toArray()
    const lastBackup = await db.backupHistory
      .orderBy('createdAt')
      .reverse()
      .filter((b) => b.status === 'success')
      .first()
    const me = await db.profiles.filter((p) => !!p.isPrimary).first()
    const items = (await db.tasks.count()) + (await db.habits.count())
    return { habit, doneLastNight, open, lastBackup, since: me?.createdAt, items }
  }, [today, night])
  if (!data) return null

  // 1. phone-free: a gentle (non-blocking) card during phone-free time, an evening heads-up,
  //    then the morning check-in
  if (data.habit && isQuietTime(quiet, now)) {
    return (
      <Card tone="night">
        <div className="flex items-center gap-3">
          <span className="text-2xl anim-sway">🌙</span>
          <span>
            <b>It's phone-free time.</b> Wrap up what you came for and put the phone down.
            Tomorrow-you says thanks.
          </span>
        </div>
      </Card>
    )
  }
  const mins = minutesUntilQuiet(quiet, now)
  if (mins !== null && mins > 0 && mins <= 60) {
    return (
      <Card tone="night">
        <div className="flex items-center gap-3">
          <span className="text-2xl anim-sway">🌙</span>
          <span>
            Phone-free in {mins} min ({formatShort(quiet.start)}). Time to wrap up.
          </span>
        </div>
      </Card>
    )
  }
  const morning =
    quiet.enabled &&
    !isQuietTime(quiet, now) &&
    now.getHours() < 14 &&
    nightOf(quiet, now) === toLocalDate(now)
  if (data.habit && morning && !data.doneLastNight && asked !== night) {
    const habit = data.habit
    return (
      <Card>
        <div className="font-bold">☀️ Did you have a phone-free night?</div>
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
      </Card>
    )
  }

  // 2. evening wrap-up: carry unfinished to-dos over to tomorrow in one tap
  if (now.getHours() >= 18 && data.open.length > 0 && wrapDismissed !== today) {
    const n = data.open.length
    return (
      <Card>
        <div className="font-bold">
          🌇 Wrapping up? {n} to-do{n > 1 ? 's' : ''} still open.
        </div>
        <div className="text-xs text-muted">
          That's fine. Move {n > 1 ? 'them' : 'it'} to tomorrow and rest easy.
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              const tomorrow = addLocalDays(today, 1)
              await db.tasks.bulkUpdate(
                data.open.map((t) => ({
                  key: t.id,
                  changes: { dueDate: tomorrow, updatedAt: nowIso() },
                })),
              )
              await setSetting('wrapDismissed', today)
              toast(`Moved to tomorrow`, { emoji: '🌙' })
            }}
          >
            Move to tomorrow
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSetting('wrapDismissed', today)}>
            Keep
          </Button>
        </div>
      </Card>
    )
  }

  // 3. backup reminder: data only lives on this phone
  const daysSince = (iso?: string) =>
    iso ? Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000) : Infinity
  const backupDue =
    data.items >= 3 &&
    daysSince(data.since) >= 3 &&
    daysSince(data.lastBackup?.createdAt) >= 14 &&
    (!backupSnoozeUntil || compareLocal(today, backupSnoozeUntil) >= 0)
  if (backupDue) {
    const d = daysSince(data.lastBackup?.createdAt)
    return (
      <Card tone="amber">
        <div className="font-bold">
          💾 {Number.isFinite(d) ? `Last backup was ${d} days ago` : 'Keep a backup'}
        </div>
        <div className="text-xs text-muted">
          Your data lives only on this phone. A backup file keeps it safe.
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              await exportToDownload()
              toast('Backup saved to your downloads', { emoji: '💾' })
            }}
          >
            Save backup
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSetting('backupSnoozeUntil', addLocalDays(today, 7))}
          >
            Later
          </Button>
        </div>
      </Card>
    )
  }

  // 4. install tip: reminders work best from the home screen
  if (!isStandalone() && !installDismissed) {
    return (
      <Card>
        <div className="font-bold">📲 Add DayNest to your home screen</div>
        <div className="text-xs text-muted">
          {canInstall
            ? 'Reminders work best from the installed app.'
            : isIOS()
              ? 'Tap Share ⬆️, then “Add to Home Screen”. Needed for reminders on iPhone.'
              : 'Open your browser menu ⋮ and choose “Install app” or “Add to Home screen”.'}
        </div>
        <div className="mt-2 flex gap-2">
          {canInstall && (
            <Button
              size="sm"
              onClick={async () => {
                if (await promptInstall()) toast('Installed 🎉')
              }}
            >
              Install
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setSetting('installDismissed', true)}>
            Not now
          </Button>
        </div>
      </Card>
    )
  }
  return null
}

/** A progress ring: one hue, light track → filled arc. */
function Ring({
  value,
  size,
  stroke,
  track,
  color,
  children,
}: {
  value: number | null
  size: number
  stroke: number
  track: string
  color: string
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = value == null ? 0 : Math.max(0, Math.min(1, value))
  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        )}
      </svg>
      <span className="relative">{children}</span>
    </span>
  )
}

/** The selected day at a glance: one ring, one sentence, three small facts. */
function DayHero({
  stat,
  today,
  who,
  streak,
  quote,
}: {
  stat?: DayStat
  today: LocalDate
  /** whose numbers: 'Everyone', 'Me', 'Mia' (null when there's no family) */
  who: string | null
  streak: number
  quote: string | null
}) {
  const ratio = stat ? statRatio(stat) : null
  const label = !stat
    ? ''
    : stat.date === today
      ? 'Today'
      : stat.date === addLocalDays(today, -1)
        ? 'Yesterday'
        : stat.date === addLocalDays(today, 1)
          ? 'Tomorrow'
          : formatLocal(stat.date, 'EEE d MMM')
  return (
    <section
      aria-label="Day summary"
      className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#5b8d6d] to-[#3f6e54] p-4 text-white shadow-[0_10px_30px_-18px_rgba(40,80,55,.8)]"
    >
      <span aria-hidden className="absolute -right-3 -top-4 text-[64px] opacity-15">
        🌿
      </span>
      <div className="relative flex items-center gap-4">
        <Ring value={ratio} size={86} stroke={9} track="rgba(255,255,255,.22)" color="#fff">
          <span className="block text-center">
            <b
              className={cx(
                'block leading-none tabular-nums',
                ratio === 1 ? 'text-[19px]' : 'text-[22px]',
              )}
            >
              {ratio == null ? '–' : `${Math.round(ratio * 100)}%`}
            </b>
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
            {who ? `${who} · ${label}` : label}
          </div>
          <div className="text-[21px] font-bold leading-tight tracking-[-0.4px] tabular-nums">
            {stat ? `${statDone(stat)} of ${statTotal(stat)} done` : '…'}
          </div>
          <div className="mt-0.5 text-[12.5px] opacity-90">{stat && dayMessage(stat, today)}</div>
        </div>
      </div>
      <div className="relative mt-3 grid grid-cols-3 gap-2 text-center">
        <Fact value={stat?.tasksDue ? `${stat.tasksDone}/${stat.tasksDue}` : '–'} label="To-dos" />
        <Fact
          value={stat?.habitsDue ? `${stat.habitsDone}/${stat.habitsDue}` : '–'}
          label="Habits"
        />
        <Fact
          value={streak ? `🔥 ${streak}` : '–'}
          label={streak === 1 ? 'Day streak' : 'Best streak'}
        />
      </div>
      {quote && (
        <p className="relative mt-3 border-t border-white/20 pt-2.5 text-[12.5px] italic leading-snug opacity-90">
          “{quote}”
        </p>
      )}
    </section>
  )
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-2 py-1.5">
      <b className="block text-[15px] leading-tight tabular-nums">{value}</b>
      <span className="block text-[10.5px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </span>
    </div>
  )
}

/** Mon–Sun with a small ring per day. Tap a day to see its list and numbers. */
function WeekStrip({
  week,
  today,
  selected,
  stats,
  onPick,
  onShift,
}: {
  week: LocalDate[]
  today: LocalDate
  selected: LocalDate
  stats?: DayStat[]
  onPick: (d: LocalDate) => void
  onShift: (n: number) => void
}) {
  const kept = stats ? habitsKept(stats, today) : null
  const thisWeek = week.includes(today)
  const title = thisWeek
    ? 'This week'
    : `${formatLocal(week[0], 'd MMM')} – ${formatLocal(week[6], 'd MMM')}`
  return (
    <Panel className="!px-2.5 !pb-2.5 !pt-2">
      <div className="mb-1 flex items-center gap-1 px-1">
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => onShift(-1)}
          className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface2"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[13px] font-bold">{title}</div>
          <div className="text-[11px] text-muted">
            {kept == null ? 'Habits kept: –' : `Habits kept: ${Math.round(kept * 100)}%`}
          </div>
        </div>
        <button
          type="button"
          aria-label="Next week"
          onClick={() => onShift(1)}
          className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface2"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {week.map((d, i) => {
          const s = stats?.[i]
          const ratio = s ? statRatio(s) : null
          const future = compareLocal(d, today) > 0
          const isSel = d === selected
          const isToday = d === today
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              aria-pressed={isSel}
              aria-label={`${formatLocal(d, 'EEEE d MMMM')}${
                s ? `: ${statDone(s)} of ${statTotal(s)} done` : ''
              }`}
              className={cx(
                'grid justify-items-center gap-1 rounded-[14px] py-1.5 transition',
                isSel ? 'bg-sage-soft ring-1 ring-sage-line' : 'hover:bg-surface2',
              )}
            >
              <span
                className={cx(
                  'text-[10.5px] font-bold uppercase',
                  isToday ? 'text-sage-ink' : 'text-muted',
                )}
              >
                {formatLocal(d, 'EEEEE')}
              </span>
              <Ring
                value={future ? null : ratio}
                size={34}
                stroke={3.5}
                track="var(--line)"
                color="var(--green)"
              >
                <span
                  className={cx(
                    'text-[12.5px] tabular-nums',
                    isToday ? 'font-extrabold text-sage-ink' : 'font-semibold',
                    future && 'text-muted',
                  )}
                >
                  {formatLocal(d, 'd')}
                </span>
              </Ring>
              <span aria-hidden className="h-1.5 text-[9px] leading-none text-sage-ink">
                {s && ratio === 1 && !future ? '✓' : ''}
              </span>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}
