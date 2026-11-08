import { useState } from 'react'
import { db } from '@/db/db'
import { loadSampleData, startFresh } from '@/db/seed'
import { REMINDER_PRESETS } from '@/db/reminderPresets'
import { AnimatedBackground } from '@/components/layout/AnimatedBackground'
import { Button, Chip, Input } from '@/components/ui'

const STARTERS = ['water', 'posture', 'footwear', 'stretch', 'yoga', 'meditate']

export function Onboarding() {
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>(['water', 'posture', 'footwear'])
  const [busy, setBusy] = useState(false)

  const begin = async (sample: boolean) => {
    setBusy(true)
    try {
      if (sample) await loadSampleData(name.trim() || 'Alex')
      else await startFresh(name)
      // enable chosen reminders
      const all = await db.reminders.toArray()
      await Promise.all(
        all.map((r) =>
          db.reminders.update(r.id, {
            enabled: picked.includes(r.presetKey ?? ''),
            lastFiredSlot: new Date().toISOString(),
          }),
        ),
      )
      void navigator.storage?.persist?.().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <AnimatedBackground leaves={10} intense />
      <div className="w-full max-w-md text-center animate-rise">
        <img
          src="/favicon.svg"
          alt=""
          className="mx-auto mb-5 size-20 rounded-[26px] shadow-[0_14px_34px_#47765b44]"
        />
        <h1 className="text-[34px] font-bold leading-tight tracking-[-1.3px]">
          Welcome to <span className="shimmer-text">DayNest</span>
        </h1>
        <p className="mt-2 text-muted">
          Plan your day. Build better habits. Keep your family organised — gently.
        </p>

        <div className="mt-8 grid gap-4 rounded-[24px] border border-line bg-surface/90 p-5 text-left shadow-soft backdrop-blur">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted">What should we call you?</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={40}
              autoFocus
            />
          </label>
          <div>
            <div className="mb-2 text-xs font-semibold text-muted">
              Turn on a few gentle reminders
            </div>
            <div className="flex flex-wrap gap-2">
              {REMINDER_PRESETS.filter((p) => STARTERS.includes(p.presetKey!)).map((p) => (
                <Chip
                  key={p.presetKey}
                  active={picked.includes(p.presetKey!)}
                  onClick={() =>
                    setPicked((x) =>
                      x.includes(p.presetKey!)
                        ? x.filter((k) => k !== p.presetKey)
                        : [...x, p.presetKey!],
                    )
                  }
                >
                  {p.emoji} {p.title}
                </Chip>
              ))}
            </div>
          </div>
          <Button onClick={() => begin(false)} disabled={busy}>
            Start fresh
          </Button>
          <Button variant="soft" onClick={() => begin(true)} disabled={busy}>
            Explore with sample family
          </Button>
        </div>
        <p className="mx-auto mt-5 max-w-sm text-[11px] text-muted">
          No account. No cloud. Everything stays on this device — remember to export backups from
          Settings.
        </p>
      </div>
    </div>
  )
}
