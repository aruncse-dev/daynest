import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Trash2 } from 'lucide-react'
import { setSetting } from '@/db/actions'
import { SETTING_FAMILY, SETTING_ONBOARDED } from '@/db/keys'
import { applySuggestions, ensureProfiles, type MemberDraft } from '@/db/setup'
import { suggest, type SetupAnswers, type Suggestion } from '@/lib/suggest'
import { FOCUS_AREAS, type FocusArea } from '@/lib/templates'
import { useFamilyMode, usePrimaryProfile, useProfiles, useSetting } from '@/lib/hooks'
import { Tour } from '@/components/Tour'
import { AnimatedBackground } from '@/components/layout/AnimatedBackground'
import { Avatar, Button, Chip, Input, Toggle, cx } from '@/components/ui'

type Step = 'welcome' | 'you' | 'family' | 'focus' | 'rhythm' | 'pick' | 'done'
const COLORS = ['#f0dfdf', '#e6e2f1', '#dfeaf0', '#f4ead2', '#e0efe9', '#f2e3ec']
const ME_AVATARS = ['🙂', '😊', '👩', '👨', '🧔', '👱‍♀️']

export function Setup({ onboarding = false }: { onboarding?: boolean }) {
  const navigate = useNavigate()
  const me = usePrimaryProfile()
  const existing = useProfiles() ?? []
  const saved = useSetting<SetupAnswers | null>('setupAnswers', null)
  const familyMode = useFamilyMode()
  const [forFamily, setForFamily] = useState(familyMode)
  const steps: Step[] = [
    ...(onboarding ? (['welcome'] as Step[]) : []),
    'you',
    ...(forFamily ? (['family'] as Step[]) : []),
    'focus',
    'rhythm',
    'pick',
    'done',
  ]
  const [step, setStep] = useState<Step>(steps[0])
  const [tour, setTour] = useState(false)
  const [name, setName] = useState(me?.name ?? '')
  const [avatar, setAvatar] = useState(me?.avatar ?? '')
  const [members, setMembers] = useState<MemberDraft[]>([])
  const [areas, setAreas] = useState<FocusArea[]>(saved?.areas ?? ['digital', 'home'])
  const [wake, setWake] = useState(saved?.wake ?? '06:30')
  const [phoneFree, setPhoneFree] = useState(saved ? !!saved.phoneFreeAt : true)
  const [phoneFreeAt, setPhoneFreeAt] = useState(saved?.phoneFreeAt ?? '22:00')
  const [worksWeekdays, setWorks] = useState(saved?.worksWeekdays ?? true)
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(0)

  const hasKids =
    members.some((m) => m.kind === 'child' && m.name.trim()) ||
    existing.some((p) => p.role === 'Child')
  const answers: SetupAnswers = {
    areas,
    hasKids,
    wake,
    phoneFreeAt: phoneFree ? phoneFreeAt : null,
    worksWeekdays,
  }
  const suggestions = suggest(answers) // cheap, pure
  const chosen = picked ?? new Set(suggestions.filter((s) => s.recommended).map((s) => s.id))
  const idx = steps.indexOf(step)
  const go = (d: number) => setStep(steps[Math.max(0, Math.min(steps.length - 1, idx + d))])

  const finish = async () => {
    setBusy(true)
    try {
      await setSetting(SETTING_FAMILY, forFamily)
      const ids = await ensureProfiles(name, avatar, forFamily ? members : [])
      const n = await applySuggestions(
        suggestions.filter((s) => chosen.has(s.id)),
        answers,
        ids,
      )
      setCreated(n)
      setStep('done')
    } finally {
      setBusy(false)
    }
  }
  const enterApp = async () => {
    await setSetting(SETTING_ONBOARDED, true)
    if (!onboarding) navigate('/')
  }

  const canNext = step !== 'you' || name.trim().length > 0

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-[var(--bg)]">
      <AnimatedBackground leaves={8} intense />
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col px-5 pt-[max(18px,env(safe-area-inset-top))]">
        {step !== 'welcome' && step !== 'done' && (
          <div
            className="mb-4 flex items-center gap-1.5"
            aria-label={`Step ${idx} of ${steps.length - 2}`}
          >
            {steps
              .filter((s) => s !== 'welcome' && s !== 'done')
              .map((s) => (
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
        <div key={step} className="flex-1 overflow-y-auto pb-4 animate-rise">
          {step === 'welcome' && <Welcome onStart={() => go(1)} onTour={() => setTour(true)} />}
          {step === 'you' && (
            <StepShell
              emoji="👋"
              title="Let's set up your nest"
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
              <label className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
                <span className="text-sm">
                  <b>I also plan for my family</b>
                  <span className="block text-xs text-muted">
                    Optional. DayNest is mainly for your own day.
                  </span>
                </span>
                <Toggle
                  checked={forFamily}
                  onChange={setForFamily}
                  label="I also plan for my family"
                />
              </label>
            </StepShell>
          )}
          {step === 'family' && (
            <StepShell
              emoji="🏡"
              title="Who's in your family?"
              sub="Add the people you plan with. Kids don't need phones or accounts — they're just profiles here. You can skip this."
            >
              {existing.filter((p) => !p.isPrimary).length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {existing
                    .filter((p) => !p.isPrimary)
                    .map((p) => (
                      <span
                        key={p.id}
                        className="flex items-center gap-1.5 rounded-full bg-surface px-2 py-1 text-xs"
                      >
                        <Avatar avatar={p.avatar} color={p.color} size={22} /> {p.name}
                      </span>
                    ))}
                </div>
              )}
              <div className="grid gap-3">
                {members.map((m, i) => (
                  <div key={i} className="rounded-2xl border border-line bg-surface p-3">
                    <div className="flex gap-2">
                      <Input
                        value={m.name}
                        onChange={(e) =>
                          setMembers(
                            members.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    name: e.target.value,
                                    avatar:
                                      x.kind === 'child'
                                        ? x.avatar
                                        : (e.target.value[0]?.toUpperCase() ?? 'A'),
                                  }
                                : x,
                            ),
                          )
                        }
                        placeholder="Name"
                        maxLength={30}
                        aria-label={`Member ${i + 1} name`}
                      />
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => setMembers(members.filter((_, j) => j !== i))}
                        className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface2"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-2 flex gap-2">
                      {(['partner', 'child', 'other'] as const).map((k) => (
                        <Chip
                          key={k}
                          active={m.kind === k}
                          onClick={() =>
                            setMembers(
                              members.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      kind: k,
                                      role:
                                        k === 'child'
                                          ? 'Child'
                                          : k === 'partner'
                                            ? 'Partner'
                                            : 'Family',
                                      avatar:
                                        k === 'child'
                                          ? i % 2
                                            ? '👦'
                                            : '👧'
                                          : (x.name[0]?.toUpperCase() ?? 'A'),
                                    }
                                  : x,
                              ),
                            )
                          }
                        >
                          {k === 'partner' ? '💑 Partner' : k === 'child' ? '🧒 Child' : '👵 Other'}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
                <Button
                  variant="soft"
                  onClick={() =>
                    setMembers([
                      ...members,
                      {
                        name: '',
                        avatar: members.length % 2 ? '👦' : '👧',
                        color: COLORS[members.length % COLORS.length],
                        role: 'Child',
                        kind: 'child',
                      },
                    ])
                  }
                >
                  + Add a family member
                </Button>
              </div>
            </StepShell>
          )}
          {step === 'focus' && (
            <StepShell
              emoji="🎯"
              title="What would make life better?"
              sub="Pick a few. We'll suggest simple habits and nudges for each."
            >
              <div className="grid grid-cols-2 gap-2">
                {FOCUS_AREAS.filter(
                  (f) => (!f.family || forFamily) && (f.key !== 'kids' || hasKids),
                ).map((f) => {
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
              sub="So nudges arrive at the right moments."
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
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
                  <span className="text-sm font-semibold">💼 I work on weekdays</span>
                  <Toggle
                    checked={worksWeekdays}
                    onChange={(v) => {
                      setWorks(v)
                      setPicked(null)
                    }}
                    label="Works weekdays"
                  />
                </label>
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
                <h1 className="text-3xl font-bold tracking-tight">Your nest is ready!</h1>
                <p className="mt-2 text-muted">
                  {created} habits, nudges and to-dos were set up for you. Change anything, anytime.
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
                Create {chosen.size} items ✨
              </Button>
            ) : (
              <Button className="flex-1" disabled={!canNext} onClick={() => go(1)}>
                {step === 'family' && members.length === 0 ? 'Skip for now' : 'Next'}
              </Button>
            )}
          </div>
        )}
      </div>
      {tour && <Tour onClose={() => setTour(false)} finishLabel="Set up my nest" />}
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
      <div className="mb-2 text-4xl anim-wiggle [animation-iteration-count:1]">{emoji}</div>
      <h1 className="text-[26px] font-bold leading-tight tracking-[-1px]">{title}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{sub}</p>
      {children}
    </div>
  )
}

function Welcome({ onStart, onTour }: { onStart: () => void; onTour: () => void }) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <img
          src="/favicon.svg"
          alt=""
          className="mx-auto mb-5 size-20 rounded-[26px] shadow-[0_14px_34px_#47765b44] anim-hop [animation-iteration-count:2]"
        />
        <h1 className="text-[34px] font-bold leading-tight tracking-[-1.3px]">
          Welcome to <span className="shimmer-text">DayNest</span>
        </h1>
        <p className="mt-2 text-muted">
          Brighter days, one small step at a time: your to-dos, habits you choose, gentle nudges and
          less screen time. 🌿
        </p>
        <div className="mt-8 grid gap-2">
          <Button onClick={onStart}>Set up my nest 🪄</Button>
          <Button variant="soft" onClick={onTour}>
            ▶️ Watch a 30-second tour
          </Button>
        </div>
        <p className="mx-auto mt-5 max-w-xs text-[11px] text-muted">
          No account. Your data is saved only on this phone — remember to back it up from Settings.
        </p>
      </div>
    </div>
  )
}

const KIND_LABEL = { habit: 'Habit to track', nudge: 'Nudge', task: 'Repeating to-do' }

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
  const HEALTH_NOTE: Record<string, string> = {
    health:
      "Only pick what already suits you. DayNest doesn't give health advice; ask a doctor before starting something new.",
    calm: 'Simple ideas, not instructions. Make them your own.',
  }
  return (
    <StepShell
      emoji="✨"
      title="Here's what we suggest"
      sub="Recommended items are ticked. Untick anything that doesn't fit — you can add more later."
    >
      <div className="grid gap-4">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              {g.emoji} {g.label}
            </h2>
            {HEALTH_NOTE[g.key] && (
              <p className="mb-1.5 text-[11px] text-muted">{HEALTH_NOTE[g.key]}</p>
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
