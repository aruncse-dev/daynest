import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { db } from '@/db/db'
import { saveHabit, saveReminder, setHabitStatus, setSetting, toggleHabit } from '@/db/actions'
import { REMINDER_PRESETS } from '@/db/reminderPresets'
import type { Reminder } from '@/db/types'
import { addLocalDays, formatLocal } from '@/lib/date'
import { currentStreak, isDueOn } from '@/lib/habits'
import { describeSchedule } from '@/lib/reminders'
import { DEFAULT_QUIET, QUIET_KEY, type QuietHours } from '@/lib/quietHours'
import { formatShort } from '@/lib/suggest'
import { usePrimaryProfile, useSetting, useToday } from '@/lib/hooks'
import { useUI } from '@/store/ui'
import { Input, LinkButton, Panel, Skeleton, Tag, Toggle, cx } from '@/components/ui'
import { HabitRow } from '@/components/rows'
import { AlwaysOnCard } from '@/components/AlwaysOnCard'
import { pushConfigured, PUSH_ENABLED_KEY } from '@/lib/push'

export function Routines() {
  return (
    <div className="grid gap-3">
      <h1 className="text-[24px] font-bold tracking-[-0.8px]">Routines</h1>
      <PhoneFreeCard />
      <HabitsSection />
      <NudgesSection />
    </div>
  )
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</h2>
      {action}
    </div>
  )
}

/* ---------------- Phone-free evenings (compact) ---------------- */

function PhoneFreeCard() {
  const today = useToday()
  const quiet = useSetting<QuietHours>(QUIET_KEY, DEFAULT_QUIET)
  const me = usePrimaryProfile()
  const [open, setOpen] = useState(false)
  const reminders = useLiveQuery(
    () =>
      db.reminders
        .filter((r) => r.presetKey === 'phonefree' || r.presetKey === 'phonefree-soon')
        .toArray(),
    [],
  )
  const habit = useLiveQuery(
    () =>
      db.habits
        .filter((h) => h.templateKey === 'phone-free-night' && h.status !== 'archived')
        .first(),
    [],
  )
  const done = useLiveQuery(
    async () =>
      habit
        ? new Set(
            (await db.habitEntries.where('habitId').equals(habit.id).toArray()).map(
              (e) => e.localDate,
            ),
          )
        : new Set<string>(),
    [habit?.id],
  )
  const nights = Array.from({ length: 7 }, (_, i) => addLocalDays(today, i - 7))

  /** One switch sets up the nudges and the habit. */
  const update = async (patch: Partial<QuietHours>) => {
    const next = { ...quiet, ...patch }
    await setSetting(QUIET_KEY, next)
    const shift = (t: string, m: number) => {
      const [h, mm] = t.split(':').map(Number)
      const total = (h * 60 + mm + m + 1440) % 1440
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    }
    for (const key of ['phonefree', 'phonefree-soon'] as const) {
      const { area: _a, ...p } = REMINDER_PRESETS.find((x) => x.presetKey === key)!
      const existing = reminders?.find((r) => r.presetKey === key)
      await saveReminder({
        ...(existing ?? p),
        times: [key === 'phonefree' ? next.start : shift(next.start, -15)],
        enabled: next.enabled,
        lastFiredSlot: new Date().toISOString(),
      })
    }
    const title = `No phone after ${formatShort(next.start)}`
    if (next.enabled && !habit)
      await saveHabit({
        title,
        emoji: '📵',
        scheduleDays: [],
        profileId: me?.id ?? null,
        templateKey: 'phone-free-night',
        status: 'active',
      })
    else if (habit) {
      if (next.enabled !== (habit.status === 'active'))
        await setHabitStatus(habit.id, next.enabled ? 'active' : 'paused')
      if (patch.start && habit.title.startsWith('No phone after'))
        await saveHabit({ ...habit, title })
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-[#2f3d63] to-[#1c2640] p-3.5 text-white">
      {[
        [78, 18],
        [88, 60],
        [64, 35],
      ].map(([l, t], i) => (
        <span
          key={i}
          aria-hidden
          className="twinkle text-[10px]"
          style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${i * 0.4}s` }}
        >
          ✦
        </span>
      ))}
      <div className="relative flex items-center gap-3">
        <span className="text-3xl anim-sway">🌙</span>
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => quiet.enabled && setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="block text-sm font-bold">Phone-free evenings</span>
          <span className="block text-xs text-white/75">
            {quiet.enabled
              ? `Phone down at ${formatShort(quiet.start)} · tap for details`
              : 'Put the phone down at night'}
          </span>
        </button>
        <Toggle
          checked={quiet.enabled}
          onChange={(v) => update({ enabled: v })}
          label="Phone-free evenings"
        />
      </div>
      {quiet.enabled && (
        <div className="relative mt-3 flex justify-between" aria-label="Last 7 nights">
          {nights.map((n) => {
            const ok = done?.has(n)
            return (
              <button
                key={n}
                type="button"
                onClick={() => habit && toggleHabit(habit.id, n)}
                aria-label={`Night of ${formatLocal(n, 'EEEE')}: ${ok ? 'phone-free' : 'not marked'}`}
                className="grid justify-items-center gap-0.5 text-[10px] text-white/60"
              >
                <span
                  className={cx(
                    'grid size-8 place-items-center rounded-full text-sm',
                    ok ? 'bg-white/25' : 'bg-white/5',
                  )}
                >
                  {ok ? '🌙' : '·'}
                </span>
                {formatLocal(n, 'EEEEE')}
              </button>
            )
          })}
        </div>
      )}
      {quiet.enabled && open && (
        <div className="relative mt-3 grid gap-3 border-t border-white/15 pt-3 text-xs animate-fade">
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              <span className="text-white/70">Phone down at</span>
              <Input
                type="time"
                value={quiet.start}
                onChange={(e) => e.target.value && update({ start: e.target.value })}
                className="!min-h-10 !border-white/20 !bg-white/10 !text-white"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-white/70">Until</span>
              <Input
                type="time"
                value={quiet.end}
                onChange={(e) => e.target.value && update({ end: e.target.value })}
                className="!min-h-10 !border-white/20 !bg-white/10 !text-white"
              />
            </label>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Keep other reminders quiet until morning</span>
            <Toggle
              checked={quiet.muteNudges}
              onChange={(v) => update({ muteNudges: v })}
              label="Mute reminders"
            />
          </label>
          <p className="text-white/70">
            DayNest can't lock your phone. To make it stick, also turn on <b>Bedtime mode</b>{' '}
            (Android: Settings → Digital Wellbeing) or <b>Downtime</b> (iPhone: Settings → Screen
            Time).
          </p>
        </div>
      )}
    </section>
  )
}

/* ---------------- Habits ---------------- */

function HabitsSection() {
  const today = useToday()
  const openSheet = useUI((s) => s.openSheet)
  const data = useLiveQuery(async () => {
    const [habits, entries] = await Promise.all([
      db.habits
        .filter((h) => h.status !== 'archived' && h.templateKey !== 'phone-free-night')
        .toArray(),
      db.habitEntries.toArray(),
    ])
    const byHabit = new Map<string, Set<string>>()
    for (const e of entries) {
      if (!byHabit.has(e.habitId)) byHabit.set(e.habitId, new Set())
      byHabit.get(e.habitId)!.add(e.localDate)
    }
    return { habits, byHabit }
  }, [])
  if (!data)
    return (
      <Panel>
        <Skeleton />
      </Panel>
    )
  const list = data.habits.sort(
    (a, b) =>
      Number(b.status === 'active') - Number(a.status === 'active') ||
      a.title.localeCompare(b.title),
  )

  return (
    <section>
      <SectionHead
        title="My habits"
        action={<LinkButton onClick={() => openSheet({ type: 'habit' })}>+ Add</LinkButton>}
      />
      <Panel>
        {list.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">
            No habits yet. Tap “+ Add” and pick what suits you.
          </p>
        ) : (
          <div className="grid gap-2.5">
            {list.map((h) => {
              const dueToday = isDueOn(h, today)
              return (
                <div
                  key={h.id}
                  className={cx('flex items-center gap-1', h.status !== 'active' && 'opacity-60')}
                >
                  <div className="min-w-0 flex-1">
                    {dueToday ? (
                      <HabitRow
                        habit={h}
                        done={!!data.byHabit.get(h.id)?.has(today)}
                        date={today}
                        streak={currentStreak(h, data.byHabit.get(h.id) ?? new Set(), today)}
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="grid size-[38px] place-items-center rounded-xl bg-surface2 text-lg">
                          {h.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <b className="block truncate text-[13.5px]">{h.title}</b>
                          <small className="text-[11px] text-muted">
                            {h.status === 'paused' ? 'Paused' : 'Not today'}
                          </small>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`${h.title} history and settings`}
                    onClick={() => openSheet({ type: 'habitDetail', habitId: h.id })}
                    className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface2"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </section>
  )
}

/* ---------------- Nudges ---------------- */

function NudgesSection() {
  const alwaysOn = useSetting(PUSH_ENABLED_KEY, false)
  const openSheet = useUI((s) => s.openSheet)
  // stand-alone nudges only: habit/to-do/event reminders live on those items
  const reminders = useLiveQuery(
    () =>
      db.reminders
        .filter((r) => !r.link && r.presetKey !== 'phonefree' && r.presetKey !== 'phonefree-soon')
        .toArray(),
    [],
  )
  const list = (reminders ?? []).sort(
    (a, b) => Number(b.enabled) - Number(a.enabled) || a.title.localeCompare(b.title),
  )
  return (
    <section>
      <SectionHead
        title="My reminders"
        action={<LinkButton onClick={() => openSheet({ type: 'addNudge' })}>+ Add</LinkButton>}
      />
      <AlwaysOnCard />
      <Panel className="!py-1.5">
        {list.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">
            No reminders yet. Tap “+ Add” for ideas like drinking water.
          </p>
        ) : (
          list.map((r) => <NudgeRow key={r.id} reminder={r} />)
        )}
      </Panel>
      {!(pushConfigured() && alwaysOn) && (
        <p className="mt-2 px-1 text-[11px] text-muted">
          Reminders appear while DayNest is open or running in the background. Install it to your
          home screen for best results.
        </p>
      )}
    </section>
  )
}

function NudgeRow({ reminder: r }: { reminder: Reminder }) {
  const openSheet = useUI((s) => s.openSheet)
  return (
    <div
      className={cx(
        'flex items-center gap-3 border-b border-line-soft py-2 last:border-0',
        !r.enabled && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={() => openSheet({ type: 'reminder', reminder: r })}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={cx(
            'grid size-9 shrink-0 place-items-center rounded-[10px] text-lg',
            r.enabled ? 'bg-sage-soft' : 'bg-surface2 grayscale',
          )}
        >
          {r.emoji}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            <span className="truncate">{r.title}</span>
            {r.priority === 'high' && <Tag tone="rose">Important</Tag>}
          </span>
          <span className="block truncate text-[11px] text-muted">{describeSchedule(r)}</span>
        </span>
      </button>
      <Toggle
        checked={r.enabled}
        label={`${r.title} on`}
        onChange={(v) =>
          saveReminder({
            ...r,
            enabled: v,
            lastFiredSlot: v ? new Date().toISOString() : r.lastFiredSlot,
          })
        }
      />
    </div>
  )
}
