import { useState } from 'react'
import { Archive, Pause, Play, Trash2 } from 'lucide-react'
import {
  archiveProfile,
  deleteEvent,
  deleteGoal,
  deleteHabit,
  deleteReminder,
  saveEvent,
  saveGoal,
  saveHabit,
  saveProfile,
  saveReminder,
  setHabitStatus,
} from '@/db/actions'
import type {
  ReminderAudience,
  ReminderPriority,
  CalendarEvent,
  EventType,
  Goal,
  GoalHorizon,
  GoalStatus,
  Habit,
  Profile,
  Reminder,
} from '@/db/types'
import { todayLocal } from '@/lib/date'
import { HABIT_TEMPLATES } from '@/lib/templates'
import { usePrimaryProfile, useProfiles } from '@/lib/hooks'
import { toast, useUI } from '@/store/ui'
import {
  Button,
  Chip,
  ConfirmButton,
  DayPicker,
  Field,
  Input,
  Segmented,
  Select,
  Sheet,
  TextArea,
  Toggle,
} from '@/components/ui'

function ProfileSelect({
  value,
  onChange,
  allowEveryone = true,
}: {
  value: string
  onChange: (v: string) => void
  allowEveryone?: boolean
}) {
  const profiles = useProfiles() ?? []
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEveryone && <option value="">Everyone / family</option>}
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.avatar} {p.name}
        </option>
      ))}
    </Select>
  )
}

const EMOJIS = [
  '🚶',
  '💧',
  '📚',
  '🧘',
  '🏃',
  '🥗',
  '😴',
  '📵',
  '🎹',
  '🧸',
  '🙏',
  '✍️',
  '🌱',
  '🦷',
  '☀️',
  '🍎',
  '💪',
  '🎨',
]

export function HabitSheet({ habit }: { habit?: Habit }) {
  const close = useUI((s) => s.closeSheet)
  const me = usePrimaryProfile()
  const [title, setTitle] = useState(habit?.title ?? '')
  const [emoji, setEmoji] = useState(habit?.emoji ?? '🌱')
  const [targetLabel, setTarget] = useState(habit?.targetLabel ?? '')
  const [profileId, setProfileId] = useState(habit?.profileId ?? me?.id ?? '')
  const [freq, setFreq] = useState<'daily' | 'days'>(habit?.scheduleDays.length ? 'days' : 'daily')
  const [days, setDays] = useState<number[]>(
    habit?.scheduleDays.length ? habit.scheduleDays : [1, 2, 3, 4, 5],
  )
  const [templateKey, setTemplateKey] = useState(habit?.templateKey)

  const save = async () => {
    if (!title.trim()) return
    await saveHabit({
      id: habit?.id,
      title: title.trim(),
      emoji,
      targetLabel: targetLabel.trim() || undefined,
      description: habit?.description,
      templateKey,
      profileId: profileId || null,
      scheduleDays: freq === 'daily' ? [] : days,
      status: habit?.status ?? 'active',
      archivedAt: habit?.archivedAt ?? null,
    })
    toast(habit ? 'Habit updated — history kept' : 'Habit created', { emoji })
    close()
  }

  return (
    <Sheet
      title={habit ? 'Edit habit' : 'New habit'}
      onClose={close}
      footer={
        <>
          {habit && (
            <>
              <ConfirmButton
                onConfirm={async () => {
                  await deleteHabit(habit.id)
                  toast('Habit deleted')
                  close()
                }}
                confirmText="Delete + history?"
              >
                <Trash2 size={16} />
              </ConfirmButton>
              <Button
                variant="outline"
                aria-label={habit.status === 'paused' ? 'Resume habit' : 'Pause habit'}
                onClick={async () => {
                  await setHabitStatus(habit.id, habit.status === 'paused' ? 'active' : 'paused')
                  close()
                }}
              >
                {habit.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
              </Button>
              <Button
                variant="outline"
                aria-label="Archive habit"
                onClick={async () => {
                  await setHabitStatus(habit.id, 'archived')
                  toast('Habit archived')
                  close()
                }}
              >
                <Archive size={16} />
              </Button>
            </>
          )}
          <Button className="flex-1" onClick={save} disabled={!title.trim()}>
            Save
          </Button>
        </>
      }
    >
      {!habit && (
        <Field label="Quick ideas">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
            {HABIT_TEMPLATES.filter((t) => !t.forKids).map((t) => (
              <Chip
                key={t.key}
                active={title === t.title}
                onClick={() => {
                  setTitle(t.title)
                  setEmoji(t.emoji)
                  setTarget(t.targetLabel ?? '')
                  setTemplateKey(t.key)
                  if (t.days?.length) {
                    setFreq('days')
                    setDays(t.days)
                  }
                }}
              >
                {t.emoji} {t.title}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      <Field label="Habit">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Morning walk"
          maxLength={80}
        />
      </Field>
      <Field label="Icon">
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={emoji === e}
              aria-label={`Icon ${e}`}
              onClick={() => setEmoji(e)}
              className={`grid size-10 place-items-center rounded-xl text-lg transition ${emoji === e ? 'bg-sage-soft ring-2 ring-sage' : 'bg-surface2'}`}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Target (optional)" hint="e.g. 20 minutes, 6 glasses">
        <Input value={targetLabel} onChange={(e) => setTarget(e.target.value)} maxLength={40} />
      </Field>
      <Field label="Frequency">
        <Segmented
          label="Frequency"
          value={freq}
          onChange={setFreq}
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'days', label: 'Selected days' },
          ]}
        />
      </Field>
      {freq === 'days' && <DayPicker value={days} onChange={setDays} />}
      <Field label="Whose habit?">
        <ProfileSelect value={profileId} onChange={setProfileId} />
      </Field>
    </Sheet>
  )
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'event', label: '📅 Event' },
  { value: 'appointment', label: '🩺 Appointment' },
  { value: 'school', label: '🎒 School' },
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'important', label: '⭐ Important date' },
]

export function EventSheet({ event, date }: { event?: CalendarEvent; date?: string }) {
  const close = useUI((s) => s.closeSheet)
  const [title, setTitle] = useState(event?.title ?? '')
  const [localDate, setDate] = useState(event?.localDate ?? date ?? todayLocal())
  const [startTime, setStart] = useState(event?.startTime ?? '')
  const [endTime, setEnd] = useState(event?.endTime ?? '')
  const [type, setType] = useState<EventType>(event?.type ?? 'event')
  const [profileId, setProfileId] = useState(event?.profileId ?? '')
  const [repeatYearly, setYearly] = useState(event?.repeatYearly ?? false)
  const [notes, setNotes] = useState(event?.notes ?? '')

  const save = async () => {
    if (!title.trim() || !localDate) return
    await saveEvent({
      id: event?.id,
      title: title.trim(),
      localDate,
      startTime: startTime || null,
      endTime: endTime || null,
      type,
      profileId: profileId || null,
      repeatYearly: repeatYearly || type === 'birthday',
      notes: notes.trim() || undefined,
    })
    toast(event ? 'Event updated' : 'Event added', { emoji: '📅' })
    close()
  }

  return (
    <Sheet
      title={event ? 'Edit event' : 'New event'}
      onClose={close}
      footer={
        <>
          {event && (
            <ConfirmButton
              onConfirm={async () => {
                await deleteEvent(event.id)
                toast('Event deleted')
                close()
              }}
              confirmText="Delete?"
            >
              <Trash2 size={16} />
            </ConfirmButton>
          )}
          <Button className="flex-1" onClick={save} disabled={!title.trim()}>
            Save
          </Button>
        </>
      }
    >
      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="e.g. School activity"
        />
      </Field>
      <Field label="Type">
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Date">
        <Input type="date" value={localDate} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start (optional)">
          <Input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="End (optional)">
          <Input type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <Field label="For">
        <ProfileSelect value={profileId} onChange={setProfileId} />
      </Field>
      {type !== 'birthday' && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Repeat every year</span>
          <Toggle checked={repeatYearly} onChange={setYearly} label="Repeat every year" />
        </div>
      )}
      <Field label="Notes (optional)">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </Field>
    </Sheet>
  )
}

export function GoalSheet({ goal }: { goal?: Goal }) {
  const close = useUI((s) => s.closeSheet)
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDesc] = useState(goal?.description ?? '')
  const [emoji, setEmoji] = useState(goal?.emoji ?? '🎯')
  const [profileId, setProfileId] = useState(goal?.profileId ?? '')
  const [targetDate, setTarget] = useState(goal?.targetDate ?? '')
  const [horizon, setHorizon] = useState<GoalHorizon>(goal?.horizon ?? 'month')
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? 'active')

  const save = async () => {
    if (!title.trim()) return
    await saveGoal({
      id: goal?.id,
      title: title.trim(),
      description: description.trim() || undefined,
      emoji,
      profileId: profileId || null,
      targetDate: targetDate || null,
      horizon,
      status,
    })
    toast(goal ? 'Goal updated' : 'Goal created', { emoji })
    close()
  }
  return (
    <Sheet
      title={goal ? 'Edit goal' : 'New goal'}
      onClose={close}
      footer={
        <>
          {goal && (
            <ConfirmButton
              onConfirm={async () => {
                await deleteGoal(goal.id)
                toast('Goal deleted')
                close()
              }}
              confirmText="Delete?"
            >
              <Trash2 size={16} />
            </ConfirmButton>
          )}
          <Button className="flex-1" onClick={save} disabled={!title.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[64px_1fr] gap-3">
        <Field label="Icon">
          <Input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            className="text-center"
          />
        </Field>
        <Field label="Goal">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="e.g. Calmer mornings"
          />
        </Field>
      </div>
      <Field label="Plan">
        <Segmented
          label="Plan"
          value={horizon}
          onChange={setHorizon}
          options={[
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
            { value: 'long', label: 'Long-term' },
          ]}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target date">
          <Input type="date" value={targetDate} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)}>
            <option value="active">Active</option>
            <option value="achieved">Achieved 🎉</option>
            <option value="paused">Paused</option>
            <option value="dropped">Let go</option>
          </Select>
        </Field>
      </div>
      <Field label="Owner">
        <ProfileSelect value={profileId} onChange={setProfileId} />
      </Field>
      <Field label="Why it matters (optional)">
        <TextArea value={description} onChange={(e) => setDesc(e.target.value)} maxLength={500} />
      </Field>
    </Sheet>
  )
}

const COLORS = [
  '#e9dfd0',
  '#dce9dc',
  '#f0dfdf',
  '#e6e2f1',
  '#dfeaf0',
  '#f4ead2',
  '#e0efe9',
  '#f2e3ec',
]
const AVATARS = ['🙂', '😊', '👩', '👨', '👧', '👦', '👵', '👴', '🧒', '👶', '🐶', '🐱']

export function ProfileSheet({ profile }: { profile?: Profile }) {
  const close = useUI((s) => s.closeSheet)
  const [name, setName] = useState(profile?.name ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar ?? '🙂')
  const [color, setColor] = useState(profile?.color ?? COLORS[1])
  const [role, setRole] = useState(profile?.role ?? '')
  const save = async () => {
    if (!name.trim()) return
    await saveProfile({
      id: profile?.id,
      name: name.trim(),
      avatar: avatar || name.trim()[0].toUpperCase(),
      color,
      role: role.trim() || undefined,
      isPrimary: profile?.isPrimary,
      archivedAt: null,
    })
    toast(profile ? 'Profile updated' : 'Profile added', { emoji: avatar })
    close()
  }
  return (
    <Sheet
      title={profile ? 'Edit profile' : 'Add family member'}
      onClose={close}
      footer={
        <>
          {profile && !profile.isPrimary && (
            <ConfirmButton
              onConfirm={async () => {
                await archiveProfile(profile.id)
                toast('Profile removed')
                close()
              }}
              confirmText="Remove?"
            >
              <Trash2 size={16} />
            </ConfirmButton>
          )}
          <Button className="flex-1" onClick={save} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </Field>
      <Field label="Short description (optional)" hint="e.g. Personal, Learning & play">
        <Input value={role} onChange={(e) => setRole(e.target.value)} maxLength={40} />
      </Field>
      <Field label="Avatar">
        <div className="flex flex-wrap gap-1.5">
          {[name.trim()[0]?.toUpperCase() ?? 'A', ...AVATARS].map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={avatar === a}
              onClick={() => setAvatar(a)}
              className={`grid size-10 place-items-center rounded-full text-lg ${avatar === a ? 'ring-2 ring-sage' : ''}`}
              style={{ background: color }}
            >
              {a}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Colour">
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={`size-9 rounded-full border border-line ${color === c ? 'ring-2 ring-sage ring-offset-2 ring-offset-surface' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </Field>
      <p className="text-[11px] text-muted">
        Profiles live only on this device. There are no logins and nothing is shared online.
      </p>
    </Sheet>
  )
}

const REMINDER_EMOJIS = [
  '💧',
  '🪑',
  '👟',
  '🙆',
  '👀',
  '🌬️',
  '🧘',
  '🌙',
  '☀️',
  '😴',
  '💊',
  '🍎',
  '🚶',
  '🦷',
  '📞',
  '⏰',
]

export function ReminderSheet({ reminder }: { reminder?: Reminder }) {
  const close = useUI((s) => s.closeSheet)
  const [title, setTitle] = useState(reminder?.title ?? '')
  const [message, setMessage] = useState(reminder?.message ?? '')
  const [emoji, setEmoji] = useState(reminder?.emoji ?? '⏰')
  const [kind, setKind] = useState(reminder?.kind ?? 'interval')
  const [intervalMinutes, setEvery] = useState(reminder?.intervalMinutes ?? 60)
  const [startTime, setStart] = useState(reminder?.startTime ?? '09:00')
  const [endTime, setEnd] = useState(reminder?.endTime ?? '20:00')
  const [times, setTimes] = useState<string[]>(reminder?.times?.length ? reminder.times : ['08:00'])
  const [days, setDays] = useState<number[]>(reminder?.days ?? [])
  const [priority, setPriority] = useState<ReminderPriority>(reminder?.priority ?? 'normal')
  const [audience, setAudience] = useState<ReminderAudience>(reminder?.audience ?? 'me')
  const [profileId, setProfileId] = useState(reminder?.profileId ?? '')

  const save = async () => {
    if (!title.trim()) return
    await saveReminder({
      priority,
      audience,
      profileId: profileId || null,
      id: reminder?.id,
      title: title.trim(),
      message: message.trim() || title.trim(),
      emoji,
      kind,
      intervalMinutes: kind === 'interval' ? intervalMinutes : undefined,
      startTime: kind === 'interval' ? startTime : undefined,
      endTime: kind === 'interval' ? endTime : undefined,
      times: kind === 'times' ? [...new Set(times.filter(Boolean))].sort() : undefined,
      days: days.length === 7 ? [] : days,
      enabled: reminder?.enabled ?? true,
      presetKey: reminder?.presetKey,
      lastFiredSlot: new Date().toISOString(),
      snoozedUntil: null,
    })
    toast(reminder ? 'Nudge updated' : 'Nudge created', { emoji })
    close()
  }

  return (
    <Sheet
      title={reminder ? 'Edit nudge' : 'New nudge'}
      onClose={close}
      footer={
        <>
          {reminder && (
            <ConfirmButton
              onConfirm={async () => {
                await deleteReminder(reminder.id)
                toast('Nudge deleted')
                close()
              }}
              confirmText="Delete?"
            >
              <Trash2 size={16} />
            </ConfirmButton>
          )}
          <Button className="flex-1" onClick={save} disabled={!title.trim()}>
            Save
          </Button>
        </>
      }
    >
      <Field label="Nudge">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="e.g. Drink water"
        />
      </Field>
      <Field label="Who is it for?">
        <Segmented
          label="Who is it for"
          value={audience}
          onChange={setAudience}
          options={[
            { value: 'me', label: '🙂 Me' },
            { value: 'family', label: '💛 Family' },
            { value: 'kids', label: '🧒 Kids' },
          ]}
        />
      </Field>
      {audience !== 'me' && (
        <Field label="Person (optional)">
          <ProfileSelect value={profileId} onChange={setProfileId} />
        </Field>
      )}
      <label className="flex items-center justify-between gap-3 rounded-xl bg-surface2 p-3">
        <span className="text-sm">
          <b>Important</b>
          <span className="block text-[11px] text-muted">
            Stays on screen until you tap Done, louder chime, comes through in phone-free time
          </span>
        </span>
        <Toggle
          checked={priority === 'high'}
          onChange={(v) => setPriority(v ? 'high' : 'normal')}
          label="Important nudge"
        />
      </label>
      <Field label="Message">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={140}
          placeholder="A kind nudge…"
        />
      </Field>
      <Field label="Icon">
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={emoji === e}
              aria-label={`Icon ${e}`}
              onClick={() => setEmoji(e)}
              className={`grid size-10 place-items-center rounded-xl text-lg ${emoji === e ? 'bg-sage-soft ring-2 ring-sage' : 'bg-surface2'}`}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Schedule">
        <Segmented
          label="Schedule type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'interval', label: 'Repeat every…' },
            { value: 'times', label: 'At set times' },
          ]}
        />
      </Field>
      {kind === 'interval' ? (
        <>
          <Field label="Every">
            <Select value={intervalMinutes} onChange={(e) => setEvery(Number(e.target.value))}>
              {[15, 20, 30, 45, 60, 90, 120, 180].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Until">
              <Input type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
        </>
      ) : (
        <Field label="Times">
          <div className="grid gap-2">
            {times.map((t, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  type="time"
                  value={t}
                  onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                  aria-label={`Time ${i + 1}`}
                />
                {times.length > 1 && (
                  <Button
                    variant="outline"
                    aria-label="Remove time"
                    onClick={() => setTimes(times.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            ))}
            {times.length < 8 && (
              <Button variant="soft" size="sm" onClick={() => setTimes([...times, '12:00'])}>
                + Add time
              </Button>
            )}
          </div>
        </Field>
      )}
      <Field label="Days" hint="None selected = every day">
        <DayPicker value={days} onChange={setDays} />
      </Field>
    </Sheet>
  )
}
