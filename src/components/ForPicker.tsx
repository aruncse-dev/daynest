import { useMembers, usePrimaryProfile } from '@/lib/hooks'
import { Avatar, Chip, Field } from './ui'

/** "Who is this for?" Only shown once family members have been added. */
export function ForPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (id: string) => void
}) {
  const me = usePrimaryProfile()
  const members = useMembers()
  if (!members.length || !me) return null
  const current = value ?? me.id
  return (
    <Field group label="For">
      <div className="flex flex-wrap gap-2">
        {[me, ...members].map((p) => (
          <Chip key={p.id} active={current === p.id} onClick={() => onChange(p.id)}>
            <Avatar avatar={p.avatar} color={p.color} size={20} /> {p.isPrimary ? 'Me' : p.name}
          </Chip>
        ))}
      </div>
    </Field>
  )
}
