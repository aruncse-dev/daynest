import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Clock, Flame, Sparkles } from 'lucide-react'
import { db } from '@/db/db'
import { addLocalDays, weekOf } from '@/lib/date'
import { useToday } from '@/lib/hooks'
import {
  BREATH_PATTERNS,
  MEDITATION_GUIDES,
  MEDITATION_LENGTHS,
  motivationFor,
  routineSeconds,
  ROUTINES,
  type BreathPattern,
  type Routine,
} from '@/lib/wellness'
import { BreathingPlayer, MeditationPlayer, RoutinePlayer } from '@/components/wellness/players'
import { cx } from '@/components/ui'

type Active =
  | { kind: 'breath'; pattern: BreathPattern }
  | { kind: 'meditate'; minutes: number; guide: (typeof MEDITATION_GUIDES)[number] }
  | { kind: 'routine'; routine: Routine }
  | null

export function Wellness() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const [active, setActive] = useState<Active>(null)
  const [minutes, setMinutes] = useState(5)
  const [guide, setGuide] = useState(MEDITATION_GUIDES[0])
  const week = weekOf(today)

  // deep links from Home, e.g. /wellness?start=yoga-desk
  useEffect(() => {
    const start = params.get('start')
    if (!start) return
    if (start.startsWith('breath-')) {
      const p = BREATH_PATTERNS.find((b) => `breath-${b.id}` === start)
      if (p)
        setActive({ kind: 'breath', pattern: start === 'breath-calm' ? { ...p, rounds: 6 } : p })
    } else {
      const r = ROUTINES.find((x) => x.id === start)
      if (r) setActive({ kind: 'routine', routine: r })
    }
    setParams({}, { replace: true })
  }, [params, setParams])

  const stats = useLiveQuery(async () => {
    const all = await db.wellnessSessions.toArray()
    const days = new Set(all.map((s) => s.localDate))
    let streak = 0
    let d = days.has(today) ? today : addLocalDays(today, -1)
    while (days.has(d)) {
      streak++
      d = addLocalDays(d, -1)
    }
    const thisWeek = all.filter((s) => s.localDate >= week[0] && s.localDate <= week[6])
    return {
      minutes: Math.round(thisWeek.reduce((a, s) => a + s.durationSec, 0) / 60),
      sessions: thisWeek.length,
      streak,
      weekDays: new Set(thisWeek.map((s) => s.localDate)),
      recent: all.sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 4),
    }
  }, [today, week[0]])

  const close = () => setActive(null)

  return (
    <div>
      {/* Hero */}
      <section className="relative mb-5 overflow-hidden rounded-[26px] bg-[radial-gradient(ellipse_at_top_left,#5f9473_0%,#3f6e54_45%,#24412f_100%)] p-6 text-white shadow-[0_18px_40px_#24412f40] sm:p-8">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="blob"
            style={{
              width: 260,
              height: 260,
              right: -60,
              top: -80,
              background: '#9cc8aa',
              opacity: 0.35,
            }}
          />
          <div
            className="blob"
            style={{
              width: 200,
              height: 200,
              left: -40,
              bottom: -90,
              background: '#f4ead2',
              opacity: 0.18,
              animationDelay: '-9s',
            }}
          />
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className="leaf"
              style={{
                left: `${15 + i * 18}%`,
                animationDuration: `${16 + i * 4}s`,
                animationDelay: `${-i * 3}s`,
                fontSize: 14,
                opacity: 0.4,
              }}
            >
              🍃
            </span>
          ))}
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/75">
            <Sparkles size={14} /> Today's thought
          </div>
          <p className="mt-2 max-w-lg text-[clamp(20px,4vw,28px)] font-semibold leading-snug tracking-tight">
            “{motivationFor(today)}”
          </p>
          <div className="mt-5 grid max-w-md grid-cols-3 gap-2">
            <HeroStat
              icon={<Clock size={14} />}
              value={`${stats?.minutes ?? 0}`}
              label="mins this week"
            />
            <HeroStat
              icon={<Sparkles size={14} />}
              value={`${stats?.sessions ?? 0}`}
              label="sessions"
            />
            <HeroStat
              icon={<Flame size={14} />}
              value={`${stats?.streak ?? 0}`}
              label="day streak"
            />
          </div>
          <div className="mt-4 flex gap-1.5" aria-label="Days practised this week">
            {week.map((d) => (
              <span
                key={d}
                className={cx(
                  'h-1.5 flex-1 rounded-full',
                  stats?.weekDays.has(d) ? 'bg-[#cfe8d4]' : 'bg-white/15',
                  d === today && 'ring-1 ring-white/60',
                )}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Breathe */}
      <SectionTitle
        emoji="🌬️"
        title="Breathe"
        sub="One to two minutes to settle the nervous system"
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3 stagger">
        {BREATH_PATTERNS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive({ kind: 'breath', pattern: p })}
            className="group relative overflow-hidden rounded-[20px] border border-line bg-surface p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[.98]"
          >
            <div className="relative mb-3 grid size-12 place-items-center">
              <span className="absolute inset-0 rounded-full bg-sage-soft transition-transform duration-[2000ms] group-hover:scale-125" />
              <span className="relative text-xl">🫧</span>
            </div>
            <div className="text-sm font-bold">{p.title}</div>
            <div className="text-xs text-muted">{p.subtitle}</div>
            <div className="mt-2 text-[11px] font-semibold text-sage-ink">
              {Math.round((p.phases.reduce((a, b) => a + b, 0) * p.rounds) / 60)} min
            </div>
          </button>
        ))}
      </div>

      {/* Meditate */}
      <SectionTitle emoji="🧘" title="Meditate" sub="A quiet timer with soft bells" />
      <div className="mb-6 rounded-[20px] border border-line bg-surface p-4 shadow-soft sm:p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {MEDITATION_GUIDES.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={guide.id === g.id}
              onClick={() => setGuide(g)}
              className={cx(
                'min-h-9 rounded-full px-3.5 text-xs font-semibold transition',
                guide.id === g.id ? 'bg-sage text-white' : 'bg-surface2 text-muted hover:text-ink',
              )}
            >
              {g.title}
            </button>
          ))}
        </div>
        <p className="mb-4 text-sm text-muted">{guide.cue}</p>
        <div className="flex flex-wrap items-center gap-2">
          {MEDITATION_LENGTHS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={minutes === m}
              onClick={() => setMinutes(m)}
              className={cx(
                'grid size-12 place-items-center rounded-2xl text-sm font-bold transition',
                minutes === m
                  ? 'bg-sage-soft text-sage-ink ring-2 ring-sage'
                  : 'bg-surface2 text-muted',
              )}
            >
              {m}
            </button>
          ))}
          <span className="text-xs text-muted">min</span>
          <button
            type="button"
            onClick={() => setActive({ kind: 'meditate', minutes, guide })}
            className="ml-auto min-h-12 rounded-2xl bg-sage px-5 text-sm font-bold text-white shadow-[0_8px_20px_#47765b44] transition active:scale-95"
          >
            Begin
          </button>
        </div>
      </div>

      {/* Yoga */}
      <SectionTitle emoji="🧘‍♀️" title="Yoga" sub="Gentle flows for morning, desk and evening" />
      <RoutineGrid
        routines={ROUTINES.filter((r) => r.kind === 'yoga')}
        onStart={(routine) => setActive({ kind: 'routine', routine })}
      />

      {/* Exercise */}
      <SectionTitle emoji="💪" title="Move" sub="No equipment. Low impact options welcome." />
      <RoutineGrid
        routines={ROUTINES.filter((r) => r.kind === 'exercise')}
        onStart={(routine) => setActive({ kind: 'routine', routine })}
      />

      {stats && stats.recent.length > 0 && (
        <>
          <SectionTitle emoji="🌱" title="Recent practice" />
          <div className="grid gap-2 rounded-[20px] border border-line bg-surface p-4 shadow-soft">
            {stats.recent.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span>{s.title}</span>
                <span className="text-xs text-muted">
                  {Math.max(1, Math.round(s.durationSec / 60))} min ·{' '}
                  {s.localDate === today ? 'today' : s.localDate}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-6 text-center text-[11px] text-muted">
        DayNest offers general wellbeing routines, not medical advice. Listen to your body.
      </p>

      {active?.kind === 'breath' && <BreathingPlayer pattern={active.pattern} onClose={close} />}
      {active?.kind === 'meditate' && (
        <MeditationPlayer minutes={active.minutes} guide={active.guide} onClose={close} />
      )}
      {active?.kind === 'routine' && <RoutinePlayer routine={active.routine} onClose={close} />}
    </div>
  )
}

function HeroStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-3 py-2.5 backdrop-blur">
      <div className="flex items-center gap-1 text-xl font-bold">
        {icon}
        {value}
      </div>
      <div className="text-[10px] text-white/70">{label}</div>
    </div>
  )
}

function SectionTitle({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div className="mb-3 mt-1 flex items-end gap-2">
      <span className="text-xl" aria-hidden>
        {emoji}
      </span>
      <div>
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
    </div>
  )
}

const ROUTINE_BG = [
  'from-[#e4eee5] to-[#f4f7ee]',
  'from-[#f4ead2] to-[#f7f3e6]',
  'from-[#e6e2f1] to-[#f1eff7]',
  'from-[#dfeaf0] to-[#eef4f6]',
]

function RoutineGrid({
  routines,
  onStart,
}: {
  routines: Routine[]
  onStart: (r: Routine) => void
}) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3 stagger">
      {routines.map((r, i) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onStart(r)}
          className={cx(
            'group relative overflow-hidden rounded-[20px] bg-gradient-to-br p-4 text-left text-[#202820] shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[.98] dark:brightness-90',
            ROUTINE_BG[i % ROUTINE_BG.length],
          )}
        >
          <span
            aria-hidden
            className="absolute -right-3 -top-3 text-6xl opacity-30 transition-transform duration-700 group-hover:rotate-12 group-hover:scale-110"
          >
            {r.emoji}
          </span>
          <div className="relative">
            <div className="text-2xl">{r.emoji}</div>
            <div className="mt-2 text-sm font-bold">{r.title}</div>
            <div className="text-xs text-[#5d675e]">{r.subtitle}</div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#3d6b50]">
              <span className="rounded-full bg-white/70 px-2 py-0.5">
                {Math.round(routineSeconds(r) / 60)} min
              </span>
              <span className="rounded-full bg-white/70 px-2 py-0.5">{r.level}</span>
              <span className="rounded-full bg-white/70 px-2 py-0.5">
                {r.steps.filter((s) => !s.rest).length} moves
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
