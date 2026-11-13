import { useEffect, useState } from 'react'
import { Archive, Pause, Play, Plus, Trash2 } from 'lucide-react'
import {
  archiveProfile,
  deleteEvent,
  deleteHabit,
  deleteReminder,
  saveEvent,
  saveHabit,
  saveProfile,
  saveReminder,
  setHabitStatus,
} from '@/db/actions'
import { getLinkedReminder, syncEventReminder, syncHabitReminder } from '@/db/links'
import type {
  CalendarEvent,
  EventType,
  Habit,
  Profile,
  Reminder,
  ReminderPriority,
} from '@/db/types'
import { todayLocal } from '@/lib/date'
import { HABIT_TEMPLATES } from '@/lib/templates'
import { useDefaultPeople } from '@/lib/hooks'
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
import { RemindPicker } from './RemindPicker'
import { PeoplePicker } from '@/components/PeoplePicker'
import { EmojiPicker } from '@/components/EmojiPicker'
import { EVENT_EMOJI } from '@/lib/people'
import { ROLES, roleOf, type FamilyRole } from '@/lib/family'

/** Up to three reminder times, or none. */
function TimesEditor({
  times,
  onChange,
  label,
}: {
  times: string[]
  onChange: (t: string[]) => void
  label: string
}) {
  return (
    <div className="grid gap-2">
      {times.map((t, i) => (
        <div key={i} className="flex gap-2">
          <Input
            type="time"
            value={t}
            onChange={(e) => onChange(times.map((x, j) => (j === i ? e.target.value : x)))}
            aria-label={`${label} ${i + 1}`}
          />
          <Button
            variant="outline"
            aria-label="Remove time"
            onClick={() => onChange(times.filter((_, j) => j !== i))}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      ))}
      {times.length < 3 && (
        <Button
          variant="soft"
          size="sm"
          onClick={() => onChange([...times, times.length ? '20:00' : '08:00'])}
        >
          <Plus size={14} /> {times.length ? 'Add another time' : 'Add a reminder'}
        </Button>
      )}
    </div>
  )
}

export function HabitSheet({
  habit,
  defaults,
  remindTimes,
}: {
  habit?: Habit
  defaults?: Partial<Habit>
  remindTimes?: string[]
}) {
  const close = useUI((s) => s.closeSheet)
  const fallbackPeople = useDefaultPeople()
  const base = { ...defaults, ...habit }
  const [title, setTitle] = useState(base.title ?? '')
  const [emoji, setEmoji] = useState(base.emoji ?? '🌱')
  const [targetLabel, setTarget] = useState(base.targetLabel ?? '')
  const [freq, setFreq] = useState<'daily' | 'days'>(base.scheduleDays?.length ? 'days' : 'daily')
  const [days, setDays] = useState<number[]>(
    base.scheduleDays?.length ? base.scheduleDays : [1, 2, 3, 4, 5],
  )
  const [templateKey, setTemplateKey] = useState(base.templateKey)
  const [times, setTimes] = useState<string[]>(remindTimes ?? [])
  const [people, setPeople] = useState<string[]>(
    base.profileId !== undefined ? (base.profileId ? [base.profileId] : []) : fallbackPeople,
  )

  useEffect(() => {
    if (habit) void getLinkedReminder('habit', habit.id).then((r) => setTimes(r?.times ?? []))
  }, [habit])

  const save = async () => {
    if (!title.trim()) return
    // a habit belongs to one person (their own streak): several people = one habit each
    const owners: (string | null)[] = habit ? [people[0] ?? null] : people.length ? people : [null]
    for (const owner of owners) {
      const saved = await saveHabit({
        id: habit?.id,
        title: title.trim(),
        emoji,
        targetLabel: targetLabel.trim() || undefined,
        description: habit?.description,
        templateKey,
        profileId: owner,
        scheduleDays: freq === 'daily' ? [] : days,
        status: habit?.status ?? 'active',
        archivedAt: habit?.archivedAt ?? null,
      })
      await syncHabitReminder(saved, times.filter(Boolean))
    }
    toast(
      habit
        ? 'Habit updated — history kept'
        : owners.length > 1
          ? `Added for ${owners.length} people`
          : 'Habit added',
      { emoji },
    )
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
      {!habit && !defaults?.title && (
        <Field group label="Ideas">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
            {HABIT_TEMPLATES.filter((t) => t.key !== 'phone-free-night').map((t) => (
              <Chip
                key={t.key}
                active={templateKey === t.key}
                onClick={() => {
                  setTitle(t.title)
                  setEmoji(t.emoji)
                  setTemplateKey(t.key)
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
          onChange={(e) => {
            setTitle(e.target.value)
            setTemplateKey(undefined)
          }}
          placeholder="e.g. Read"
          maxLength={80}
        />
      </Field>
      <PeoplePicker
        value={people}
        onChange={setPeople}
        single={!!habit}
        hint={
          habit
            ? undefined
            : people.length > 1
              ? 'Each person gets their own habit and streak'
              : people.length
                ? undefined
                : 'Nobody picked: shows under Everyone'
        }
      />
      <EmojiPicker value={emoji} onChange={setEmoji} />
      <Field label="Your target (optional)" hint="In your own words, e.g. 10 pages, 20 minutes">
        <Input value={targetLabel} onChange={(e) => setTarget(e.target.value)} maxLength={40} />
      </Field>
      <Field label="How often">
        <Segmented
          label="How often"
          value={freq}
          onChange={setFreq}
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'days', label: 'Some days' },
          ]}
        />
      </Field>
      {freq === 'days' && <DayPicker value={days} onChange={setDays} />}
      <Field group label="Remind me" hint="Quiet on days you've already done it">
        <TimesEditor times={times} onChange={setTimes} label="Reminder time" />
      </Field>
    </Sheet>
  )
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'important', label: 'Important date' },
]
const YEARLY_TYPES = new Set<EventType>(['birthday', 'anniversary'])

export function EventSheet({
  event,
  date,
  defaults,
  remindBefore,
}: {
  event?: CalendarEvent
  date?: string
  defaults?: Partial<CalendarEvent>
  remindBefore?: number
}) {
  const close = useUI((s) => s.closeSheet)
  const fallbackPeople = useDefaultPeople()
  const base = { ...defaults, ...event }
  const [title, setTitle] = useState(base.title ?? '')
  const [emoji, setEmoji] = useState(base.emoji ?? '')
  const [iconOpen, setIconOpen] = useState(false)
  const [localDate, setDate] = useState(base.localDate ?? date ?? todayLocal())
  const [startTime, setStart] = useState(base.startTime ?? '')
  const [type, setType] = useState<EventType>(base.type ?? 'event')
  const [repeatYearly, setYearly] = useState(base.repeatYearly ?? false)
  const [notes, setNotes] = useState(base.notes ?? '')
  const [remind, setRemind] = useState<number | null>(remindBefore ?? null)
  const [people, setPeople] = useState<string[]>(base.profileIds ?? fallbackPeople)

  useEffect(() => {
    if (event)
      void getLinkedReminder('event', event.id).then((r) => setRemind(r?.link?.before ?? null))
  }, [event])

  const save = async () => {
    if (!title.trim() || !localDate) return
    const saved = await saveEvent({
      id: event?.id,
      title: title.trim(),
      localDate,
      startTime: startTime || null,
      endTime: event?.endTime ?? null,
      type,
      emoji: emoji || undefined,
      profileIds: people,
      repeatYearly: repeatYearly || YEARLY_TYPES.has(type),
      notes: notes.trim() || undefined,
    })
    await syncEventReminder(saved, remind !== null && remind >= 0 && !saved.startTime ? -1 : remind)
    toast(event ? 'Saved' : 'Added', { emoji: emoji || EVENT_EMOJI[type] })
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
      <Field label="What">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="e.g. Dentist"
        />
      </Field>
      <PeoplePicker value={people} onChange={setPeople} />
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map((t) => (
          <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)}>
            {EVENT_EMOJI[t.value]} {t.label}
          </Chip>
        ))}
      </div>
      {iconOpen ? (
        <EmojiPicker value={emoji} onChange={setEmoji} label="Own icon" />
      ) : (
        <button
          type="button"
          onClick={() => setIconOpen(true)}
          className="justify-self-start text-xs font-semibold text-sage-ink"
        >
          {emoji ? `Icon ${emoji} · change` : 'Choose your own icon (optional)'}
        </button>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={localDate} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time (optional)">
          <Input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} />
        </Field>
      </div>
      <Field group label="Remind me">
        <RemindPicker id="event-remind" value={remind} onChange={setRemind} hasTime={!!startTime} />
      </Field>
      {!YEARLY_TYPES.has(type) && (
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Every year</span>
          <Toggle checked={repeatYearly} onChange={setYearly} label="Repeat every year" />
        </label>
      )}
      <Field label="Notes (optional)">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </Field>
    </Sheet>
  )
}

const COLORS = ['#dce9dc', '#e9dfd0', '#f0dfdf', '#e6e2f1', '#dfeaf0', '#f4ead2']

/** Edit yourself, or add/edit a family member. Members live only on this phone. */
export function ProfileSheet({ profile, role: presetRole }: { profile?: Profile; role?: string }) {
  const close = useUI((s) => s.closeSheet)
  const isMe = profile?.isPrimary ?? false
  const [role, setRole] = useState<FamilyRole>(
    profile ? roleOf(profile) : ((presetRole as FamilyRole) ?? 'child'),
  )
  const roleInfo = ROLES.find((r) => r.value === role)!
  const [name, setName] = useState(profile?.name ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar ?? (isMe ? '🙂' : roleInfo.avatar))
  const [color, setColor] = useState(profile?.color ?? roleInfo.color)
  const save = async () => {
    if (!name.trim()) return
    await saveProfile({
      id: profile?.id,
      name: name.trim(),
      avatar: avatar || name.trim()[0].toUpperCase(),
      color,
      role: isMe ? profile?.role : role,
      isPrimary: isMe,
      archivedAt: null,
    })
    toast(profile ? 'Saved' : `${name.trim()} added`, { emoji: avatar })
    close()
  }
  return (
    <Sheet
      title={isMe ? 'You' : profile ? 'Edit family member' : 'Add family member'}
      onClose={close}
      footer={
        <>
          {profile && !isMe && (
            <ConfirmButton
              onConfirm={async () => {
                await archiveProfile(profile.id)
                toast(`${profile.name} removed`)
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
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoFocus={!profile}
        />
      </Field>
      {!isMe && (
        <Field group label="Who are they?">
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <Chip
                key={r.value}
                active={role === r.value}
                onClick={() => {
                  setRole(r.value)
                  if (!profile) {
                    setAvatar(r.avatar)
                    setColor(r.color)
                  }
                }}
              >
                {r.avatar} {r.label}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      <EmojiPicker value={avatar} onChange={setAvatar} label="Picture" people color={color} />
      <Field group label="Colour">
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
      {!isMe && (
        <p className="text-[11px] text-muted">
          Family members are kept only on this phone. Nothing is shared.
        </p>
      )}
    </Sheet>
  )
}

export function ReminderSheet({ reminder }: { reminder?: Reminder }) {
  const close = useUI((s) => s.closeSheet)
  const [title, setTitle] = useState(reminder?.title ?? '')
  const [message, setMessage] = useState(reminder?.message ?? '')
  const [emoji, setEmoji] = useState(reminder?.emoji ?? '⏰')
  const [kind, setKind] = useState(reminder?.kind ?? 'times')
  const [intervalMinutes, setEvery] = useState(reminder?.intervalMinutes ?? 60)
  const [startTime, setStart] = useState(reminder?.startTime ?? '09:00')
  const [endTime, setEnd] = useState(reminder?.endTime ?? '20:00')
  const [times, setTimes] = useState<string[]>(reminder?.times?.length ? reminder.times : ['09:00'])
  const [days, setDays] = useState<number[]>(reminder?.days ?? [])
  const [priority, setPriority] = useState<ReminderPriority>(reminder?.priority ?? 'normal')
  const fallbackPeople = useDefaultPeople()
  const [people, setPeople] = useState<string[]>(
    reminder ? (reminder.profileId ? [reminder.profileId] : []) : fallbackPeople,
  )

  const save = async () => {
    if (!title.trim()) return
    await saveReminder({
      id: reminder?.id,
      title: title.trim(),
      message: message.trim() || title.trim(),
      emoji,
      kind,
      priority,
      profileId: people[0] ?? null,
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
    toast(reminder ? 'Reminder updated' : 'Reminder added', { emoji })
    close()
  }

  return (
    <Sheet
      title={reminder ? 'Edit reminder' : 'New reminder'}
      onClose={close}
      footer={
        <>
          {reminder && (
            <ConfirmButton
              onConfirm={async () => {
                await deleteReminder(reminder.id)
                toast('Reminder deleted')
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
      <Field label="Reminder">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="e.g. Take my tablet"
        />
      </Field>
      <PeoplePicker value={people} onChange={setPeople} single />
      <Field label="Message (optional)">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={140}
          placeholder="A kind reminder…"
        />
      </Field>
      <EmojiPicker value={emoji} onChange={setEmoji} />
      <Segmented
        label="Schedule type"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'times', label: 'At set times' },
          { value: 'interval', label: 'Repeat every…' },
        ]}
      />
      {kind === 'interval' ? (
        <>
          <Field label="Every">
            <Select value={intervalMinutes} onChange={(e) => setEvery(Number(e.target.value))}>
              {[30, 45, 60, 90, 120, 180].map((m) => (
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
        <TimesEditor
          times={times}
          onChange={(t) => setTimes(t.length ? t : ['09:00'])}
          label="Time"
        />
      )}
      <Field group label="Days" hint="None selected = every day">
        <DayPicker value={days} onChange={setDays} />
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-surface2 p-3">
        <span className="text-sm">
          <b>Important</b>
          <span className="block text-[11px] text-muted">
            Stays on screen until you tap Done, and comes through in phone-free time
          </span>
        </span>
        <Toggle
          checked={priority === 'high'}
          onChange={(v) => setPriority(v ? 'high' : 'normal')}
          label="Important reminder"
        />
      </label>
    </Sheet>
  )
}
