import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Reminder } from '@/db/types'
import { db } from '@/db/db'
import { nowIso } from '@/lib/date'
import { canCompleteFromReminder, completeLinked } from '@/db/links'
import { smileLine } from '@/lib/wellness'
import { toast, useUI } from '@/store/ui'
import { cx } from '@/components/ui'

const NIGHT_KEYS = new Set(['phonefree', 'phonefree-soon', 'story', 'meditate', 'sleep'])

/** Picks a playful look for each nudge so they feel friendly, not naggy. */
function nudgeStyle(r: Pick<Reminder, 'presetKey' | 'audience'>) {
  const key = r.presetKey ?? ''
  if (NIGHT_KEYS.has(key))
    return { anim: 'anim-sway', smile: 'night', theme: 'night' as const, party: false }
  if (r.audience === 'kids')
    return { anim: 'anim-wiggle', smile: 'kids', theme: 'kids' as const, party: true }
  if (r.audience === 'family')
    return { anim: 'anim-heartbeat', smile: 'family', theme: 'family' as const, party: true }
  if (key === 'water' || key === 'footwear')
    return { anim: 'anim-hop', smile: key, theme: 'day' as const, party: false }
  if (key === 'posture' || key === 'stretch')
    return { anim: 'anim-sway', smile: 'posture', theme: 'day' as const, party: false }
  return { anim: 'anim-wiggle', smile: 'default', theme: 'day' as const, party: false }
}

const CIRCLE_BG = {
  day: 'bg-white/80',
  kids: 'bg-[#ffd3e0]',
  family: 'bg-[#ffd9c7]',
  night: 'bg-white/10',
}

const THEME_BG = {
  day: 'bg-gradient-to-br from-[#f3f8ef] to-[#e1eee2] text-[#202820]',
  kids: 'bg-gradient-to-br from-[#fff4d9] via-[#ffe9ef] to-[#e8e6ff] text-[#2a2440]',
  family: 'bg-gradient-to-br from-[#fff1e8] to-[#fde3e3] text-[#3b2420]',
  night: 'bg-gradient-to-br from-[#26314f] via-[#1f2a44] to-[#162033] text-white',
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 7) * 0.12}s`,
        color: ['#f2c46b', '#e9a995', '#9cc8aa', '#8fb7d0', '#c7b8ea', '#f59fb5'][i % 6],
      })),
    [],
  )
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={{ left: p.left, animationDelay: p.delay, background: p.color }}
        />
      ))}
    </div>
  )
}

function Stars() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]"
    >
      {[
        [12, 18],
        [80, 12],
        [65, 40],
        [25, 70],
        [88, 62],
        [45, 15],
        [10, 45],
      ].map(([l, t], i) => (
        <span
          key={i}
          className="twinkle text-[10px]"
          style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${i * 0.3}s` }}
        >
          ✦
        </span>
      ))}
    </div>
  )
}

function useActions(r: Reminder) {
  const dismiss = useUI((s) => s.dismissReminder)
  return {
    /** Done on a habit/to-do reminder also completes that item for today. */
    done: async () => {
      dismiss(r.id)
      if (await completeLinked(r)) toast(`${r.title} — done!`, { emoji: '🌟' })
    },
    snooze: async () => {
      await db.reminders.update(r.id, {
        snoozedUntil: new Date(Date.now() + 10 * 60_000).toISOString(),
        updatedAt: nowIso(),
      })
      dismiss(r.id)
    },
  }
}

function HighPriorityNudge({ reminder: r }: { reminder: Reminder }) {
  const style = nudgeStyle(r)
  const line = useMemo(() => smileLine(style.smile), [style.smile])
  const { done, snooze } = useActions(r)
  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-[#10181399] p-6 backdrop-blur-sm animate-fade"
      role="alertdialog"
      aria-modal="true"
      aria-label={r.title}
    >
      <div
        className={cx(
          'relative w-full max-w-[360px] overflow-hidden rounded-[28px] p-6 text-center shadow-2xl anim-zoom-pop',
          THEME_BG[style.theme],
        )}
      >
        {style.party && <Confetti />}
        {style.theme === 'night' && <Stars />}
        <div className="relative">
          <div
            className={cx(
              'mx-auto mb-3 grid size-24 place-items-center rounded-full text-6xl',
              CIRCLE_BG[style.theme],
              style.anim,
            )}
          >
            {r.emoji}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest opacity-60">
            Important · now
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{r.title}</h2>
          <p className="mt-2 text-sm opacity-80">{r.message}</p>
          <p className="mt-3 text-sm font-semibold">{line}</p>
          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={done}
              className={cx(
                'min-h-12 rounded-2xl font-bold shadow-lg transition active:scale-95',
                style.theme === 'night' ? 'bg-white text-[#1f2a44]' : 'bg-sage text-white',
              )}
            >
              {canCompleteFromReminder(r) ? 'Mark done ✓' : 'Done ✓'}
            </button>
            <button
              type="button"
              onClick={snooze}
              className="min-h-11 rounded-2xl text-sm font-semibold opacity-75 hover:opacity-100"
            >
              Remind me in 10 min
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function GentleNudge({ reminder: r }: { reminder: Reminder }) {
  const style = nudgeStyle(r)
  const line = useMemo(() => smileLine(style.smile), [style.smile])
  const { done, snooze } = useActions(r)
  const dismiss = useUI((s) => s.dismissReminder)
  useEffect(() => {
    // gentle nudges fade away on their own (without completing anything)
    const t = setTimeout(() => dismiss(r.id), 90_000)
    return () => clearTimeout(t)
  }, [dismiss, r.id])
  return (
    <div
      role="alert"
      className={cx(
        'relative overflow-hidden rounded-[22px] p-3.5 shadow-xl anim-drop-in',
        THEME_BG[style.theme],
      )}
    >
      {style.party && <Confetti />}
      {style.theme === 'night' && <Stars />}
      <div className="relative flex items-start gap-3">
        <div
          className={cx(
            'grid size-12 shrink-0 place-items-center rounded-2xl text-3xl',
            CIRCLE_BG[style.theme],
            style.anim,
          )}
        >
          {r.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{r.title}</div>
          <div className="text-xs opacity-75">{r.message}</div>
          <div className="mt-1 text-xs font-semibold">{line}</div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={cx(
                'min-h-9 rounded-lg px-3 text-xs font-bold',
                style.theme === 'night' ? 'bg-white text-[#1f2a44]' : 'bg-sage text-white',
              )}
              onClick={done}
            >
              {canCompleteFromReminder(r) ? 'Mark done ✓' : 'Done ✓'}
            </button>
            <button
              type="button"
              className="min-h-9 rounded-lg bg-white/40 px-3 text-xs font-bold"
              onClick={snooze}
            >
              Snooze 10 min
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="grid size-9 place-items-center rounded-lg opacity-60 hover:opacity-100"
          onClick={done}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

/** Shows nudges when they fire while DayNest is open. */
export function NudgeHost() {
  const active = useUI((s) => s.activeReminders)
  const high = active.filter((a) => a.reminder.priority === 'high')
  const gentle = active.filter((a) => a.reminder.priority !== 'high')
  return (
    <>
      {gentle.length > 0 && (
        <div
          className="fixed inset-x-0 top-3 z-50 mx-auto grid w-full max-w-[480px] gap-2 px-3"
          aria-live="polite"
        >
          {gentle.map(({ reminder }) => (
            <GentleNudge key={reminder.id} reminder={reminder} />
          ))}
        </div>
      )}
      {high.length > 0 && (
        <HighPriorityNudge
          key={high[high.length - 1].reminder.id}
          reminder={high[high.length - 1].reminder}
        />
      )}
    </>
  )
}
