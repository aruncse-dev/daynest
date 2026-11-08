import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BellRing, ChevronRight, Info } from 'lucide-react'
import { db } from '@/db/db'
import { saveHabit, saveReminder, setHabitStatus, setSetting } from '@/db/actions'
import { REMINDER_PRESETS } from '@/db/reminderPresets'
import type { Reminder, ReminderAudience } from '@/db/types'
import { addLocalDays, formatLocal } from '@/lib/date'
import { currentStreak, isDueOn } from '@/lib/habits'
import { describeSchedule, nextSlotAfter } from '@/lib/reminders'
import {
  notificationSupport,
  requestNotificationPermission,
  showSystemNotification,
} from '@/lib/notifications'
import { DEFAULT_QUIET, QUIET_KEY, type QuietHours } from '@/lib/quietHours'
import { formatShort } from '@/lib/suggest'
import { HABIT_TEMPLATES } from '@/lib/templates'
import { useNow, usePrimaryProfile, useProfileMap, useSetting, useToday } from '@/lib/hooks'
import { toast, useUI } from '@/store/ui'
import {
  Button,
  CheckBox,
  EmptyState,
  Input,
  Panel,
  Skeleton,
  Tag,
  Toggle,
  cx,
} from '@/components/ui'
import { HabitRow } from '@/components/rows'
import { ChipTabs, TabBar, useTab } from '@/components/Tabs'
import { toggleHabit } from '@/db/actions'

const TABS = ['habits', 'nudges', 'phonefree'] as const

export function Routines() {
  const [tab, setTab] = useTab(TABS, 'habits')
  return (
    <div>
      <h1 className="mb-3 text-[26px] font-bold tracking-[-1px]">Routines</h1>
      <TabBar
        label="Routines"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'habits', label: 'Habits' },
          { value: 'nudges', label: 'Nudges' },
          { value: 'phonefree', label: 'Phone-free', emoji: '🌙' },
        ]}
      />
      {tab === 'habits' && <HabitsTab />}
      {tab === 'nudges' && <NudgesTab />}
      {tab === 'phonefree' && <PhoneFreeTab />}
    </div>
  )
}

/* ---------------- Habits ---------------- */

function HabitsTab() {
  const today = useToday()
  const openSheet = useUI((s) => s.openSheet)
  const profiles = useProfileMap()
  const [who, setWho] = useState<'all' | 'me'>('all')
  const me = usePrimaryProfile()
  const data = useLiveQuery(async () => {
    const [habits, entries] = await Promise.all([db.habits.toArray(), db.habitEntries.toArray()])
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
  const rank = (pid?: string | null) =>
    !pid ? 1 : pid === me?.id ? 0 : 2 + [...profiles.keys()].indexOf(pid)
  const visible = data.habits
    .slice()
    .sort((a, b) => rank(a.profileId) - rank(b.profileId) || a.title.localeCompare(b.title))
    .filter((h) => who === 'all' || !h.profileId || h.profileId === me?.id)
  const dueToday = visible.filter((h) => isDueOn(h, today))
  const otherDays = visible.filter((h) => h.status === 'active' && !isDueOn(h, today))
  const paused = visible.filter((h) => h.status !== 'active')

  return (
    <>
      <ChipTabs
        label="Whose habits"
        value={who}
        onChange={setWho}
        options={[
          { value: 'all', label: '👪 Everyone' },
          { value: 'me', label: '🙂 Just me' },
        ]}
      />
      <Panel>
        {dueToday.length === 0 ? (
          <EmptyState
            emoji="🌱"
            title="No habits for today"
            text="Add one from the ideas below — small and specific works best."
          />
        ) : (
          <div className="grid gap-3">
            {dueToday.map((h) => (
              <div key={h.id} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <HabitRow
                    habit={h}
                    done={!!data.byHabit.get(h.id)?.has(today)}
                    date={today}
                    streak={currentStreak(h, data.byHabit.get(h.id) ?? new Set(), today)}
                    owner={profiles.get(h.profileId ?? '')}
                  />
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
            ))}
          </div>
        )}
      </Panel>
      {(otherDays.length > 0 || paused.length > 0) && (
        <details className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
          <summary className="cursor-pointer text-xs font-bold text-muted">
            Other days & paused ({otherDays.length + paused.length})
          </summary>
          {[...otherDays, ...paused].map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => openSheet({ type: 'habitDetail', habitId: h.id })}
              className="flex w-full items-center gap-2 border-b border-line-soft py-2 text-left last:border-0"
            >
              <span>{h.emoji}</span>
              <span className="flex-1 truncate">{h.title}</span>
              {h.status !== 'active' ? (
                <Tag tone="muted">{h.status}</Tag>
              ) : (
                <span className="text-[11px] text-muted">not today</span>
              )}
            </button>
          ))}
        </details>
      )}
      <HabitIdeas
        existing={
          new Set(
            data.habits.filter((h) => h.status !== 'archived').map((h) => h.templateKey ?? h.title),
          )
        }
      />
      <Button
        variant="outline"
        className="mt-3 w-full"
        onClick={() => openSheet({ type: 'habit' })}
      >
        + Create my own habit
      </Button>
    </>
  )
}

function HabitIdeas({ existing }: { existing: Set<string> }) {
  const me = usePrimaryProfile()
  const ideas = HABIT_TEMPLATES.filter(
    (t) => !existing.has(t.key) && !existing.has(t.title) && !t.forKids,
  ).slice(0, 10)
  if (!ideas.length) return null
  return (
    <div className="mt-4">
      <h2 className="mb-2 text-sm font-bold">Habit ideas — tap to add</h2>
      <div className="flex flex-wrap gap-2">
        {ideas.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={async () => {
              await saveHabit({
                title: t.title,
                emoji: t.emoji,
                targetLabel: t.targetLabel,
                scheduleDays: t.days ?? [],
                profileId: t.shared ? null : (me?.id ?? null),
                templateKey: t.key,
                status: 'active',
              })
              toast(`${t.title} added`, { emoji: t.emoji })
            }}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold transition hover:border-sage active:scale-95"
          >
            {t.emoji} {t.title} <span className="text-sage-ink">+</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Nudges ---------------- */

type NudgeFilter = 'me' | 'family' | 'ideas'

function NudgesTab() {
  const now = useNow(30_000)
  const [filter, setFilter] = useState<NudgeFilter>('me')
  const reminders = useLiveQuery(() => db.reminders.toArray(), [])
  const openSheet = useUI((s) => s.openSheet)
  const audienceOf = (r: Pick<Reminder, 'audience'>): ReminderAudience => r.audience ?? 'me'
  const list = (reminders ?? [])
    .filter((r) => (filter === 'me' ? audienceOf(r) === 'me' : audienceOf(r) !== 'me'))
    .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.title.localeCompare(b.title))
  const ideas = REMINDER_PRESETS.filter((p) => !reminders?.some((r) => r.presetKey === p.presetKey))

  return (
    <>
      <NotificationBanner />
      <ChipTabs<NudgeFilter>
        label="Nudge group"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'me', label: '🙂 For me' },
          { value: 'family', label: '🧒 Family & kids' },
          { value: 'ideas', label: `✨ Ideas (${ideas.length})` },
        ]}
      />
      {filter === 'ideas' ? (
        <Panel>
          {ideas.length === 0 ? (
            <EmptyState emoji="🎉" title="You've added every idea" />
          ) : (
            <div className="grid gap-2">
              {ideas.map(({ area: _area, ...p }) => (
                <button
                  key={p.presetKey}
                  type="button"
                  onClick={async () => {
                    await saveReminder({
                      ...p,
                      enabled: true,
                      lastFiredSlot: new Date().toISOString(),
                    })
                    toast(`${p.title} added`, { emoji: p.emoji })
                  }}
                  className="flex items-center gap-3 rounded-xl p-1.5 text-left hover:bg-surface2"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-surface2 text-xl">
                    {p.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {p.title} {p.priority === 'high' && <Tag tone="rose">Important</Tag>}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {describeSchedule({
                        ...p,
                        id: '',
                        enabled: true,
                        createdAt: '',
                        updatedAt: '',
                      })}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-sage-ink">+ Add</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      ) : list.length === 0 ? (
        <Panel>
          <EmptyState
            emoji="⏰"
            title="No nudges here yet"
            text="Browse ✨ Ideas or create your own."
          />
        </Panel>
      ) : (
        <div className="grid gap-2">
          {list.map((r) => (
            <NudgeRow key={r.id} reminder={r} now={now} />
          ))}
        </div>
      )}
      <Button
        variant="outline"
        className="mt-3 w-full"
        onClick={() => openSheet({ type: 'reminder' })}
      >
        + Create my own nudge
      </Button>
      <details className="mt-3 rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">
        <summary className="flex cursor-pointer items-center gap-1.5 font-semibold">
          <Info size={13} /> How nudges work
        </summary>
        <p className="mt-2">
          DayNest has no server, so nudges are scheduled on your phone. They pop up while DayNest is
          open or running in the background (installing it to your home screen helps). If the app is
          fully closed they can't fire — a nudge missed by less than 10 minutes shows when you come
          back. <b>Important</b> nudges stay on screen until you tap Done and still come through
          during phone-free time. On iPhone, add DayNest to the Home Screen to allow notifications.
        </p>
      </details>
    </>
  )
}

function NotificationBanner() {
  const [perm, setPerm] = useState(notificationSupport())
  if (perm === 'granted' || perm === 'unsupported') return null
  return (
    <div className="mb-3 flex items-center gap-3 rounded-2xl border border-sage-line bg-sage-soft p-3">
      <BellRing size={20} className="shrink-0 text-sage-ink" />
      <div className="min-w-0 flex-1 text-xs">
        {perm === 'denied'
          ? 'Notifications are blocked. Allow them for this site in your browser settings.'
          : 'Allow notifications so nudges reach you when DayNest is in the background.'}
      </div>
      {perm === 'default' && (
        <Button
          size="sm"
          onClick={async () => {
            const r = await requestNotificationPermission()
            setPerm(r)
            if (r === 'granted')
              await showSystemNotification({
                title: '🌿 Nudges are on',
                body: 'Friendly reminders will appear here.',
              })
          }}
        >
          Allow
        </Button>
      )}
    </div>
  )
}

function NudgeRow({ reminder: r, now }: { reminder: Reminder; now: Date }) {
  const openSheet = useUI((s) => s.openSheet)
  const owner = useProfileMap().get(r.profileId ?? '')
  const next = r.enabled ? nextSlotAfter(r, now) : null
  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition',
        !r.enabled && 'opacity-65',
      )}
    >
      <button
        type="button"
        onClick={() => openSheet({ type: 'reminder', reminder: r })}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={cx(
            'grid size-11 shrink-0 place-items-center rounded-xl text-2xl',
            r.enabled ? 'bg-sage-soft' : 'bg-surface2 grayscale',
          )}
        >
          {r.emoji}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-bold">
            <span className="truncate">{r.title}</span>
            {r.priority === 'high' && <Tag tone="rose">Important</Tag>}
          </span>
          <span className="block truncate text-[11px] text-muted">
            {owner ? `${owner.avatar} ${owner.name} · ` : ''}
            {describeSchedule(r)}
          </span>
          {next && (
            <span className="block text-[11px] font-semibold text-sage-ink">
              Next {next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              {next.toDateString() !== now.toDateString()
                ? ` · ${next.toLocaleDateString([], { weekday: 'short' })}`
                : ''}
            </span>
          )}
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

/* ---------------- Phone-free (digital wellbeing) ---------------- */

function PhoneFreeTab() {
  const today = useToday()
  const quiet = useSetting<QuietHours>(QUIET_KEY, DEFAULT_QUIET)
  const me = usePrimaryProfile()
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
  const nights = Array.from({ length: 7 }, (_, i) => addLocalDays(today, i - 7))
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

  /** Turning phone-free time on also sets up its habit and two nudges, so it's one switch. */
  const update = async (patch: Partial<QuietHours>) => {
    const next = { ...quiet, ...patch }
    await setSetting(QUIET_KEY, next)
    const shift = (t: string, m: number) => {
      const [h, mm] = t.split(':').map(Number)
      const total = (h * 60 + mm + m + 1440) % 1440
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    }
    for (const key of ['phonefree', 'phonefree-soon'] as const) {
      const preset = REMINDER_PRESETS.find((p) => p.presetKey === key)!
      const { area: _a, ...p } = preset
      const existing = reminders?.find((r) => r.presetKey === key)
      const times = [key === 'phonefree' ? next.start : shift(next.start, -15)]
      await saveReminder({
        ...(existing ?? p),
        times,
        enabled: next.enabled,
        lastFiredSlot: new Date().toISOString(),
      })
    }
    if (next.enabled && !habit) {
      await saveHabit({
        title: `No phone after ${formatShort(next.start)}`,
        emoji: '📵',
        scheduleDays: [],
        profileId: me?.id ?? null,
        templateKey: 'phone-free-night',
        status: 'active',
      })
    } else if (habit && next.enabled !== (habit.status === 'active')) {
      await setHabitStatus(habit.id, next.enabled ? 'active' : 'paused')
    }
  }

  return (
    <div className="grid gap-3">
      <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#2f3d63] to-[#1c2640] p-5 text-white">
        {[
          [80, 15],
          [90, 55],
          [65, 30],
          [72, 70],
        ].map(([l, t], i) => (
          <span
            key={i}
            aria-hidden
            className="twinkle text-xs"
            style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${i * 0.4}s` }}
          >
            ✦
          </span>
        ))}
        <div className="relative flex items-center gap-3">
          <span className="text-5xl anim-sway">🌙</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">Phone-free evenings</h2>
            <p className="text-xs text-white/75">
              Put the phone down at night. More sleep, more family, less scrolling.
            </p>
          </div>
          <Toggle
            checked={quiet.enabled}
            onChange={(v) => update({ enabled: v })}
            label="Phone-free evenings"
          />
        </div>
        {quiet.enabled && (
          <div className="relative mt-4 grid grid-cols-2 gap-3 text-xs">
            <label className="grid gap-1">
              <span className="text-white/70">Phone down at</span>
              <Input
                type="time"
                value={quiet.start}
                onChange={(e) => e.target.value && update({ start: e.target.value })}
                className="!border-white/20 !bg-white/10 !text-white"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-white/70">Until</span>
              <Input
                type="time"
                value={quiet.end}
                onChange={(e) => e.target.value && update({ end: e.target.value })}
                className="!border-white/20 !bg-white/10 !text-white"
              />
            </label>
          </div>
        )}
      </section>

      {quiet.enabled && (
        <Panel>
          <h3 className="mb-2 text-sm font-bold">Your last 7 nights</h3>
          <div className="flex justify-between">
            {nights.map((n) => {
              const ok = done?.has(n)
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => habit && toggleHabit(habit.id, n)}
                  aria-label={`Night of ${formatLocal(n, 'EEEE d MMM')}: ${ok ? 'phone-free' : 'not marked'}`}
                  className="grid justify-items-center gap-1 text-[10px] text-muted"
                >
                  <span
                    className={cx(
                      'grid size-9 place-items-center rounded-full text-base transition',
                      ok ? 'bg-[#2f3d63] text-white' : 'bg-surface2',
                    )}
                  >
                    {ok ? '🌙' : '·'}
                  </span>
                  {formatLocal(n, 'EEEEE')}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Each morning Today asks “Did you have a phone-free night?”. Tap a night here to fix it.
          </p>
          <div className="mt-3 grid gap-2 border-t border-line-soft pt-3 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span>Mute normal nudges during this time</span>
              <Toggle
                checked={quiet.muteNudges}
                onChange={(v) => update({ muteNudges: v })}
                label="Mute nudges"
              />
            </label>
            {reminders?.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs text-muted">
                <span>{r.emoji}</span>
                <span className="flex-1">
                  {r.title} · {(r.times ?? []).map(formatShort).join(', ')}
                </span>
                {r.priority === 'high' && <Tag tone="rose">Important</Tag>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel>
        <h3 className="mb-2 text-sm font-bold">More digital wellbeing</h3>
        <DigitalIdeas />
      </Panel>

      <Panel>
        <h3 className="mb-1 text-sm font-bold">Make it stick with your phone's own tools</h3>
        <p className="mb-2 text-xs text-muted">
          A web app can't lock your phone, but your phone can — pair DayNest with:
        </p>
        <ul className="grid gap-1.5 text-xs">
          <li>
            🤖 <b>Android:</b> Settings → Digital Wellbeing → <b>Bedtime mode</b> (greyscale + do
            not disturb) at {formatShort(quiet.start)}.
          </li>
          <li>
            🍎 <b>iPhone:</b> Settings → Screen Time → <b>Downtime</b> from{' '}
            {formatShort(quiet.start)} to {formatShort(quiet.end)}.
          </li>
          <li>🔌 Charge your phone outside the bedroom — the simplest trick of all.</li>
        </ul>
      </Panel>
    </div>
  )
}

function DigitalIdeas() {
  const me = usePrimaryProfile()
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const ideas = HABIT_TEMPLATES.filter((t) => t.area === 'digital' && t.key !== 'phone-free-night')
  return (
    <div className="grid gap-2">
      {ideas.map((t) => {
        const has = habits?.some((h) => h.templateKey === t.key && h.status !== 'archived')
        return (
          <div key={t.key} className="flex items-center gap-3">
            <span className="text-xl">{t.emoji}</span>
            <span className="flex-1 text-sm">{t.title}</span>
            <CheckBox
              checked={!!has}
              label={has ? `${t.title} is in your habits` : `Add ${t.title}`}
              onChange={async () => {
                if (has) return
                await saveHabit({
                  title: t.title,
                  emoji: t.emoji,
                  scheduleDays: [],
                  profileId: t.shared ? null : (me?.id ?? null),
                  templateKey: t.key,
                  status: 'active',
                })
                toast(`${t.title} added to habits`, { emoji: t.emoji })
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
