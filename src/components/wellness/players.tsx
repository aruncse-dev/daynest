import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import { logWellness } from '@/db/actions'
import { chime, vibrate } from '@/lib/sound'
import { motivationFor, routineSeconds, type BreathPattern, type Routine } from '@/lib/wellness'
import { todayLocal } from '@/lib/date'
import { usePrimaryProfile } from '@/lib/hooks'

/* ---------- shared bits ---------- */

/** Accurate elapsed-time clock (seconds) that survives tab throttling. */
function useClock(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const base = useRef<{ start: number; acc: number }>({ start: 0, acc: 0 })
  useEffect(() => {
    if (!running) return
    base.current.start = performance.now()
    const id = setInterval(() => {
      setElapsed(base.current.acc + (performance.now() - base.current.start) / 1000)
    }, 100)
    return () => {
      clearInterval(id)
      base.current.acc += (performance.now() - base.current.start) / 1000
    }
  }, [running])
  const reset = (to = 0) => {
    base.current = { start: performance.now(), acc: to }
    setElapsed(to)
  }
  return [elapsed, reset] as const
}

/** Keep the screen awake during a session where supported. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock
      .request('screen')
      .then((l) => (lock = l))
      .catch(() => undefined)
    return () => void lock?.release().catch(() => undefined)
  }, [active])
}

function fmt(sec: number) {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function ImmersiveFrame({
  children,
  onClose,
  title,
  muted,
  onToggleMute,
}: {
  children: ReactNode
  onClose: () => void
  title: string
  muted: boolean
  onToggleMute: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 overflow-hidden bg-[radial-gradient(ellipse_at_top,#4f8063_0%,#2d5440_45%,#16291d_100%)] text-white animate-fade"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="blob"
          style={{
            width: '60vmax',
            height: '60vmax',
            left: '-20vmax',
            top: '-25vmax',
            background: '#6fa384',
            opacity: 0.35,
          }}
        />
        <div
          className="blob"
          style={{
            width: '50vmax',
            height: '50vmax',
            right: '-20vmax',
            bottom: '-20vmax',
            background: '#a7c9a0',
            opacity: 0.18,
            animationDelay: '-10s',
          }}
        />
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className="leaf"
            style={{
              left: `${(i * 13 + 5) % 100}%`,
              animationDuration: `${22 + i * 3}s`,
              animationDelay: `${-i * 4}s`,
              fontSize: 14 + (i % 3) * 4,
              opacity: 0.35,
            }}
          >
            {['🍃', '✿', '🌿', '·'][i % 4]}
          </span>
        ))}
      </div>
      <div className="relative mx-auto flex h-full max-w-xl flex-col px-5 pb-safe pt-[max(16px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            className="grid size-11 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className="text-sm font-semibold text-white/80">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-11 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function Celebrate({
  title,
  minutes,
  onClose,
}: {
  title: string
  minutes: number
  onClose: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center animate-rise">
      <div className="relative mb-6 grid size-40 place-items-center">
        <span className="ripple-ring text-white/50" />
        <span className="ripple-ring text-white/40" style={{ animationDelay: '-1.3s' }} />
        <span className="ripple-ring text-white/30" style={{ animationDelay: '-2.6s' }} />
        <span className="text-6xl animate-pop">🌿</span>
      </div>
      <h2 className="text-3xl font-bold tracking-tight">Well done</h2>
      <p className="mt-2 text-white/80">
        {title} · {minutes} min
      </p>
      <p className="mt-6 max-w-xs text-lg italic text-white/90">
        “{motivationFor(todayLocal(), 3)}”
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-10 min-h-12 rounded-2xl bg-white px-8 font-bold text-[#2d5440] shadow-xl transition active:scale-95"
      >
        Finish
      </button>
    </div>
  )
}

function Controls({
  running,
  onToggle,
  onPrev,
  onNext,
}: {
  running: boolean
  onToggle: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  return (
    <div className="flex items-center justify-center gap-6 pb-8">
      {onPrev ? (
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous"
          className="grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <SkipBack size={20} />
        </button>
      ) : (
        <span className="size-12" />
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={running ? 'Pause' : 'Start'}
        className="grid size-[72px] place-items-center rounded-full bg-white text-[#2d5440] shadow-[0_10px_40px_rgba(0,0,0,.25)] transition active:scale-95"
      >
        {running ? (
          <Pause size={28} fill="currentColor" />
        ) : (
          <Play size={28} fill="currentColor" className="ml-1" />
        )}
      </button>
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          className="grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <SkipForward size={20} />
        </button>
      ) : (
        <span className="size-12" />
      )}
    </div>
  )
}

function useSessionSound() {
  const [muted, setMuted] = useState(false)
  const play = (k: Parameters<typeof chime>[0]) => !muted && chime(k)
  return { muted, toggle: () => setMuted((m) => !m), play }
}

/* ---------- Breathing ---------- */

const PHASE_LABEL = ['Breathe in', 'Hold', 'Breathe out', 'Hold']

export function BreathingPlayer({
  pattern,
  onClose,
}: {
  pattern: BreathPattern
  onClose: () => void
}) {
  const me = usePrimaryProfile()
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [elapsed] = useClock(running)
  const sound = useSessionSound()
  useWakeLock(running)
  const cycle = pattern.phases.reduce((a, b) => a + b, 0)
  const total = cycle * pattern.rounds
  const t = Math.min(elapsed, total)
  const round = Math.min(pattern.rounds, Math.floor(t / cycle) + 1)
  let within = t % cycle
  let phase = 0
  while (phase < 3 && within >= pattern.phases[phase]) {
    within -= pattern.phases[phase]
    phase++
  }
  // skip zero-length phases
  while (pattern.phases[phase] === 0 && phase < 3) phase++
  const phaseLeft = pattern.phases[phase] - within
  // circle scale: grows on inhale, holds, shrinks on exhale
  const p = pattern.phases[phase] ? within / pattern.phases[phase] : 1
  const scale = phase === 0 ? 0.55 + 0.45 * p : phase === 1 ? 1 : phase === 2 ? 1 - 0.45 * p : 0.55

  const lastPhase = useRef(-1)
  useEffect(() => {
    if (!running) return
    if (lastPhase.current !== phase) {
      lastPhase.current = phase
      sound.play('tick')
      vibrate(30)
    }
  }, [phase, running, sound])

  useEffect(() => {
    if (running && elapsed >= total && !done) {
      setRunning(false)
      setDone(true)
      sound.play('bell')
      void logWellness({
        kind: 'breathing',
        routineId: pattern.id,
        title: pattern.title,
        durationSec: Math.round(total),
        profileId: me?.id,
      })
    }
  }, [elapsed, total, running, done, pattern, sound, me])

  return (
    <ImmersiveFrame
      title={pattern.title}
      onClose={onClose}
      muted={sound.muted}
      onToggleMute={sound.toggle}
    >
      {done ? (
        <Celebrate title={pattern.title} minutes={Math.round(total / 60) || 1} onClose={onClose} />
      ) : (
        <>
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="relative grid size-[min(78vw,340px)] place-items-center">
              {running && (
                <>
                  <span className="ripple-ring text-white/25" />
                  <span className="ripple-ring text-white/20" style={{ animationDelay: '-2s' }} />
                </>
              )}
              <div
                className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#d9f0dc,#8cc39b_45%,#4f8063)] shadow-[0_0_80px_rgba(170,220,180,.45)]"
                style={{
                  transform: `scale(${running || elapsed > 0 ? scale : 0.6})`,
                  transition: 'transform 120ms linear',
                }}
              />
              <div className="relative text-center text-[#173222]">
                <div className="text-2xl font-bold" aria-live="polite">
                  {running || elapsed > 0 ? PHASE_LABEL[phase] : 'Ready'}
                </div>
                <div className="text-5xl font-light tabular-nums">
                  {running || elapsed > 0 ? Math.ceil(phaseLeft) : '·'}
                </div>
              </div>
            </div>
            <div className="mt-8 text-center text-white/80">
              <div className="text-sm">{pattern.subtitle}</div>
              <div className="mt-1 text-xs text-white/60">
                Round {round} of {pattern.rounds} · {fmt(total - t)} left
              </div>
            </div>
          </div>
          <Controls
            running={running}
            onToggle={() => {
              setRunning((r) => !r)
              if (!running) sound.play('soft')
            }}
          />
        </>
      )}
    </ImmersiveFrame>
  )
}

/* ---------- Meditation ---------- */

export function MeditationPlayer({
  minutes,
  guide,
  onClose,
}: {
  minutes: number
  guide: { id: string; title: string; cue: string }
  onClose: () => void
}) {
  const me = usePrimaryProfile()
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [elapsed] = useClock(running)
  const sound = useSessionSound()
  useWakeLock(running)
  const total = minutes * 60
  const left = total - elapsed
  const r = 120
  const c = 2 * Math.PI * r

  const lastMinute = useRef(0)
  useEffect(() => {
    const m = Math.floor(elapsed / 60)
    if (running && m > lastMinute.current && elapsed < total) {
      lastMinute.current = m
      if (minutes >= 10 && m % 5 === 0) sound.play('soft') // gentle interval bell every 5 min
    }
  }, [elapsed, running, minutes, total, sound])

  useEffect(() => {
    if (running && elapsed >= total && !done) {
      setRunning(false)
      setDone(true)
      sound.play('bell')
      vibrate([200, 100, 200])
      void logWellness({
        kind: 'meditation',
        routineId: guide.id,
        title: `${guide.title} meditation`,
        durationSec: total,
        profileId: me?.id,
      })
    }
  }, [elapsed, total, running, done, guide, sound, me])

  return (
    <ImmersiveFrame
      title={`${guide.title} · ${minutes} min`}
      onClose={onClose}
      muted={sound.muted}
      onToggleMute={sound.toggle}
    >
      {done ? (
        <Celebrate title={`${guide.title} meditation`} minutes={minutes} onClose={onClose} />
      ) : (
        <>
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="relative grid size-[280px] place-items-center">
              {running && (
                <>
                  <span className="ripple-ring text-white/20" />
                  <span className="ripple-ring text-white/15" style={{ animationDelay: '-1.4s' }} />
                  <span className="ripple-ring text-white/10" style={{ animationDelay: '-2.8s' }} />
                </>
              )}
              <svg width="280" height="280" className="absolute -rotate-90">
                <circle
                  cx="140"
                  cy="140"
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,.12)"
                  strokeWidth="6"
                />
                <circle
                  cx="140"
                  cy="140"
                  r={r}
                  fill="none"
                  stroke="#cfe8d4"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - Math.min(1, elapsed / total))}
                  style={{ transition: 'stroke-dashoffset .2s linear' }}
                />
              </svg>
              <div className="text-center">
                <div
                  className="text-6xl"
                  style={{ animation: running ? 'drift 8s ease-in-out infinite' : undefined }}
                >
                  🧘
                </div>
                <div className="mt-2 text-4xl font-light tabular-nums">{fmt(left)}</div>
              </div>
            </div>
            <p className="mt-8 max-w-sm text-center text-lg leading-relaxed text-white/85">
              {guide.cue}
            </p>
          </div>
          <Controls
            running={running}
            onToggle={() => {
              setRunning((r) => !r)
              if (!running && elapsed === 0) sound.play('bell')
            }}
          />
        </>
      )}
    </ImmersiveFrame>
  )
}

/* ---------- Yoga / exercise routines ---------- */

export function RoutinePlayer({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const me = usePrimaryProfile()
  const [index, setIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [elapsed, reset] = useClock(running)
  const sound = useSessionSound()
  useWakeLock(running)
  const step = routine.steps[index]
  const next = routine.steps[index + 1]
  const left = step.seconds - elapsed
  const r = 54
  const c = 2 * Math.PI * r
  const totalSec = routineSeconds(routine)
  const doneSec =
    routine.steps.slice(0, index).reduce((a, s) => a + s.seconds, 0) +
    Math.min(elapsed, step.seconds)

  const go = (i: number) => {
    if (i >= routine.steps.length) {
      setRunning(false)
      setDone(true)
      sound.play('bell')
      vibrate([200, 100, 200])
      void logWellness({
        kind: routine.kind,
        routineId: routine.id,
        title: routine.title,
        durationSec: totalSec,
        profileId: me?.id,
      })
      return
    }
    setIndex(Math.max(0, i))
    reset(0)
    sound.play(routine.steps[Math.max(0, i)]?.rest ? 'soft' : 'tick')
    vibrate(60)
  }

  useEffect(() => {
    if (running && left <= 0) go(index + 1)
    // countdown ticks for the last 3 seconds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left <= 0, running])

  const lastTick = useRef(0)
  useEffect(() => {
    const s = Math.ceil(left)
    if (running && s <= 3 && s > 0 && s !== lastTick.current) {
      lastTick.current = s
      sound.play('tick')
    }
  }, [left, running, sound])

  return (
    <ImmersiveFrame
      title={routine.title}
      onClose={onClose}
      muted={sound.muted}
      onToggleMute={sound.toggle}
    >
      {done ? (
        <Celebrate title={routine.title} minutes={Math.round(totalSec / 60)} onClose={onClose} />
      ) : (
        <>
          <div
            className="mt-4 h-1 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-valuenow={Math.round((doneSec / totalSec) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i
              className="block h-full rounded-full bg-[#cfe8d4] transition-[width] duration-200"
              style={{ width: `${(doneSec / totalSec) * 100}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-white/60">
            <span>
              Step {index + 1} of {routine.steps.length}
            </span>
            <span>{fmt(totalSec - doneSec)} left</span>
          </div>
          <div
            key={index}
            className="flex flex-1 flex-col items-center justify-center text-center animate-rise"
          >
            <div className="relative mb-6 grid size-44 place-items-center rounded-full bg-white/10 backdrop-blur">
              <svg width="176" height="176" viewBox="0 0 120 120" className="absolute -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,.12)"
                  strokeWidth="4"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={r}
                  fill="none"
                  stroke={step.rest ? '#f4ead2' : '#cfe8d4'}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * Math.max(0, left / step.seconds)}
                  style={{ transition: 'stroke-dashoffset .15s linear' }}
                />
              </svg>
              <span
                className="text-7xl"
                style={{ animation: running ? 'drift 6s ease-in-out infinite' : undefined }}
              >
                {step.emoji}
              </span>
            </div>
            <div className="text-5xl font-light tabular-nums">{fmt(left)}</div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">{step.name}</h2>
            <p className="mt-2 max-w-sm text-white/80">{step.cue}</p>
            {next && (
              <div className="mt-6 rounded-full bg-white/10 px-4 py-2 text-xs text-white/75">
                Up next: {next.emoji} {next.name}
              </div>
            )}
          </div>
          <Controls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onPrev={() => go(index - 1)}
            onNext={() => go(index + 1)}
          />
          <p className="-mt-4 pb-3 text-center text-[10px] text-white/50">
            Move gently and within your comfort. Skip anything that doesn't feel right.
          </p>
        </>
      )}
    </ImmersiveFrame>
  )
}
