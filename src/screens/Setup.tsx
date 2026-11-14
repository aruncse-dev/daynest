import { CloudFlow } from '@/components/CloudCard'
import { googleConfigured } from '@/lib/cloud/google'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { setSetting } from '@/db/actions'
import { SETTING_ONBOARDED } from '@/db/keys'
import { addMembers, applySuggestions, ensureProfile } from '@/db/setup'
import { ROLES, type FamilyRole } from '@/lib/family'
import { suggest, type SetupAnswers, type Suggestion } from '@/lib/suggest'
import { FOCUS_AREAS, type FocusArea } from '@/lib/templates'
import { useMembers, usePrimaryProfile, useSetting } from '@/lib/hooks'
import { AnimatedBackground } from '@/components/layout/AnimatedBackground'
import { Button, Input, Toggle, cx } from '@/components/ui'
import { Tour } from '@/components/Tour'

type Step = 'welcome' | 'you' | 'family' | 'focus' | 'rhythm' | 'pick' | 'done'
const ME_AVATARS = ['🙂', '😊', '👩', '👨', '🧔', '👱‍♀️']
const VALID = new Set(FOCUS_AREAS.map((f) => f.key))

export function Setup({ onboarding = false }: { onboarding?: boolean }) {
  const navigate = useNavigate()
  const me = usePrimaryProfile()
  const saved = useSetting<SetupAnswers | null>('setupAnswers', null)
  const steps: Step[] = [
    ...(onboarding ? (['welcome'] as Step[]) : []),
    'you',
    'family',
    'focus',
    'rhythm',
    'pick',
    'done',
  ]
  const [step, setStep] = useState<Step>(steps[0])
  const [tour, setTour] = useState(false)
  const [name, setName] = useState(me?.name ?? '')
  const [avatar, setAvatar] = useState(me?.avatar ?? '')
  const [areas, setAreas] = useState<FocusArea[]>(
    (saved?.areas ?? ['organised', 'digital']).filter((a) => VALID.has(a)),
  )
  const [wake, setWake] = useState(saved?.wake ?? '06:30')
  const [phoneFree, setPhoneFree] = useState(saved ? !!saved.phoneFreeAt : true)
  const [phoneFreeAt, setPhoneFreeAt] = useState(saved?.phoneFreeAt ?? '22:00')
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [busy, setBusy] = useState(false)
  const members = useMembers()
  const [drafts, setDrafts] = useState<{ name: string; role: FamilyRole }[]>([])
  const [created, setCreated] = useState(0)

  const answers: SetupAnswers = { areas, wake, phoneFreeAt: phoneFree ? phoneFreeAt : null }
  const suggestions = suggest(answers) // cheap and pure
  const chosen = picked ?? new Set(suggestions.filter((s) => s.recommended).map((s) => s.id))
  const idx = steps.indexOf(step)
  const go = (d: number) => setStep(steps[Math.max(0, Math.min(steps.length - 1, idx + d))])

  const finish = async () => {
    setBusy(true)
    try {
      const meId = await ensureProfile(name, avatar)
      await addMembers(drafts)
      setCreated(
        await applySuggestions(
          suggestions.filter((s) => chosen.has(s.id)),
          answers,
          meId,
        ),
      )
      setStep('done')
    } finally {
      setBusy(false)
    }
  }
  const enterApp = async () => {
    await setSetting(SETTING_ONBOARDED, true)
    if (!onboarding) navigate('/')
  }
  const progressSteps = steps.filter((s) => s !== 'welcome' && s !== 'done')

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-[var(--bg)]">
      <AnimatedBackground leaves={8} intense />
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col px-5 pt-[max(18px,env(safe-area-inset-top))]">
        {step !== 'welcome' && step !== 'done' && (
          <div
            className="mb-4 flex items-center gap-1.5"
            aria-label={`Step ${progressSteps.indexOf(step) + 1} of ${progressSteps.length}`}
          >
            {progressSteps.map((s) => (
              <span
                key={s}
                className={cx(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  steps.indexOf(s) <= idx ? 'bg-sage' : 'bg-line',
                )}
              />
            ))}
            {!onboarding && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="ml-2 text-xs font-semibold text-muted"
              >
                Close
              </button>
            )}
          </div>
        )}
        <div key={step} className="-mx-2 flex-1 overflow-y-auto px-2 pb-4 pt-3 animate-rise">
          {step === 'welcome' && <Welcome onStart={() => go(1)} onTour={() => setTour(true)} />}
          {step === 'you' && (
            <StepShell
              emoji="👋"
              title="Let's set up your day"
              sub="First, what should we call you?"
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={40}
                autoFocus
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {[name.trim()[0]?.toUpperCase() ?? 'A', ...ME_AVATARS].map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={avatar === a}
                    onClick={() => setAvatar(a)}
                    className={cx(
                      'grid size-12 place-items-center rounded-full bg-[#dce9dc] text-xl transition',
                      avatar === a && 'ring-2 ring-sage ring-offset-2 ring-offset-[var(--bg)]',
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </StepShell>
          )}
          {step === 'family' && (
            <StepShell
              emoji="🏡"
              title="Do you keep track of family too?"
              sub="Optional. Add your spouse, kids or parents to track their routines, activities and appointments on this phone. Nothing is shared."
            >
              {members.length > 0 && (
                <p className="mb-3 text-xs text-muted">
                  Already added: {members.map((m) => m.name).join(', ')}
                </p>
              )}
              <div className="grid gap-2">
                {drafts.map((d, i) => {
                  const r = ROLES.find((x) => x.value === d.role)!
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-2"
                    >
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-full text-xl"
                        style={{ background: r.color }}
                      >
                        {r.avatar}
                      </span>
                      <Input
                        value={d.name}
                        onChange={(e) =>
                          setDrafts(
                            drafts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                          )
                        }
                        placeholder={`${r.label} name`}
                        aria-label={`${r.label} name`}
                        maxLength={30}
                        autoFocus
                      />
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
                        className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface2"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {ROLES.filter((r) => r.value !== 'other').map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setDrafts([...drafts, { name: '', role: r.value }])}
                    className="grid justify-items-center gap-1 rounded-2xl border border-dashed border-sage-line bg-surface/70 py-3 text-xs font-semibold text-sage-ink active:scale-95"
                  >
                    <span className="text-2xl">{r.avatar}</span>+{' '}
                    {r.value === 'spouse' ? 'Spouse' : r.label}
                  </button>
                ))}
              </div>
            </StepShell>
          )}
          {step === 'focus' && (
            <StepShell
              emoji="🎯"
              title="What would help you most?"
              sub="Pick one or more. We'll suggest a few simple habits and reminders."
            >
              <div className="grid grid-cols-2 gap-2">
                {FOCUS_AREAS.map((f) => {
                  const on = areas.includes(f.key)
                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setAreas(on ? areas.filter((a) => a !== f.key) : [...areas, f.key])
                        setPicked(null)
                      }}
                      className={cx(
                        'relative rounded-2xl border p-3 text-left transition active:scale-[.97]',
                        on ? 'border-sage bg-sage-soft' : 'border-line bg-surface',
                      )}
                    >
                      {on && (
                        <Check size={16} className="absolute right-2.5 top-2.5 text-sage-ink" />
                      )}
                      <div className="text-2xl">{f.emoji}</div>
                      <div className="mt-1 text-sm font-bold">{f.label}</div>
                      <div className="text-[11px] text-muted">{f.hint}</div>
                    </button>
                  )
                })}
              </div>
            </StepShell>
          )}
          {step === 'rhythm' && (
            <StepShell
              emoji="⏰"
              title="Your daily rhythm"
              sub="So reminders arrive at the right moments."
            >
              <div className="grid gap-3">
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
                  <span className="text-sm font-semibold">☀️ I usually wake up at</span>
                  <Input
                    type="time"
                    value={wake}
                    onChange={(e) => e.target.value && setWake(e.target.value)}
                    className="!w-32"
                  />
                </label>
                <div className="rounded-2xl bg-gradient-to-br from-[#2f3d63] to-[#1c2640] p-4 text-white">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl anim-sway">🌙</span>
                    <span className="flex-1 text-sm font-semibold">
                      No phone after a set time at night
                    </span>
                    <Toggle
                      checked={phoneFree}
                      onChange={(v) => {
                        setPhoneFree(v)
                        setPicked(null)
                      }}
                      label="Phone-free nights"
                    />
                  </div>
                  {phoneFree && (
                    <label className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className="text-white/80">Phone down at</span>
                      <Input
                        type="time"
                        value={phoneFreeAt}
                        onChange={(e) => e.target.value && setPhoneFreeAt(e.target.value)}
                        className="!w-32 !border-white/20 !bg-white/10 !text-white"
                      />
                    </label>
                  )}
                </div>
              </div>
            </StepShell>
          )}
          {step === 'pick' && (
            <PickStep suggestions={suggestions} chosen={chosen} onChange={setPicked} />
          )}
          {step === 'done' && (
            <div className="grid h-full place-items-center text-center">
              <div>
                <div className="relative mx-auto mb-4 grid size-32 place-items-center">
                  <span className="ripple-ring text-sage/40" />
                  <span className="ripple-ring text-sage/30" style={{ animationDelay: '-1.5s' }} />
                  <span className="text-6xl anim-hop">🎉</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">You're all set!</h1>
                <p className="mt-2 text-muted">
                  {created} habits, reminders and to-dos are ready. Change anything, anytime.
                </p>
                <Button className="mt-8 w-full" onClick={enterApp}>
                  Let's go 🌿
                </Button>
              </div>
            </div>
          )}
        </div>
        {step !== 'welcome' && step !== 'done' && (
          <div className="flex gap-2 pb-safe pt-2 sm:pb-5">
            {idx > (onboarding ? 1 : 0) && (
              <Button variant="outline" onClick={() => go(-1)}>
                Back
              </Button>
            )}
            {step === 'pick' ? (
              <Button className="flex-1" disabled={busy} onClick={finish}>
                {chosen.size ? `Create ${chosen.size} items ✨` : 'Skip — start empty'}
              </Button>
            ) : (
              <Button
                className="flex-1"
                disabled={step === 'you' && !name.trim()}
                onClick={() => go(1)}
              >
                {step === 'family' && !drafts.some((d) => d.name.trim()) ? 'Skip for now' : 'Next'}
              </Button>
            )}
          </div>
        )}
      </div>
      {tour && <Tour onClose={() => setTour(false)} finishLabel="Got it" />}
    </div>
  )
}

function StepShell({
  emoji,
  title,
  sub,
  children,
}: {
  emoji: string
  title: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3 inline-block py-1 text-4xl leading-none anim-wiggle [animation-iteration-count:1]">
        {emoji}
      </div>
      <h1 className="text-[26px] font-bold leading-tight tracking-[-1px]">{title}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{sub}</p>
      {children}
    </div>
  )
}

function Welcome({ onStart, onTour }: { onStart: () => void; onTour: () => void }) {
  const [google, setGoogle] = useState(false)
  return (
    <div className="grid h-full place-items-center text-center">
      <div className="w-full">
        <img
          src="/favicon.svg"
          alt=""
          className="mx-auto mb-5 size-20 rounded-[26px] shadow-[0_14px_34px_#47765b44] anim-hop [animation-iteration-count:2]"
        />
        <h1 className="text-[34px] font-bold leading-tight tracking-[-1.3px]">
          Welcome to <span className="shimmer-text">DayNest</span>
        </h1>
        <p className="mt-2 text-muted">Your day, habits and family. 🌿</p>

        <div className="mt-7 grid gap-2.5 text-left">
          <ModeButton
            icon="📱"
            title="Phone mode"
            points={['Just this phone', 'No sign-in']}
            onClick={onStart}
          />
          {googleConfigured() && (
            <ModeButton
              icon="☁️"
              title="Google mode"
              points={['Sign in with Google', 'Encrypted backup', 'More phones']}
              onClick={() => setGoogle(true)}
            />
          )}
        </div>
        <button type="button" onClick={onTour} className="mt-4 text-sm font-semibold text-sage-ink">
          ▶️ 30-second tour
        </button>
        {googleConfigured() && (
          <p className="mt-1 text-[11px] text-muted">Change mode anytime in Settings</p>
        )}
        {/* Google: an existing family copy opens straight into the app; a new one continues setup */}
        {google && (
          <CloudFlow
            restore
            onDone={(kind) => kind === 'created' && onStart()}
            onClose={() => setGoogle(false)}
          />
        )}
      </div>
    </div>
  )
}

function ModeButton({
  icon,
  title,
  points,
  onClick,
}: {
  icon: string
  title: string
  points: string[]
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5 text-left shadow-sm transition active:scale-[.98]"
    >
      <span className="text-3xl leading-none">{icon}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-[16px]">{title}</b>
        <span className="block text-xs text-muted">{points.join(' · ')}</span>
      </span>
      <span className="text-lg text-muted">›</span>
    </button>
  )
}

const KIND_LABEL = { habit: 'Habit', nudge: 'Reminder', task: 'Repeating to-do' }
const AREA_NOTE: Partial<Record<FocusArea, string>> = {
  health:
    "Only pick what already suits you. DayNest doesn't give health advice; ask a doctor before starting something new.",
  calm: 'Simple ideas, not instructions. Make them your own.',
}

function PickStep({
  suggestions,
  chosen,
  onChange,
}: {
  suggestions: Suggestion[]
  chosen: Set<string>
  onChange: (s: Set<string>) => void
}) {
  const toggle = (id: string) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }
  const groups = FOCUS_AREAS.map((f) => ({
    ...f,
    items: suggestions.filter((s) => s.area === f.key),
  })).filter((g) => g.items.length)
  return (
    <StepShell
      emoji="✨"
      title="Here's what we suggest"
      sub="A few are ticked to start. Untick anything that doesn't fit — you can add more later."
    >
      <div className="grid gap-4">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
              {g.emoji} {g.label}
            </h2>
            {AREA_NOTE[g.key] && (
              <p className="mb-1.5 text-[11px] text-muted">{AREA_NOTE[g.key]}</p>
            )}
            <div className="grid gap-1.5">
              {g.items.map((s) => {
                const on = chosen.has(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(s.id)}
                    className={cx(
                      'flex items-center gap-3 rounded-2xl border p-2.5 text-left transition',
                      on ? 'border-sage bg-surface' : 'border-line bg-surface/60',
                    )}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface2 text-xl">
                      {s.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{s.title}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {KIND_LABEL[s.kind]} · {s.detail}
                      </span>
                    </span>
                    <span
                      className={cx(
                        'grid size-6 shrink-0 place-items-center rounded-lg border-[1.5px] transition',
                        on ? 'border-sage bg-sage text-white' : 'border-[#cbd4c9]',
                      )}
                    >
                      {on && <Check size={14} strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </StepShell>
  )
}
