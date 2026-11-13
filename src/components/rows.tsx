import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, Repeat } from 'lucide-react'
import { db } from '@/db/db'
import type { CalendarEvent, Habit, ReminderLink } from '@/db/types'
import { toggleHabit, toggleTask } from '@/db/actions'
import { addLocalDays, formatLocal, formatTime12, todayLocal, type LocalDate } from '@/lib/date'
import type { DayTask } from '@/lib/queries'
import { describeRule } from '@/lib/recurrence'
import { eventEmoji } from '@/lib/people'
import { toast, useUI } from '@/store/ui'
import { useProfileMap } from '@/lib/hooks'
import { chime } from '@/lib/sound'
import { CheckBox, Tag, cx } from './ui'

/**
 * Who it's for: "· 🧒 Mia", "· 🧒 Mia & 👵 Amma", "· 🙂 Me +2". Hidden when it's only for you,
 * or when the list is already showing that one person (`hide`).
 */
export function OwnerTag({ ids, hide }: { ids: string[]; hide?: string }) {
  const map = useProfileMap()
  const people = ids.map((id) => map.get(id)).filter((p) => !!p)
  if (!people.length || (people.length === 1 && (people[0].isPrimary || people[0].id === hide)))
    return null
  const label = (p: (typeof people)[number]) => `${p.avatar} ${p.isPrimary ? 'Me' : p.name}`
  return (
    <span className="inline-flex min-w-0 items-center gap-0.5 font-semibold text-ink/70">
      ·{' '}
      {people.length <= 2
        ? people.map(label).join(' & ')
        : `${label(people[0])} +${people.length - 1}`}
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

export function TaskRow({
  item,
  showDate,
  hideOwner,
}: {
  item: DayTask
  showDate?: boolean
  /** the person whose list this is: no need to tag them */
  hideOwner?: string
}) {
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
          <OwnerTag ids={task.profileIds ?? []} hide={hideOwner} />
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
  hideOwner,
}: {
  hideOwner?: string
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
          <OwnerTag ids={habit.profileId ? [habit.profileId] : []} hide={hideOwner} />
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

export function EventRow({
  event,
  date,
  hideOwner,
  countdown,
}: {
  event: CalendarEvent
  date: LocalDate
  hideOwner?: string
  /** show "in 5 days" instead of the weekday (important dates) */
  countdown?: boolean
}) {
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
          {eventEmoji(event)} {event.title}
        </div>
        <small className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
          {countdown ? `${daysUntil(date)}${yearsText(event, date)}` : formatLocal(date, 'EEEE')}
          {event.startTime ? ` · ${formatTime12(event.startTime)}` : ' · All day'}
          {bell && (
            <span className="inline-flex items-center gap-1">
              · <BellTag text={bell} />
            </span>
          )}
          <OwnerTag ids={event.profileIds ?? []} hide={hideOwner} />
        </small>
      </div>
    </button>
  )
}

function daysUntil(date: LocalDate): string {
  const today = todayLocal()
  if (date === today) return 'Today 🎉'
  if (date === addLocalDays(today, 1)) return 'Tomorrow'
  const days = Math.round(
    (new Date(`${date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000,
  )
  return `In ${days} days`
}

/** " · turns 40" for birthdays, " · 10 years" for anniversaries, when the first year is known. */
function yearsText(event: CalendarEvent, on: LocalDate): string {
  if (!event.repeatYearly && event.type !== 'birthday') return ''
  const years = Number(on.slice(0, 4)) - Number(event.localDate.slice(0, 4))
  if (years <= 0) return ''
  if (event.type === 'birthday') return ` · turns ${years}`
  if (event.type === 'anniversary') return ` · ${years} year${years > 1 ? 's' : ''}`
  return ''
}
