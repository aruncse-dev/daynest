import { MORNING_OF } from '@/db/links'
import { Select } from '@/components/ui'

/** "Remind me" choice for to-dos and events. null = no reminder. */
export function RemindPicker({
  value,
  onChange,
  hasTime,
  id,
}: {
  value: number | null
  onChange: (v: number | null) => void
  hasTime: boolean
  id: string
}) {
  return (
    <Select
      id={id}
      value={value === null ? 'none' : String(value)}
      onChange={(e) => onChange(e.target.value === 'none' ? null : Number(e.target.value))}
    >
      <option value="none">No reminder</option>
      {hasTime && <option value="0">At the time</option>}
      {hasTime && <option value="15">15 minutes before</option>}
      {hasTime && <option value="60">1 hour before</option>}
      <option value={MORNING_OF}>Morning of the day (8 AM)</option>
    </Select>
  )
}
