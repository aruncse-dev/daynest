import { useEffect, useState } from 'react'
import { Archive, Pause, Play, Plus, Trash2 } from 'lucide-react'
import {
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
import { usePrimaryProfile } from '@/lib/hooks'
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

const EMOJIS = [
  '🌱',
  '🚶',
  '💪',
  '📖',
  '📝',
  '🎯',
  '🧹',
  '🙏',
  '🌿',
  '😴',
  '🥗',
  '📵',
  '🌅',
  '💡',
  '🎨',
  '🎵',
  '🦷',
  '☀️',
]

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

export function HabitSheet({ habit }: { habit?: Habit }) {
  const close = useUI((s) => s.closeSheet)
  const me = usePrimaryProfile()
  const [title, setTitle] = useState(habit?.title ?? '')
  const [emoji, setEmoji] = useState(habit?.emoji ?? '🌱')
  const [targetLabel, setTarget] = useState(habit?.targetLabel ?? '')
  const [freq, setFreq] = useState<'daily' | 'days'>(habit?.scheduleDays.length ? 'days' : 'daily')
  const [days, setDays] = useState<number[]>(
    habit?.scheduleDays.length ? habit.scheduleDays : [1, 2, 3, 4, 5],
  )
  const [templateKey, setTemplateKey] = useState(habit?.templateKey)
  const [times, setTimes] = useState<string[]>([])

  useEffect(() => {
    if (habit) void getLinkedReminder('habit', habit.id).then((r) => setTimes(r?.times ?? []))
  }, [habit])

  const save = async () => {
    if (!title.trim()) return
    const saved = await saveHabit({
      id: habit?.id,
      title: title.trim(),
      emoji,
      targetLabel: targetLabel.trim() || undefined,
      description: habit?.description,
      templateKey,
      profileId: habit?.profileId ?? me?.id ?? null,
      scheduleDays: freq === 'daily' ? [] : days,
      status: habit?.status ?? 'active',
      archivedAt: habit?.archivedAt ?? null,
    })
    await syncHabitReminder(saved, times.filter(Boolean))
    toast(habit ? 'Habit updated — history kept' : 'Habit added', { emoji })
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
      <Field group label="Icon">
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
  { value: 'event', label: '📅 Event' },
  { value: 'appointment', label: '🩺 Appointment' },
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'important', label: '⭐ Important date' },
]

export function EventSheet({ event, date }: { event?: CalendarEvent; date?: string }) {
  const close = useUI((s) => s.closeSheet)
  const [title, setTitle] = useState(event?.title ?? '')
  const [localDate, setDate] = useState(event?.localDate ?? date ?? todayLocal())
  const [startTime, setStart] = useState(event?.startTime ?? '')
  const [type, setType] = useState<EventType>(event?.type ?? 'event')
  const [repeatYearly, setYearly] = useState(event?.repeatYearly ?? false)
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [remind, setRemind] = useState<number | null>(null)

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
      profileId: event?.profileId ?? null,
      repeatYearly: repeatYearly || type === 'birthday',
      notes: notes.trim() || undefined,
    })
    await syncEventReminder(saved, remind !== null && remind >= 0 && !saved.startTime ? -1 : remind)
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
      <Field label="What">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="e.g. Dentist"
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map((t) => (
          <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)}>
            {t.label}
          </Chip>
        ))}
      </div>
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
      {type !== 'birthday' && (
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

const AVATARS = ['🙂', '😊', '👩', '👨', '🧔', '👱‍♀️', '🧑', '👵', '👴']

export function ProfileSheet({ profile }: { profile?: Profile }) {
  const close = useUI((s) => s.closeSheet)
  const [name, setName] = useState(profile?.name ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar ?? '🙂')
  const save = async () => {
    if (!name.trim()) return
    await saveProfile({
      id: profile?.id,
      name: name.trim(),
      avatar: avatar || name.trim()[0].toUpperCase(),
      color: profile?.color ?? '#dce9dc',
      role: profile?.role,
      isPrimary: profile?.isPrimary ?? true,
      archivedAt: null,
    })
    toast('Saved', { emoji: avatar })
    close()
  }
  return (
    <Sheet
      title="Your name"
      onClose={close}
      footer={
        <Button className="flex-1" onClick={save} disabled={!name.trim()}>
          Save
        </Button>
      }
    >
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </Field>
      <Field group label="Picture">
        <div className="flex flex-wrap gap-1.5">
          {[name.trim()[0]?.toUpperCase() ?? 'A', ...AVATARS].map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={avatar === a}
              onClick={() => setAvatar(a)}
              className={`grid size-10 place-items-center rounded-full bg-[#dce9dc] text-lg ${avatar === a ? 'ring-2 ring-sage' : ''}`}
            >
              {a}
            </button>
          ))}
        </div>
      </Field>
    </Sheet>
  )
}

const REMINDER_EMOJIS = [
  '⏰',
  '💧',
  '🪑',
  '👀',
  '⏸️',
  '☀️',
  '💊',
  '📞',
  '🍎',
  '🚶',
  '🌿',
  '🔑',
  '🧾',
  '🌙',
]

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

  const save = async () => {
    if (!title.trim()) return
    await saveReminder({
      id: reminder?.id,
      title: title.trim(),
      message: message.trim() || title.trim(),
      emoji,
      kind,
      priority,
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
      <Field label="Message (optional)">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={140}
          placeholder="A kind reminder…"
        />
      </Field>
      <Field group label="Icon">
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
