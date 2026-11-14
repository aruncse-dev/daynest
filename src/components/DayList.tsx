import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Habit, Profile } from '@/db/types'
import type { LocalDate } from '@/lib/date'
import type { DayTask } from '@/lib/queries'
import { displayName } from '@/lib/people'
import { HabitRow, TaskRow } from './rows'
import { Avatar, cx } from './ui'
import { IconEveryone } from './icons'

type DayHabit = { habit: Habit; done: boolean }

/** "Show 6 more" / "Show less" under a long list. */
export function MoreButton({
  hidden,
  open,
  onClick,
  label = 'more',
}: {
  hidden: number
  open: boolean
  onClick: () => void
  label?: string
}) {
  if (!hidden && !open) return null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="mt-1.5 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-xs font-bold text-sage-ink"
    >
      {open ? 'Show less' : `Show ${hidden} ${label}`}
      <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} />
    </button>
  )
}

/**
 * One day's items, built to stay short: what's left to do comes first (up to `limit`),
 * finished ones fold into a "✓ 3 done" line you can open.
 */
export function DayItems({
  tasks,
  habits,
  date,
  locked,
  hideOwner,
  limit = 8,
}: {
  tasks: DayTask[]
  habits: DayHabit[]
  date: LocalDate
  locked?: boolean
  hideOwner?: string
  limit?: number
}) {
  const [showAll, setShowAll] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const open = [
    ...tasks.filter((t) => !t.done).map((t) => ({ kind: 'task' as const, t })),
    ...habits.filter((h) => !h.done).map((h) => ({ kind: 'habit' as const, h })),
  ]
  const done = [
    ...tasks.filter((t) => t.done).map((t) => ({ kind: 'task' as const, t })),
    ...habits.filter((h) => h.done).map((h) => ({ kind: 'habit' as const, h })),
  ]
  const visible = showAll ? open : open.slice(0, limit)

  const render = (x: (typeof open)[number]) =>
    x.kind === 'task' ? (
      <TaskRow key={x.t.task.id} item={x.t} hideOwner={hideOwner} />
    ) : (
      <div key={x.h.habit.id} className="border-b border-line-soft py-2 last:border-0">
        <HabitRow
          habit={x.h.habit}
          done={x.h.done}
          date={date}
          locked={locked}
          hideOwner={hideOwner}
        />
      </div>
    )

  return (
    <div>
      {visible.map(render)}
      {!open.length && done.length > 0 && (
        <p className="py-2 text-xs font-semibold text-sage-ink">All done 🎉</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3">
        <MoreButton
          hidden={open.length - visible.length}
          open={showAll}
          onClick={() => setShowAll(!showAll)}
        />
        {done.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            aria-expanded={showDone}
            className="mt-1.5 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-xs font-bold text-muted"
          >
            ✓ {done.length} done
            <ChevronDown
              size={14}
              className={cx('transition-transform', showDone && 'rotate-180')}
            />
          </button>
        )}
      </div>
      {showDone && <div className="opacity-80">{done.map(render)}</div>}
    </div>
  )
}

/**
 * One person in the Everyone dashboard: a compact row (avatar, progress, what's next) that
 * opens into their list. Keeps a big family's day to one screen.
 */
export function PersonSection({
  profile,
  tasks,
  habits,
  date,
  locked,
  open,
  onToggle,
}: {
  profile?: Profile
  tasks: DayTask[]
  habits: DayHabit[]
  date: LocalDate
  locked?: boolean
  open: boolean
  onToggle: () => void
}) {
  const total = tasks.length + habits.length
  const done = tasks.filter((t) => t.done).length + habits.filter((h) => h.done).length
  const next = [
    ...tasks.filter((t) => !t.done).map((t) => t.task.title),
    ...habits.filter((h) => !h.done).map((h) => `${h.habit.emoji} ${h.habit.title}`),
  ]
  const name = profile ? displayName(profile) : 'Everyone'
  return (
    <section aria-label={name} className="border-b border-line-soft last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 py-2.5 text-left"
      >
        <Avatar
          avatar={profile?.avatar ?? <IconEveryone className="text-[17px] text-sage-ink" />}
          color={profile?.color ?? 'var(--green2)'}
          size={34}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <b className="truncate text-[13.5px]">{name}</b>
            <span className="h-1.5 max-w-16 flex-1 overflow-hidden rounded-full bg-surface2">
              <i
                className="block h-full rounded-full bg-sage transition-[width] duration-500"
                style={{ width: `${total ? (done / total) * 100 : 0}%` }}
              />
            </span>
            <span className="text-[11px] font-semibold tabular-nums text-muted">
              {done}/{total}
            </span>
          </span>
          {!open && (
            <span className="block truncate text-[11.5px] text-muted">
              {next.length
                ? `${next.slice(0, 2).join(' · ')}${next.length > 2 ? ` +${next.length - 2}` : ''}`
                : 'All done 🎉'}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="pb-2 pl-1 animate-fade">
          <DayItems
            tasks={tasks}
            habits={habits}
            date={date}
            locked={locked}
            hideOwner={profile?.id}
            limit={6}
          />
        </div>
      )}
    </section>
  )
}

/** A person's block in an Everyone list (Routines): header with a summary, opens on tap. */
export function PersonGroup({
  profile,
  summary,
  defaultOpen,
  children,
}: {
  profile?: Profile
  summary: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  const name = profile ? displayName(profile) : 'Everyone'
  return (
    <section aria-label={name} className="border-b border-line-soft last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 py-2 text-left"
      >
        <Avatar
          avatar={profile?.avatar ?? <IconEveryone className="text-[17px] text-sage-ink" />}
          color={profile?.color ?? 'var(--green2)'}
          size={30}
        />
        <b className="flex-1 truncate text-[13.5px]">{name}</b>
        <span className="truncate text-[11.5px] text-muted">{summary}</span>
        <ChevronDown
          size={18}
          className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="pb-2.5 animate-fade">{children}</div>}
    </section>
  )
}
