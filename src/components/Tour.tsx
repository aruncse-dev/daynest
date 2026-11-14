import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { cx } from './ui'

/**
 * A 30-second, auto-playing tour with made-up examples (nothing is saved).
 * Works like "stories": tap right for next, left for back.
 */
const SCENE_MS = 5200

/** Count up 0..max once per `ms` while mounted (drives the little demo animations). */
function useTicker(max: number, ms: number) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((x) => Math.min(max, x + 1)), ms)
    return () => clearInterval(id)
  }, [max, ms])
  return n
}

function MockCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'w-full rounded-[20px] bg-white p-4 text-left text-[#202820] shadow-2xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

function DayScene() {
  const done = useTicker(3, 1000)
  const items = [
    { t: 'Pay electricity bill', m: 'To-do · 10:00 AM' },
    { t: 'Drink water', m: 'Habit · 🔥 5 days', e: '💧' },
    { t: 'Call the bank', m: 'To-do · Today' },
    { t: 'Plan tomorrow', m: 'Habit', e: '📝' },
  ]
  return (
    <MockCard>
      <div className="mb-2 text-xs font-bold text-[#6f786f]">
        My day · {Math.min(done, 3)}/4 done
      </div>
      {items.map((it, i) => {
        const on = i < done
        return (
          <div
            key={it.t}
            className="flex items-center gap-3 border-b border-[#f0f2ee] py-2 last:border-0"
          >
            <span
              className={cx(
                'grid size-6 place-items-center rounded-lg border-[1.5px] transition-all duration-300',
                on ? 'scale-110 border-[#47765b] bg-[#47765b] text-white' : 'border-[#cbd4c9]',
              )}
            >
              {on && <Check size={14} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cx(
                  'block truncate text-sm font-semibold transition-colors',
                  on && 'text-[#9aa39a] line-through',
                )}
              >
                {it.e} {it.t}
              </span>
              <span className="block text-[11px] text-[#6f786f]">{it.m}</span>
            </span>
          </div>
        )
      })}
    </MockCard>
  )
}

function HabitScene() {
  const n = useTicker(6, 650)
  const rows = [
    { e: '🚶', t: 'Go for a walk', s: 3 + Math.min(n, 4) },
    { e: '📖', t: 'Read', s: 1 + Math.min(n, 2) },
    { e: '🙏', t: 'Note one good thing', s: 8 + Math.min(n, 6) },
  ]
  return (
    <MockCard>
      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.t} className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#e4eee5] text-xl">
              {r.e}
            </span>
            <span className="flex-1 text-sm font-semibold">{r.t}</span>
            <span
              key={r.s}
              className="rounded-full bg-[#f4ead2] px-2.5 py-1 text-xs font-bold text-[#8a6a32] animate-pop"
            >
              🔥 {r.s}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className={cx(
              'aspect-square rounded-md transition-colors duration-500',
              i < 6 + n ? 'bg-[#47765b]' : 'bg-[#eef1eb]',
            )}
          />
        ))}
      </div>
    </MockCard>
  )
}

function NudgeScene() {
  const step = useTicker(2, 1700)
  return (
    <div className="grid w-full gap-3">
      {step >= 0 && (
        <div className="flex items-center gap-3 rounded-[20px] bg-gradient-to-br from-[#f3f8ef] to-[#e1eee2] p-3.5 text-left text-[#202820] shadow-2xl anim-drop-in">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/80 text-3xl anim-hop">
            💧
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-sm">Drink water</b>
            <span className="block text-xs text-[#5d675e]">Hydration hero! 💪</span>
          </span>
          <span className="rounded-lg bg-[#47765b] px-3 py-1.5 text-xs font-bold text-white">
            Done ✓
          </span>
        </div>
      )}
      {step >= 1 && (
        <div className="flex items-center gap-3 rounded-[20px] bg-gradient-to-br from-[#f3f8ef] to-[#e1eee2] p-3.5 text-left text-[#202820] shadow-2xl anim-drop-in">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/80 text-3xl anim-sway">
            🪑
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-sm">Sit straight</b>
            <span className="block text-xs text-[#5d675e]">Shoulders back, superstar ⭐</span>
          </span>
        </div>
      )}
      {step >= 2 && (
        <div className="rounded-[20px] bg-white p-4 text-center text-[#202820] shadow-2xl anim-zoom-pop">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#9a604d]">
            Important · stays until you tap Done
          </div>
          <div className="mt-1 text-sm font-bold">🧾 Pay the rent today</div>
        </div>
      )}
    </div>
  )
}

function NightScene() {
  return (
    <div className="relative w-full overflow-hidden rounded-[24px] bg-gradient-to-br from-[#2f3d63] to-[#1c2640] p-6 text-center text-white shadow-2xl">
      {[
        [12, 15],
        [85, 12],
        [70, 60],
        [20, 70],
        [50, 25],
      ].map(([l, t], i) => (
        <span
          key={i}
          aria-hidden
          className="twinkle text-xs"
          style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${i * 0.3}s` }}
        >
          ✦
        </span>
      ))}
      <div className="text-6xl anim-sway">🌙</div>
      <div className="mt-2 text-2xl font-bold">10:00 PM</div>
      <div className="text-sm text-white/80">Phone down, heart up</div>
      <div className="mt-4 flex justify-center gap-1.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span
            key={i}
            className={cx(
              'grid size-8 place-items-center rounded-full text-xs',
              i < 5 ? 'bg-white/20' : 'bg-white/5',
            )}
          >
            {i < 5 ? '🌙' : d}
          </span>
        ))}
      </div>
    </div>
  )
}

function PrivateScene() {
  return (
    <MockCard className="text-center">
      <div className="mx-auto mb-2 grid size-16 place-items-center rounded-2xl bg-[#e4eee5] text-4xl anim-hop [animation-iteration-count:2]">
        🔒
      </div>
      <ul className="grid gap-2 text-left text-sm">
        <li>📱 Saved only on this phone</li>
        <li>🙅 No account, no ads, no tracking</li>
        <li>💾 Back up to a file whenever you like</li>
      </ul>
    </MockCard>
  )
}

const SCENES = [
  {
    title: 'Your day in one list',
    sub: 'To-dos and habits together. Tick them off, one by one.',
    Body: DayScene,
  },
  {
    title: 'Habits you choose',
    sub: 'Track what matters to you, at your own pace. Watch your streaks grow.',
    Body: HabitScene,
  },
  {
    title: 'Friendly reminders',
    sub: 'Gentle reminders that make you smile. Important ones stay until you tap Done.',
    Body: NudgeScene,
  },
  {
    title: 'Phone-free evenings',
    sub: 'Pick a time to put the phone down. DayNest reminds you, kindly.',
    Body: NightScene,
  },
  {
    title: 'Private by design',
    sub: 'The app loads from the web. Your data never leaves your phone.',
    Body: PrivateScene,
  },
]

export function Tour({
  onClose,
  finishLabel = 'Got it',
}: {
  onClose: () => void
  finishLabel?: string
}) {
  const [i, setI] = useState(0)
  const last = i === SCENES.length - 1
  useEffect(() => {
    if (last) return
    const t = setTimeout(() => setI((x) => x + 1), SCENE_MS)
    return () => clearTimeout(t)
  }, [i, last])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => Math.min(SCENES.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const { title, sub, Body } = SCENES[i]

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="DayNest tour"
      className="fixed inset-0 z-[80] overflow-hidden bg-[radial-gradient(ellipse_at_top,#5f9473_0%,#3a6650_55%,#1f3a2b_100%)] text-white animate-fade"
    >
      <div className="mx-auto flex h-full max-w-[480px] flex-col px-5 pb-safe pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex gap-1.5" aria-hidden>
          {SCENES.map((_, k) => (
            <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <i
                key={`${k}-${i}`}
                className="block h-full bg-white"
                style={{
                  width: k < i ? '100%' : k > i ? '0%' : undefined,
                  animation:
                    k === i && !last ? `tour-fill ${SCENE_MS}ms linear forwards` : undefined,
                  ...(k === i && last ? { width: '100%' } : {}),
                }}
              />
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
            Example · nothing is saved
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tour"
            className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <X size={18} />
          </button>
        </div>
        <div className="relative flex flex-1 flex-col justify-center">
          <button
            type="button"
            aria-label="Previous"
            className="absolute inset-y-0 left-0 z-10 w-1/4"
            onClick={() => setI((x) => Math.max(0, x - 1))}
          />
          <button
            type="button"
            aria-label="Next"
            className="absolute inset-y-0 right-0 z-10 w-1/4"
            onClick={() => setI((x) => Math.min(SCENES.length - 1, x + 1))}
          />
          <div key={i} className="animate-rise">
            <h2 className="text-[28px] font-bold leading-tight tracking-[-0.2px]">{title}</h2>
            <p className="mt-2 text-white/80">{sub}</p>
            <div className="mt-6 flex justify-center">
              <Body />
            </div>
          </div>
        </div>
        <div className="pb-4 pt-2">
          {last ? (
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 w-full rounded-2xl bg-white font-bold text-[#2d5440] shadow-xl transition active:scale-95"
            >
              {finishLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 w-full rounded-2xl text-sm font-semibold text-white/75 hover:text-white"
            >
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
