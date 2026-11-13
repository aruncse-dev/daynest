import { useState } from 'react'
import { setSetting } from '@/db/actions'
import { useSetting } from '@/lib/hooks'
import { Button, Field, Input, cx } from './ui'
import { CUSTOM_EMOJIS_KEY, EMOJI_SETS, PEOPLE_EMOJIS, firstGrapheme } from '@/lib/emojis'

/**
 * Icon picker: everyday groups plus "your own" (anything from the phone's emoji keyboard).
 * Own emojis are remembered on this phone so they're one tap away next time.
 */
export function EmojiPicker({
  value,
  onChange,
  label = 'Icon',
  people,
  color,
}: {
  value: string
  onChange: (emoji: string) => void
  label?: string
  /** profile pictures: people set, round, on the profile colour */
  people?: boolean
  color?: string
}) {
  const custom = useSetting<string[]>(CUSTOM_EMOJIS_KEY, [])
  const sets = people
    ? [{ key: 'people', label: 'People', list: PEOPLE_EMOJIS }, ...EMOJI_SETS.slice(0, 1)]
    : EMOJI_SETS
  const withMine = custom.length ? [{ key: 'mine', label: 'Mine', list: custom }, ...sets] : sets
  const [tab, setTab] = useState(withMine[0].key)
  const current = withMine.find((s) => s.key === tab) ?? withMine[0]
  const [own, setOwn] = useState('')

  const applyOwn = async () => {
    const e = firstGrapheme(own)
    if (!e) return
    onChange(e)
    setOwn('')
    if (!custom.includes(e)) await setSetting(CUSTOM_EMOJIS_KEY, [e, ...custom].slice(0, 24))
  }

  return (
    <Field group label={label}>
      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 no-scrollbar" role="tablist">
        {withMine.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={tab === s.key}
            onClick={() => setTab(s.key)}
            className={cx(
              'shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition',
              tab === s.key ? 'bg-ink text-surface' : 'bg-surface2 text-muted',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1">
        {current.list.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={value === e}
            aria-label={`${label} ${e}`}
            onClick={() => onChange(e)}
            className={cx(
              'grid aspect-square place-items-center text-[20px] transition active:scale-90',
              people ? 'rounded-full' : 'rounded-xl',
              value === e ? 'ring-2 ring-sage' : '',
              !people && (value === e ? 'bg-sage-soft' : 'bg-surface2'),
            )}
            style={people ? { background: color } : undefined}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={own}
          onChange={(e) => setOwn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void applyOwn()
            }
          }}
          placeholder="Your own: type any emoji 😀"
          aria-label="Your own emoji"
          maxLength={16}
        />
        <Button variant="soft" onClick={applyOwn} disabled={!firstGrapheme(own)}>
          Use {firstGrapheme(own)}
        </Button>
      </div>
    </Field>
  )
}
