import { Repeat } from 'lucide-react'
import type { CalendarEvent, Habit, Profile } from '@/db/types'
import { toggleHabit, toggleTask } from '@/db/actions'
import { formatLocal, formatTime12, todayLocal, type LocalDate } from '@/lib/date'
import type { DayTask } from '@/lib/queries'
import { describeRule } from '@/lib/recurrence'
import { useFamilyMode, useProfileMap } from '@/lib/hooks'
import { toast, useUI } from '@/store/ui'
import { chime } from '@/lib/sound'
import { Avatar, CheckBox, Tag, cx } from './ui'

const PRIORITY_TAG = {
  high: { label: 'High', tone: 'rose' as const },
  important: { label: 'Important', tone: 'amber' as const },
}

export function TaskRow({ item, showDate }: { item: DayTask; showDate?: boolean }) {
  const { task, done, overdue, date } = item
  const openSheet = useUI((s) => s.openSheet)
  const profiles = useProfileMap()
  const family = useFamilyMode()
  const owner = family && task.profileId ? profiles.get(task.profileId) : undefined
  const tag = PRIORITY_TAG[task.priority as keyof typeof PRIORITY_TAG]
  const when = task.dueTime
    ? formatTime12(task.dueTime)
    : overdue && task.dueDate
      ? `was due ${formatLocal(task.dueDate, 'd MMM')}`
      : showDate && task.dueDate
        ? formatLocal(task.dueDate, 'EEE d MMM')
        : task.dueDate
          ? date === todayLocal()
            ? 'Today'
            : formatLocal(date, 'EEE d MMM')
          : 'Someday'

  return (
    <div className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0 last:pb-0">
      <CheckBox
        checked={done}
        label={done ? `Mark “${task.title}” incomplete` : `Mark “${task.title}” complete`}
        onChange={async () => {
          await toggleTask(task, overdue ? todayLocal() : date)
          if (!done) {
            chime('tick')
            toast(task.recurrenceRule ? 'Done for today' : 'Nice — task done', {
              emoji: '🌿',
              action: {
                label: 'Undo',
                run: () => void toggleTask(task, overdue ? todayLocal() : date),
              },
            })
          }
        }}
      />
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => openSheet({ type: 'task', task })}
      >
        <div
          className={cx(
            'truncate text-[13.5px] font-semibold transition-colors',
            done && 'text-muted line-through',
          )}
        >
          {task.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
          <span>{task.category}</span>·
          <span className={cx(overdue && 'text-amber-ink')}>{when}</span>
          {task.recurrenceRule && (
            <span
              className="inline-flex items-center gap-0.5"
              title={describeRule(task.recurrenceRule)}
            >
              · <Repeat size={11} /> {describeRule(task.recurrenceRule)}
            </span>
          )}
        </div>
      </button>
      {tag && !done && <Tag tone={tag.tone}>{tag.label}</Tag>}
      {owner && <Avatar avatar={owner.avatar} color={owner.color} size={24} />}
    </div>
  )
}

export function HabitRow({
  habit,
  done,
  date = todayLocal(),
  streak,
  owner,
}: {
  habit: Habit
  done: boolean
  date?: LocalDate
  streak?: number
  owner?: Profile
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cx(
          'grid size-[38px] shrink-0 place-items-center rounded-xl text-lg transition',
          done ? 'bg-sage-soft' : 'bg-surface2',
        )}
      >
        {habit.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[13.5px]">{habit.title}</b>
        <small className="flex items-center gap-1.5 text-[11px] text-muted">
          {habit.targetLabel ?? 'Daily'}
          {streak ? <span className="text-amber-ink">· 🔥 {streak}</span> : null}
          {owner && (
            <span>
              · {owner.avatar} {owner.name}
            </span>
          )}
        </small>
      </div>
      <CheckBox
        size="lg"
        checked={done}
        label={done ? `Undo ${habit.title}` : `Complete ${habit.title}`}
        onChange={async () => {
          const nowDone = await toggleHabit(habit.id, date)
          if (nowDone) {
            chime('tick')
            toast(`${habit.title} — well done!`, { emoji: habit.emoji })
          }
        }}
      />
    </div>
  )
}

const EVENT_EMOJI: Record<CalendarEvent['type'], string> = {
  event: '📅',
  appointment: '🩺',
  school: '🎒',
  birthday: '🎂',
  important: '⭐',
}

export function EventRow({ event, date }: { event: CalendarEvent; date: LocalDate }) {
  const openSheet = useUI((s) => s.openSheet)
  return (
    <button
      type="button"
      onClick={() => openSheet({ type: 'event', event })}
      className="flex w-full items-center gap-3 rounded-xl text-left hover:bg-surface2/60"
    >
      <div className="grid min-w-11 rounded-[10px] bg-amber-soft px-2 py-1.5 text-center text-[10px] text-amber-ink">
        <b className="block text-[15px] leading-tight">{formatLocal(date, 'd')}</b>
        {formatLocal(date, 'MMM').toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">
          {EVENT_EMOJI[event.type]} {event.title}
        </div>
        <small className="block text-[11px] text-muted">
          {formatLocal(date, 'EEEE')}
          {event.startTime ? ` · ${formatTime12(event.startTime)}` : ' · All day'}
        </small>
      </div>
    </button>
  )
}
