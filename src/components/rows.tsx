import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, Repeat } from 'lucide-react'
import { db } from '@/db/db'
import type { CalendarEvent, Habit, ReminderLink } from '@/db/types'
import { toggleHabit, toggleTask } from '@/db/actions'
import { formatLocal, formatTime12, todayLocal, type LocalDate } from '@/lib/date'
import type { DayTask } from '@/lib/queries'
import { describeRule } from '@/lib/recurrence'
import { toast, useUI } from '@/store/ui'
import { useProfileMap } from '@/lib/hooks'
import { chime } from '@/lib/sound'
import { CheckBox, Tag, cx } from './ui'

/** Name tag for items that belong to a family member (not you). */
function OwnerTag({ profileId }: { profileId?: string | null }) {
  const p = useProfileMap().get(profileId ?? '')
  if (!p || p.isPrimary) return null
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold text-ink/70">
      · {p.avatar} {p.name}
    </span>
  )
}

/** The reminder time(s) attached to a habit, to-do or event, if any. */
function useReminderTimes(type: ReminderLink['type'], id: string): string | null {
  const r = useLiveQuery(
    () =>
      db.reminders.filter((x) => x.link?.type === type && x.link.id === id && x.enabled).first(),
    [type, id],
  )
  return r?.times?.length ? r.times.map((t) => formatTime12(t)).join(', ') : null
}

function BellTag({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <span className="inline-flex items-center gap-0.5 text-sage-ink" title={`Reminder at ${text}`}>
      <Bell size={11} /> {text}
    </span>
  )
}

export function TaskRow({ item, showDate }: { item: DayTask; showDate?: boolean }) {
  const { task, done, overdue, date } = item
  const openSheet = useUI((s) => s.openSheet)
  const bell = useReminderTimes('task', task.id)
  const when = task.dueTime
    ? formatTime12(task.dueTime)
    : overdue && task.dueDate
      ? `from ${formatLocal(task.dueDate, 'd MMM')}`
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
        label={done ? `Mark “${task.title}” not done` : `Mark “${task.title}” done`}
        onChange={async () => {
          await toggleTask(task, overdue ? todayLocal() : date)
          if (!done) {
            chime('tick')
            toast(task.recurrenceRule ? 'Done for today' : 'Nice — done!', {
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
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
          <span className={cx(overdue && 'text-amber-ink')}>{when}</span>
          {task.recurrenceRule && (
            <span className="inline-flex items-center gap-0.5">
              · <Repeat size={11} /> {describeRule(task.recurrenceRule)}
            </span>
          )}
          {bell && (
            <span className="inline-flex items-center gap-1">
              · <BellTag text={bell} />
            </span>
          )}
          <OwnerTag profileId={task.profileId} />
        </div>
      </button>
      {!done && (task.priority === 'high' || task.priority === 'important') && (
        <Tag tone="amber">⭐</Tag>
      )}
    </div>
  )
}

export function HabitRow({
  habit,
  done,
  date = todayLocal(),
  streak,
  locked,
}: {
  habit: Habit
  done: boolean
  date?: LocalDate
  streak?: number
  /** e.g. a future day: shown, but can't be ticked yet */
  locked?: boolean
}) {
  const bell = useReminderTimes('habit', habit.id)
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
        <small className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
          {habit.targetLabel ?? 'Daily'}
          <OwnerTag profileId={habit.profileId} />
          {streak ? <span className="text-amber-ink">· 🔥 {streak}</span> : null}
          {bell && (
            <span className="inline-flex items-center gap-1">
              · <BellTag text={bell} />
            </span>
          )}
        </small>
      </div>
      <CheckBox
        size="lg"
        checked={done}
        disabled={locked}
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
  const bell = useReminderTimes('event', event.id)
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
        <small className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
          {formatLocal(date, 'EEEE')}
          {event.startTime ? ` · ${formatTime12(event.startTime)}` : ' · All day'}
          {bell && (
            <span className="inline-flex items-center gap-1">
              · <BellTag text={bell} />
            </span>
          )}
          <OwnerTag profileId={event.profileId} />
        </small>
      </div>
    </button>
  )
}
