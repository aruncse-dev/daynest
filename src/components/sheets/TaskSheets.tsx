import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, Trash2 } from 'lucide-react'
import { db } from '@/db/db'
import { archiveTask, deleteTask, saveTask } from '@/db/actions'
import type { Priority, RecurrenceRule, Task } from '@/db/types'
import { addLocalDays, todayLocal } from '@/lib/date'
import { usePrimaryProfile, useProfiles } from '@/lib/hooks'
import { toast, useUI } from '@/store/ui'
import { CATEGORIES } from '@/lib/goals'
import {
  Button,
  Chip,
  ConfirmButton,
  DayPicker,
  Field,
  Input,
  Select,
  Sheet,
  TextArea,
} from '@/components/ui'

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'important', label: 'Important' },
  { value: 'high', label: 'High' },
]

type RepeatKey = 'none' | RecurrenceRule['type']

export function QuickAddSheet() {
  const close = useUI((s) => s.closeSheet)
  const openSheet = useUI((s) => s.openSheet)
  const me = usePrimaryProfile()
  const profiles = useProfiles() ?? []
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState<'today' | 'tomorrow' | 'someday'>('today')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [priority, setPriority] = useState<Priority>('normal')

  const submit = async () => {
    if (!title.trim()) return
    const today = todayLocal()
    await saveTask({
      title: title.trim(),
      dueDate: when === 'today' ? today : when === 'tomorrow' ? addLocalDays(today, 1) : null,
      priority,
      category: 'Personal',
      profileId: profileId ?? me?.id ?? null,
      status: 'open',
    })
    toast('Task added', { emoji: '✅' })
    close()
  }

  return (
    <Sheet
      title="Add a task"
      onClose={close}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => openSheet({ type: 'task', defaults: { title } })}
          >
            More options
          </Button>
          <Button className="flex-1" onClick={submit} disabled={!title.trim()}>
            Add {when === 'someday' ? 'to someday' : `for ${when}`}
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        placeholder="What would you like to do?"
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        aria-label="Task title"
      />
      <div className="flex flex-wrap gap-2">
        {(['today', 'tomorrow', 'someday'] as const).map((w) => (
          <Chip key={w} active={when === w} onClick={() => setWhen(w)}>
            {w[0].toUpperCase() + w.slice(1)}
          </Chip>
        ))}
        <Chip
          active={priority === 'high'}
          onClick={() => setPriority(priority === 'high' ? 'normal' : 'high')}
        >
          ⚑ High priority
        </Chip>
      </div>
      {profiles.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => (
            <Chip
              key={p.id}
              active={(profileId ?? me?.id) === p.id}
              onClick={() => setProfileId(p.id)}
            >
              <span>{p.avatar}</span> {p.name}
            </Chip>
          ))}
        </div>
      )}
    </Sheet>
  )
}

export function TaskSheet({ task, defaults }: { task?: Task; defaults?: Partial<Task> }) {
  const close = useUI((s) => s.closeSheet)
  const me = usePrimaryProfile()
  const profiles = useProfiles() ?? []
  const goals =
    useLiveQuery(() => db.goals.filter((g) => g.status === 'active').toArray(), []) ?? []
  const base = { ...defaults, ...task }
  const [title, setTitle] = useState(base.title ?? '')
  const [notes, setNotes] = useState(base.notes ?? '')
  const [dueDate, setDueDate] = useState<string>(
    base.dueDate === undefined ? todayLocal() : (base.dueDate ?? ''),
  )
  const [dueTime, setDueTime] = useState(base.dueTime ?? '')
  const [priority, setPriority] = useState<Priority>(base.priority ?? 'normal')
  const [category, setCategory] = useState(base.category ?? 'Personal')
  const [profileId, setProfileId] = useState<string>(base.profileId ?? me?.id ?? '')
  const [goalId, setGoalId] = useState<string>(base.goalId ?? '')
  const [repeat, setRepeat] = useState<RepeatKey>(base.recurrenceRule?.type ?? 'none')
  const [days, setDays] = useState<number[]>(
    base.recurrenceRule?.type === 'selectedDays' ? base.recurrenceRule.days : [1, 3, 5],
  )

  const save = async () => {
    if (!title.trim()) return
    let rule: RecurrenceRule | null = null
    if (repeat === 'selectedDays') rule = { type: 'selectedDays', days }
    else if (repeat !== 'none') rule = { type: repeat }
    await saveTask({
      id: task?.id,
      title: title.trim(),
      notes: notes.trim() || undefined,
      dueDate: dueDate || (rule ? todayLocal() : null),
      dueTime: dueTime || null,
      priority,
      category,
      profileId: profileId || null,
      goalId: goalId || null,
      recurrenceRule: rule,
      status: task?.status ?? 'open',
      completedAt: task?.completedAt ?? null,
      archivedAt: task?.archivedAt ?? null,
    })
    toast(task ? 'Task updated' : 'Task added', { emoji: '✅' })
    close()
  }

  return (
    <Sheet
      title={task ? 'Edit task' : 'New task'}
      onClose={close}
      footer={
        <>
          {task && (
            <>
              <ConfirmButton
                onConfirm={async () => {
                  await deleteTask(task.id)
                  toast('Task deleted')
                  close()
                }}
                confirmText="Delete?"
              >
                <Trash2 size={16} />
              </ConfirmButton>
              <Button
                variant="outline"
                aria-label="Archive task"
                onClick={async () => {
                  await archiveTask(task.id)
                  toast('Task archived', { emoji: '📦' })
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
      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Plan the coming week"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={repeat === 'none' ? 'Due date' : 'Starts on'}
          hint={repeat === 'none' ? 'Leave empty for Someday' : undefined}
        >
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Time (optional)">
          <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Repeat">
        <Select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatKey)}>
          <option value="none">Does not repeat</option>
          <option value="daily">Every day</option>
          <option value="weekdays">Weekdays (Mon–Fri)</option>
          <option value="selectedDays">Selected days…</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </Select>
      </Field>
      {repeat === 'selectedDays' && <DayPicker value={days} onChange={setDays} />}
      <Field label="Priority">
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <Chip key={p.value} active={priority === p.value} onClick={() => setPriority(p.value)}>
              {p.label}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Assigned to">
          <Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">Everyone</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.avatar} {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {goals.length > 0 && (
        <Field label="Linked goal">
          <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">None</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.emoji ?? '🎯'} {g.title}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Notes (optional)">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </Field>
    </Sheet>
  )
}
