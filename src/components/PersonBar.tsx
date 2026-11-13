import { useEffect, useRef } from 'react'
import { Plus } from 'lucide-react'
import { usePerson, useProfiles } from '@/lib/hooks'
import { displayName } from '@/lib/people'
import { useUI } from '@/store/ui'
import { Avatar, cx } from './ui'

/**
 * Everyone · Me · Priya · Mia · ＋ — switches every tab to one person, or the whole family.
 * Hidden until there's a family member, unless `always` (the Family tab).
 * `progress` adds a small ring around each avatar (0..1, null = nothing planned).
 */
export function PersonBar({
  className,
  always,
  progress,
}: {
  className?: string
  always?: boolean
  progress?: Record<string, number | null>
}) {
  const profiles = useProfiles()
  const { person, setPerson, hasFamily } = usePerson()
  const openSheet = useUI((s) => s.openSheet)
  const navRef = useRef<HTMLElement>(null)
  // keep the selected person in view when the bar scrolls sideways
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    const nav = navRef.current
    if (!el || !nav) return
    const left = el.offsetLeft - nav.clientWidth / 2 + el.clientWidth / 2
    nav.scrollTo?.({ left: Math.max(0, left), behavior: 'smooth' })
  }, [person, profiles?.length])
  if (!profiles || (!hasFamily && !always)) return null
  // a big family: everyone but the selected person shows as an avatar only, so all fit
  const compact = profiles.length > 4

  const items = [
    { id: 'all', label: 'Everyone', avatar: '👪', color: 'var(--green2)' },
    ...profiles.map((p) => ({ id: p.id, label: displayName(p), avatar: p.avatar, color: p.color })),
  ]
  return (
    <nav
      ref={navRef}
      aria-label="Show for"
      className={cx('-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 no-scrollbar', className)}
    >
      {items.map((it) => {
        const on = person === it.id
        const ratio = progress?.[it.id]
        const short = compact && !on
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={on}
            aria-label={it.label}
            title={it.label}
            onClick={() => setPerson(it.id)}
            className={cx(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 text-[13px] font-semibold transition active:scale-95',
              short ? 'pr-1' : 'pr-3.5',
              on
                ? 'border-sage bg-sage text-white shadow-[0_6px_16px_-10px_rgba(40,80,55,.9)]'
                : 'border-line bg-surface text-ink',
            )}
          >
            <span className="relative grid size-8 place-items-center">
              {ratio != null && <MiniRing value={ratio} on={on} />}
              <Avatar avatar={it.avatar} color={it.color} size={ratio != null ? 24 : 30} />
            </span>
            {!short && it.label}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => openSheet({ type: 'profile' })}
        aria-label="Add a family member"
        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-dashed border-sage-line px-3.5 text-[13px] font-semibold text-sage-ink"
      >
        <Plus size={15} />
        {!hasFamily && 'Add family'}
      </button>
    </nav>
  )
}

function MiniRing({ value, on }: { value: number; on: boolean }) {
  const r = 14.5
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90" aria-hidden>
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke={on ? 'rgba(255,255,255,.35)' : 'var(--line)'}
        strokeWidth="2.5"
      />
      {value > 0 && (
        <circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          stroke={on ? '#fff' : 'var(--green)'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, value))}
        />
      )}
    </svg>
  )
}
