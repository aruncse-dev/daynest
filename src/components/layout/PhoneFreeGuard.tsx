import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_QUIET, isQuietTime, QUIET_KEY, type QuietHours } from '@/lib/quietHours'
import { useNow, usePrimaryProfile, useSetting } from '@/lib/hooks'
import { formatShort } from '@/lib/suggest'

/**
 * If DayNest is opened during phone-free time, gently remind the user of their own choice.
 * A web app can't lock the phone — this is encouragement, with an honest "I need it" escape.
 */
export function PhoneFreeGuard() {
  const quiet = useSetting<QuietHours>(QUIET_KEY, DEFAULT_QUIET)
  const now = useNow(30_000)
  const me = usePrimaryProfile()
  const [allowUntil, setAllowUntil] = useState(0)
  const [goodnight, setGoodnight] = useState(false)
  if (!isQuietTime(quiet, now) || now.getTime() < allowUntil) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Phone-free time"
      className="fixed inset-0 z-[70] grid place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_top,#2f3d63_0%,#1c2640_55%,#0f1626_100%)] p-6 text-center text-white animate-fade"
    >
      {[
        [10, 12],
        [82, 8],
        [70, 30],
        [20, 40],
        [90, 50],
        [40, 18],
        [55, 65],
        [8, 75],
        [78, 82],
      ].map(([l, t], i) => (
        <span
          key={i}
          aria-hidden
          className="twinkle text-xs"
          style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${i * 0.25}s` }}
        >
          ✦
        </span>
      ))}
      <div className="relative max-w-sm">
        <div className="mx-auto mb-5 text-7xl anim-sway">🌙</div>
        {goodnight ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight">
              Sleep well{me ? `, ${me.name.replace(' (sample)', '')}` : ''}
            </h1>
            <p className="mt-3 text-white/75">
              Put the phone on its charger, away from your bed. See you in the morning ☀️
            </p>
            <button
              type="button"
              onClick={() => setAllowUntil(Date.now() + 5 * 60_000)}
              className="mt-10 text-xs text-white/50 underline underline-offset-4"
            >
              I need it for something important
            </button>
          </>
        ) : (
          <>
            <div className="text-xs font-bold uppercase tracking-widest text-white/60">
              Phone-free time
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              It's past {formatShort(quiet.start)} 💛
            </h1>
            <p className="mt-3 text-white/80">
              You chose a phone-free evening. Your family, your eyes and tomorrow-you will thank
              you.
            </p>
            <div className="mt-8 grid gap-2">
              <button
                type="button"
                onClick={() => setGoodnight(true)}
                className="min-h-12 rounded-2xl bg-white font-bold text-[#1c2640] shadow-xl transition active:scale-95"
              >
                Okay, goodnight 🌙
              </button>
              <button
                type="button"
                onClick={() => setAllowUntil(Date.now() + 5 * 60_000)}
                className="min-h-11 rounded-2xl text-sm font-semibold text-white/70 hover:text-white"
              >
                Just 5 minutes — it's important
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
