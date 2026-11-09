import { useNavigate } from 'react-router-dom'
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
} from '@/lib/date'
import { useMembers, usePrimaryProfile, useToday, useNow, useSetting } from '@/lib/hooks'
import { currentStreak, isDueOn } from '@/lib/habits'
import { useDayTasks, useEventsBetween, useHabitsForDay } from '@/lib/queries'
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
import { Avatar, Button, LinkButton, Panel, ProgressBar, Skeleton } from '@/components/ui'
import { EventRow, HabitRow, TaskRow } from '@/components/rows'

export function Today() {
  const today = useToday()
  const now = useNow()
  const me = usePrimaryProfile()
  const openSheet = useUI((s) => s.openSheet)
  // Today is about you; family members' items live on the Family tab
  const mine = (pid?: string | null) => !pid || pid === me?.id
  const tasks = useDayTasks(today, { includeOverdue: true })?.filter((t) => mine(t.task.profileId))
  const habits = useHabitsForDay(today)?.filter((h) => mine(h.habit.profileId))
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
      </section>

      <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-[#5b8d6d] to-[#3f6e54] px-4 py-3 text-white">
        <span aria-hidden className="absolute -right-1 -top-2 text-4xl opacity-90 anim-sway">
          ☀️
        </span>
        <p className="pr-10 text-[15px] font-semibold leading-snug">“{motivationFor(today)}”</p>
      </section>

      <StatTiles today={today} meId={me?.id} tasks={tasks} habits={habits} />

      <HelperCard today={today} now={now} />

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
      <FamilyStrip today={today} />
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
                Reminder at{' '}
                {nudge.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
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

/** A small link to the family's day, only when family members exist. */
function FamilyStrip({ today }: { today: LocalDate }) {
  const members = useMembers()
  const navigate = useNavigate()
  const left = useLiveQuery(async () => {
    const ids = new Set(members.map((m) => m.id))
    const [hs, es] = await Promise.all([
      db.habits.toArray(),
      db.habitEntries.where('localDate').equals(today).toArray(),
    ])
    const done = new Set(es.map((e) => e.habitId))
    return hs.filter(
      (h) => h.profileId && ids.has(h.profileId) && isDueOn(h, today) && !done.has(h.id),
    ).length
  }, [today, members.length])
  if (!members.length) return null
  return (
    <button
      type="button"
      onClick={() => navigate('/family')}
      className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3 text-left"
    >
      <div className="flex -space-x-2">
        {members.slice(0, 4).map((p) => (
          <Avatar
            key={p.id}
            avatar={p.avatar}
            color={p.color}
            size={30}
            className="ring-2 ring-surface"
          />
        ))}
      </div>
      <span className="flex-1 text-sm">
        <b>Family</b>
        <span className="block text-xs text-muted">
          {left ? `${left} habit${left > 1 ? 's' : ''} still to do today` : 'All caught up 🌼'}
        </span>
      </span>
      <span className="text-muted">›</span>
    </button>
  )
}

/** Today at a glance: to-dos, habits, and how the last 7 days went. Informative, never a score. */
function StatTiles({
  today,
  meId,
  tasks,
  habits,
}: {
  today: LocalDate
  meId?: string
  tasks?: { done: boolean }[]
  habits?: { done: boolean }[]
}) {
  const week = useLiveQuery(async () => {
    const mine = (await db.habits.toArray()).filter(
      (h) => h.status === 'active' && (!h.profileId || h.profileId === meId),
    )
    const from = addLocalDays(today, -6)
    const entries = await db.habitEntries
      .where('localDate')
      .between(from, today, true, true)
      .toArray()
    const done = new Set(entries.map((e) => `${e.habitId}|${e.localDate}`))
    let due = 0
    let kept = 0
    let best = 0
    for (const h of mine) {
      const started = toLocalDate(new Date(h.createdAt))
      for (let i = 0; i < 7; i++) {
        const d = addLocalDays(from, i)
        if (compareLocal(d, started) < 0 || !isDueOn(h, d)) continue
        due++
        if (done.has(`${h.id}|${d}`)) kept++
      }
      const all = new Set(
        (await db.habitEntries.where('habitId').equals(h.id).toArray()).map((e) => e.localDate),
      )
      best = Math.max(best, currentStreak(h, all, today))
    }
    return { pct: due ? Math.round((kept / due) * 100) : null, best }
  }, [today, meId, habits?.filter((h) => h.done).length])

  const tDone = tasks?.filter((t) => t.done).length ?? 0
  const hDone = habits?.filter((h) => h.done).length ?? 0
  return (
    <section className="grid grid-cols-3 gap-2" aria-label="Today at a glance">
      <Tile
        value={tasks ? `${tDone}/${tasks.length}` : '–'}
        label="To-dos done"
        ratio={tasks?.length ? tDone / tasks.length : 0}
      />
      <Tile
        value={habits ? `${hDone}/${habits.length}` : '–'}
        label="Habits done"
        ratio={habits?.length ? hDone / habits.length : 0}
      />
      <Tile
        value={week?.pct == null ? '–' : `${week.pct}%`}
        label={week?.best ? `This week · 🔥 ${week.best}` : 'This week'}
        ratio={(week?.pct ?? 0) / 100}
      />
    </section>
  )
}

function Tile({ value, label, ratio }: { value: string; label: string; ratio: number }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface px-3 py-2.5">
      <strong className="block text-[20px] leading-tight tracking-[-0.5px] tabular-nums">
        {value}
      </strong>
      <span className="block truncate text-[11px] text-muted">{label}</span>
      <ProgressBar className="mt-1.5" value={ratio} />
    </div>
  )
}
