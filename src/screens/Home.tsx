import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, Flower2, Wind } from 'lucide-react'
import { db } from '@/db/db'
import { addLocalDays, formatLocal, greetingFor, toLocalDate, weekOf } from '@/lib/date'
import { usePrimaryProfile, useProfiles, useToday, useNow } from '@/lib/hooks'
import { useDayTasks, useEventsBetween, useHabitsForDay } from '@/lib/queries'
import { motivationFor } from '@/lib/wellness'
import { nextSlotAfter } from '@/lib/reminders'
import { isDueOn } from '@/lib/habits'
import { useUI } from '@/store/ui'
import {
  Avatar,
  EmptyState,
  LinkButton,
  Panel,
  PanelHead,
  ProgressBar,
  Skeleton,
  cx,
} from '@/components/ui'
import { EventRow, HabitRow, TaskRow } from '@/components/rows'

const EYEBROWS = [
  'A gentle reset',
  'A fresh start',
  'One step at a time',
  'Steady and calm',
  'Keep it simple',
  'Almost there',
  'Slow and joyful',
]

export function Home() {
  const today = useToday()
  const now = useNow()
  const navigate = useNavigate()
  const openSheet = useUI((s) => s.openSheet)
  const me = usePrimaryProfile()
  const profiles = useProfiles()

  const allTasks = useDayTasks(today, { includeOverdue: true })
  const allHabits = useHabitsForDay(today)
  const mine = (pid?: string | null) => !pid || pid === me?.id
  const tasks = allTasks?.filter((t) => mine(t.task.profileId))
  const habits = allHabits?.filter((h) => mine(h.habit.profileId))
  const week = weekOf(today)
  const events = useEventsBetween(today, addLocalDays(today, 30))

  const familyStats = useLiveQuery(async () => {
    const [hs, es, ts, occ] = await Promise.all([
      db.habits.toArray(),
      db.habitEntries.where('localDate').equals(today).toArray(),
      db.tasks.filter((t) => t.status !== 'archived').toArray(),
      db.taskOccurrences.where('localDate').equals(today).toArray(),
    ])
    const doneH = new Set(es.map((e) => e.habitId))
    const doneT = new Set(occ.map((o) => o.taskId))
    const map = new Map<string, { habits: number; habitsDone: number; tasksDone: number }>()
    for (const h of hs.filter((h) => isDueOn(h, today) && h.profileId)) {
      const s = map.get(h.profileId!) ?? { habits: 0, habitsDone: 0, tasksDone: 0 }
      s.habits++
      if (doneH.has(h.id)) s.habitsDone++
      map.set(h.profileId!, s)
    }
    for (const t of ts.filter((t) => t.profileId)) {
      const done = t.recurrenceRule
        ? doneT.has(t.id)
        : t.status === 'done' && !!t.completedAt && toLocalDate(new Date(t.completedAt)) === today
      if (!done) continue
      const s = map.get(t.profileId!) ?? { habits: 0, habitsDone: 0, tasksDone: 0 }
      s.tasksDone++
      map.set(t.profileId!, s)
    }
    return map
  }, [today])

  const mindful = useLiveQuery(
    () => db.wellnessSessions.where('localDate').between(week[0], week[6], true, true).toArray(),
    [week[0]],
  )
  const mindfulMin = Math.round((mindful ?? []).reduce((a, s) => a + s.durationSec, 0) / 60)

  const nextReminder = useLiveQuery(async () => {
    const rs = await db.reminders.filter((r) => r.enabled).toArray()
    return rs
      .map((r) => ({ r, at: nextSlotAfter(r, now) }))
      .filter((x): x is { r: typeof x.r; at: Date } => !!x.at)
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0]
  }, [now.getTime()])

  const tasksDone = tasks?.filter((t) => t.done).length ?? 0
  const habitsDone = habits?.filter((h) => h.done).length ?? 0
  const totalItems = (tasks?.length ?? 0) + (habits?.length ?? 0)
  const progress = totalItems ? (tasksDone + habitsDone) / totalItems : 0
  const weekday = formatLocal(today, 'EEEE')
  const eyebrow = EYEBROWS[new Date().getDay()]

  return (
    <div>
      <section className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            {weekday} · {eyebrow}
          </div>
          <h1 className="mt-1 text-[clamp(27px,5vw,36px)] font-bold leading-[1.12] tracking-[-1.3px]">
            {greetingFor(now)}, {me?.name?.replace(' (sample)', '') ?? 'friend'}{' '}
            <span className="inline-block origin-[70%_70%] animate-[bell_1.6s_ease-in-out_1]">
              👋
            </span>
          </h1>
          <div className="mt-1.5 text-sm text-muted">{motivationFor(today)}</div>
        </div>
        <div className="whitespace-nowrap rounded-full border border-line bg-surface px-3.5 py-2 text-xs text-muted">
          {formatLocal(today, 'EEEE, d MMMM')}
        </div>
      </section>

      <section className="mb-4 grid grid-cols-3 gap-2 sm:gap-3 stagger">
        <Stat value={`${tasksDone}/${tasks?.length ?? 0}`} label="Tasks completed" />
        <Stat value={`${habitsDone}/${habits?.length ?? 0}`} label="Habits completed" />
        <Stat value={`${Math.round(progress * 100)}%`} label="Daily progress" bar={progress} />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.85fr)]">
        <div className="grid gap-4 stagger">
          <Panel>
            <PanelHead
              title="Today's priorities"
              sub="Focus on what matters most"
              action={
                <LinkButton onClick={() => openSheet({ type: 'quickAdd' })}>+ Add task</LinkButton>
              }
            />
            {!tasks ? (
              <Skeleton />
            ) : tasks.length === 0 ? (
              <EmptyState
                emoji="🌤️"
                title="A clear day"
                text="Nothing planned yet. Add one or two things that would make today feel good."
              />
            ) : (
              <div>
                {tasks.slice(0, 5).map((t) => (
                  <TaskRow key={t.task.id} item={t} />
                ))}
                {tasks.length > 5 && (
                  <LinkButton className="mt-2" onClick={() => navigate('/tasks')}>
                    See all {tasks.length} tasks →
                  </LinkButton>
                )}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHead
              title="Daily habits"
              sub="Small actions, repeated consistently"
              action={<LinkButton onClick={() => navigate('/habits')}>See all</LinkButton>}
            />
            {!habits ? (
              <Skeleton />
            ) : habits.length === 0 ? (
              <EmptyState
                emoji="🌱"
                title="No habits for today"
                text="Start with one tiny habit — like a glass of water after waking."
                action={
                  <LinkButton onClick={() => openSheet({ type: 'habit' })}>+ New habit</LinkButton>
                }
              />
            ) : (
              <>
                <div className="grid gap-3">
                  {habits.map((h) => (
                    <HabitRow key={h.habit.id} habit={h.habit} done={h.done} date={today} />
                  ))}
                </div>
                <ProgressBar
                  className="mt-4"
                  value={habits.length ? habitsDone / habits.length : 0}
                />
              </>
            )}
          </Panel>

          <WellnessCard minutes={mindfulMin} sessions={mindful?.length ?? 0} today={today} />
        </div>

        <aside className="grid gap-4 stagger">
          <Panel>
            <PanelHead
              title="This week"
              sub="Your gentle overview"
              action={<LinkButton onClick={() => navigate('/calendar')}>Calendar</LinkButton>}
            />
            <div className="grid grid-cols-7 gap-1 text-center">
              {week.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => navigate(`/calendar?date=${d}`)}
                  className={cx(
                    'rounded-xl py-2 text-[11px] transition',
                    d === today
                      ? 'bg-sage text-white shadow-[0_6px_14px_#47765b40]'
                      : 'text-muted hover:bg-surface2',
                  )}
                  aria-label={formatLocal(d, 'EEEE d MMMM')}
                >
                  {formatLocal(d, 'EEEEE')}
                  <b
                    className={cx(
                      'mt-1 block text-[13px]',
                      d === today ? 'text-white' : 'text-ink',
                    )}
                  >
                    {formatLocal(d, 'd')}
                  </b>
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3">
              {events?.slice(0, 3).map((e) => (
                <EventRow key={e.id + e.occursOn} event={e} date={e.occursOn} />
              ))}
              {events && events.length === 0 && (
                <p className="text-xs text-muted">No upcoming events. Enjoy the space.</p>
              )}
            </div>
          </Panel>

          {nextReminder && (
            <Panel>
              <button
                type="button"
                onClick={() => navigate('/reminders')}
                className="flex w-full items-center gap-3 text-left"
              >
                <div className="grid size-11 place-items-center rounded-xl bg-sage-soft text-xl">
                  {nextReminder.r.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted">
                    Next reminder ·{' '}
                    {nextReminder.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  <div className="truncate text-sm font-bold">{nextReminder.r.title}</div>
                </div>
                <Bell size={18} className="text-muted" />
              </button>
            </Panel>
          )}

          <Panel>
            <PanelHead
              title="Family corner"
              sub="A shared view of little wins"
              action={<LinkButton onClick={() => navigate('/family')}>Manage</LinkButton>}
            />
            <div className="grid gap-3">
              {profiles?.map((p) => {
                const s = familyStats?.get(p.id)
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <Avatar avatar={p.avatar} color={p.color} />
                    <div className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                      {p.name}
                      <small className="block text-[11px] font-normal text-muted">
                        {p.role ?? 'Family'}
                      </small>
                    </div>
                    <div className="text-right text-xs text-muted">
                      {s?.habits ? `${s.habitsDone}/${s.habits} habits` : ''}
                      {s?.tasksDone ? (
                        <div>{s.tasksDone} done today ✨</div>
                      ) : !s?.habits ? (
                        'Ready when they are'
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Keep it simple" action={<span aria-hidden>🌱</span>} />
            <p className="text-xs text-muted">
              You don't have to do everything today. Choose a few things that make the day
              meaningful.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

function Stat({ value, label, bar }: { value: string; label: string; bar?: number }) {
  return (
    <div className="rounded-[17px] border border-line bg-surface p-3 sm:p-4">
      <strong className="block text-[22px] tracking-[-1px] sm:text-[25px]">{value}</strong>
      <span className="text-[11px] text-muted sm:text-xs">{label}</span>
      {bar !== undefined && <ProgressBar className="mt-2" value={bar} />}
    </div>
  )
}

function WellnessCard({
  minutes,
  sessions,
  today,
}: {
  minutes: number
  sessions: number
  today: string
}) {
  const navigate = useNavigate()
  return (
    <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#4f8063] via-[#47765b] to-[#335a45] p-5 text-white shadow-[0_14px_34px_#2f4f3c40]">
      <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
      <div aria-hidden className="absolute -bottom-16 right-16 size-32 rounded-full bg-white/5" />
      <div aria-hidden className="absolute right-6 top-6 size-14 text-white/40">
        <span className="ripple-ring" />
        <span className="ripple-ring" style={{ animationDelay: '-2s' }} />
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/75">
          <Flower2 size={14} /> Mind & body
        </div>
        <p className="mt-2 max-w-sm text-lg font-semibold leading-snug">
          “{motivationFor(today, 7)}”
        </p>
        <div className="mt-1 text-xs text-white/70">
          {minutes > 0
            ? `${minutes} mindful minutes · ${sessions} session${sessions === 1 ? '' : 's'} this week`
            : 'Your first mindful minute is one tap away.'}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/wellness?start=breath-calm')}
            className="flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-[#335a45] transition active:scale-95"
          >
            <Wind size={15} /> 1-min breathe
          </button>
          <button
            type="button"
            onClick={() => navigate('/wellness?start=yoga-desk')}
            className="min-h-10 rounded-xl bg-white/15 px-3.5 text-xs font-bold backdrop-blur transition hover:bg-white/25 active:scale-95"
          >
            🧘 Desk yoga
          </button>
          <button
            type="button"
            onClick={() => navigate('/wellness')}
            className="min-h-10 rounded-xl bg-white/15 px-3.5 text-xs font-bold backdrop-blur transition hover:bg-white/25 active:scale-95"
          >
            More →
          </button>
        </div>
      </div>
    </section>
  )
}
