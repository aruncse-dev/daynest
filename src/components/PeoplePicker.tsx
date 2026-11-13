import { Check } from 'lucide-react'
import { useProfiles } from '@/lib/hooks'
import { displayName } from '@/lib/people'
import { Avatar, Field, cx } from './ui'

/**
 * "Who is this for?" Pick any number of people, or nobody (then it isn't tied to anyone
 * and shows under Everyone). Only shown once family members exist.
 * `single` lets only one person be chosen (an existing habit belongs to one person).
 */
export function PeoplePicker({
  value,
  onChange,
  single,
  hint,
}: {
  value: string[]
  onChange: (ids: string[]) => void
  single?: boolean
  hint?: string
}) {
  const profiles = useProfiles()
  if (!profiles || profiles.length < 2) return null
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id))
    else onChange(single ? [id] : [...value, id])
  }
  return (
    <Field
      group
      label={single ? 'For' : 'For (pick any)'}
      hint={hint ?? (value.length ? undefined : 'Nobody picked: shows under Everyone')}
    >
      <div className="flex flex-wrap gap-1.5">
        {!single && profiles.length > 2 && (
          <button
            type="button"
            aria-pressed={value.length === profiles.length}
            onClick={() =>
              onChange(value.length === profiles.length ? [] : profiles.map((p) => p.id))
            }
            className={cx(
              'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition active:scale-95',
              value.length === profiles.length
                ? 'border-sage bg-sage text-white'
                : 'border-dashed border-sage-line text-sage-ink',
            )}
          >
            👪 All
          </button>
        )}
        {profiles.map((p) => {
          const on = value.includes(p.id)
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(p.id)}
              className={cx(
                'inline-flex min-h-10 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition active:scale-95',
                on ? 'border-sage bg-sage-soft text-ink' : 'border-line bg-surface text-muted',
              )}
            >
              <span className="relative">
                <Avatar avatar={p.avatar} color={p.color} size={28} />
                {on && (
                  <span className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-sage text-white ring-2 ring-surface">
                    <Check size={9} strokeWidth={4} />
                  </span>
                )}
              </span>
              {displayName(p)}
            </button>
          )
        })}
      </div>
    </Field>
  )
}
