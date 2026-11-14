import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cx } from './ui'

/** Tab state lives in the URL (?tab=…) so back/forward and links work. */
// eslint-disable-next-line react-refresh/only-export-components -- tiny hook paired with the tab components
export function useTab<T extends string>(
  options: readonly T[],
  fallback: T,
  param = 'tab',
): [T, (t: T) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get(param) as T | null
  const value = raw && options.includes(raw) ? raw : fallback
  const set = (t: T) => {
    const next = new URLSearchParams(params)
    next.set(param, t)
    setParams(next, { replace: true })
  }
  return [value, set]
}

export function TabBar<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T
  onChange: (t: T) => void
  tabs: { value: T; label: string; emoji?: string; icon?: ReactNode; badge?: number }[]
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="mb-4 flex">
      <div className="flex w-full gap-1 rounded-2xl bg-surface2 p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={value === t.value}
            onClick={() => onChange(t.value)}
            className={cx(
              'relative flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl px-2 text-[13px] font-bold transition',
              value === t.value ? 'bg-surface text-ink shadow-sm' : 'text-muted',
            )}
          >
            {t.icon && (
              <span aria-hidden className="text-[18px]">
                {t.icon}
              </span>
            )}
            {t.emoji && <span aria-hidden>{t.emoji}</span>}
            {t.label}
            {!!t.badge && (
              <span className="ml-0.5 rounded-full bg-sage px-1.5 text-[10px] text-white">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Small horizontally-scrolling chip filter (for second-level choices). */
export function ChipTabs<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (t: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 no-scrollbar"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition',
            value === o.value
              ? 'border-sage bg-sage-soft text-sage-ink'
              : 'border-line bg-surface text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
