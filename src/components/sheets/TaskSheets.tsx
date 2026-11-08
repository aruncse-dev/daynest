import { useEffect, useState } from 'react'
import { Archive, Trash2 } from 'lucide-react'
import { archiveTask, deleteTask, saveTask } from '@/db/actions'
import { getLinkedReminder, MORNING_OF, syncTaskReminder } from '@/db/links'
import type { RecurrenceRule, Task } from '@/db/types'
import { addLocalDays, todayLocal } from '@/lib/date'
import { usePrimaryProfile } from '@/lib/hooks'
import { toast, useUI } from '@/store/ui'
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
  Toggle,
} from '@/components/ui'
import { RemindPicker } from './RemindPicker'
import { ForPicker } from '@/components/ForPicker'

type RepeatKey = 'none' | RecurrenceRule['type']

export function QuickAddSheet() {
  const close = useUI((s) => s.closeSheet)
  const openSheet = useUI((s) => s.openSheet)
  const me = usePrimaryProfile()
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState<'today' | 'tomorrow' | 'someday'>('today')
  const [important, setImportant] = useState(false)
  const [forId, setForId] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) return
    const today = todayLocal()
    await saveTask({
      title: title.trim(),
      dueDate: when === 'today' ? today : when === 'tomorrow' ? addLocalDays(today, 1) : null,
      priority: important ? 'high' : 'normal',
      category: 'Personal',
      profileId: forId ?? me?.id ?? null,
      status: 'open',
    })
    toast('To-do added', { emoji: '✅' })
    close()
  }

  return (
    <Sheet
      title="Add a to-do"
      onClose={close}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => openSheet({ type: 'task', defaults: { title } })}
          >
            Time & reminder…
          </Button>
          <Button className="flex-1" onClick={submit} disabled={!title.trim()}>
            Add
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
      <ForPicker value={forId} onChange={setForId} />
      <div className="flex flex-wrap gap-2">
        {(['today', 'tomorrow', 'someday'] as const).map((w) => (
          <Chip key={w} active={when === w} onClick={() => setWhen(w)}>
            {w[0].toUpperCase() + w.slice(1)}
          </Chip>
        ))}
        <Chip active={important} onClick={() => setImportant(!important)}>
          ⭐ Important
        </Chip>
      </div>
    </Sheet>
  )
}

export function TaskSheet({
  task,
  defaults,
  remindBefore,
}: {
  task?: Task
  defaults?: Partial<Task>
  remindBefore?: number
}) {
  const close = useUI((s) => s.closeSheet)
  const me = usePrimaryProfile()
  const base = { ...defaults, ...task }
  const [title, setTitle] = useState(base.title ?? '')
  const [notes, setNotes] = useState(base.notes ?? '')
  const [dueDate, setDueDate] = useState<string>(
    base.dueDate === undefined ? todayLocal() : (base.dueDate ?? ''),
  )
  const [dueTime, setDueTime] = useState(base.dueTime ?? '')
  const [important, setImportant] = useState(
    base.priority === 'high' || base.priority === 'important',
  )
  const [repeat, setRepeat] = useState<RepeatKey>(base.recurrenceRule?.type ?? 'none')
  const [days, setDays] = useState<number[]>(
    base.recurrenceRule?.type === 'selectedDays' ? base.recurrenceRule.days : [1, 3, 5],
  )
  const [remind, setRemind] = useState<number | null>(remindBefore ?? null)
  const [forId, setForId] = useState<string | null>(base.profileId ?? null)

  useEffect(() => {
    if (task)
      void getLinkedReminder('task', task.id).then((r) => setRemind(r?.link?.before ?? null))
  }, [task])

  const save = async () => {
    if (!title.trim()) return
    let rule: RecurrenceRule | null = null
    if (repeat === 'selectedDays') rule = { type: 'selectedDays', days }
    else if (repeat !== 'none') rule = { type: repeat }
    const saved = await saveTask({
      id: task?.id,
      title: title.trim(),
      notes: notes.trim() || undefined,
      dueDate: dueDate || (rule ? todayLocal() : null),
      dueTime: dueTime || null,
      priority: important ? 'high' : 'normal',
      category: task?.category ?? 'Personal',
      profileId: forId ?? me?.id ?? null,
      goalId: task?.goalId ?? null,
      recurrenceRule: rule,
      status: task?.status ?? 'open',
      completedAt: task?.completedAt ?? null,
      archivedAt: task?.archivedAt ?? null,
    })
    // a time-based reminder needs a time; fall back to the morning of the day
    await syncTaskReminder(
      saved,
      remind !== null && remind !== MORNING_OF && !saved.dueTime ? MORNING_OF : remind,
    )
    toast(task ? 'To-do updated' : 'To-do added', { emoji: '✅' })
    close()
  }

  return (
    <Sheet
      title={task ? 'Edit to-do' : 'New to-do'}
      onClose={close}
      footer={
        <>
          {task && (
            <>
              <ConfirmButton
                onConfirm={async () => {
                  await deleteTask(task.id)
                  toast('To-do deleted')
                  close()
                }}
                confirmText="Delete?"
              >
                <Trash2 size={16} />
              </ConfirmButton>
              <Button
                variant="outline"
                aria-label="Archive to-do"
                onClick={async () => {
                  await archiveTask(task.id)
                  toast('To-do archived', { emoji: '📦' })
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
      <Field label="To-do">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Call the bank"
        />
      </Field>
      <ForPicker value={forId} onChange={setForId} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={repeat === 'none' ? 'Date' : 'Starts on'}
          hint={repeat === 'none' ? 'Empty = someday' : undefined}
        >
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Time (optional)">
          <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Remind me">
        <RemindPicker id="task-remind" value={remind} onChange={setRemind} hasTime={!!dueTime} />
      </Field>
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
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm">⭐ Important</span>
        <Toggle checked={important} onChange={setImportant} label="Important" />
      </label>
      <Field label="Notes (optional)">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </Field>
    </Sheet>
  )
}
