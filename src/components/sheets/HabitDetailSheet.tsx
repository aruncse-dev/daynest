import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '@/db/db'
import { toggleHabit } from '@/db/actions'
import {
  compareLocal,
  formatLocal,
  monthGrid,
  parseLocalDate,
  sameMonth,
  toLocalDate,
  WEEKDAY_LETTER,
  WEEK_ORDER,
} from '@/lib/date'
import { currentStreak, isScheduledOn, longestStreak } from '@/lib/habits'
import { useToday } from '@/lib/hooks'
import { useUI } from '@/store/ui'
import { Button, Sheet, cx } from '@/components/ui'

export function HabitDetailSheet({ habitId }: { habitId: string }) {
  const close = useUI((s) => s.closeSheet)
  const openSheet = useUI((s) => s.openSheet)
  const today = useToday()
  const [month, setMonth] = useState(today)
  const habit = useLiveQuery(() => db.habits.get(habitId), [habitId])
  const done = useLiveQuery(
    async () =>
      new Set(
        (await db.habitEntries.where('habitId').equals(habitId).toArray()).map((e) => e.localDate),
      ),
    [habitId],
  )
  if (!habit || !done) return null
  const grid = monthGrid(month)
  const cur = currentStreak(habit, done, today)
  const best = longestStreak(habit, done, today)
  const monthDays = grid.filter(
    (d) => sameMonth(d, month) && compareLocal(d, today) <= 0 && isScheduledOn(habit, d),
  )
  const monthDone = monthDays.filter((d) => done.has(d)).length
  const shift = (n: number) => {
    const d = parseLocalDate(month)
    setMonth(toLocalDate(new Date(d.getFullYear(), d.getMonth() + n, 1)))
  }
  return (
    <Sheet
      title={`${habit.emoji} ${habit.title}`}
      onClose={close}
      footer={
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => openSheet({ type: 'habit', habit })}
        >
          Edit, pause or delete
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          [`🔥 ${cur}`, 'Current streak'],
          [`🏆 ${best}`, 'Best streak'],
          [
            monthDays.length ? `${Math.round((monthDone / monthDays.length) * 100)}%` : '—',
            formatLocal(month, 'MMMM'),
          ],
        ].map(([v, l]) => (
          <div key={l} className="rounded-xl bg-surface2 px-2 py-2.5">
            <div className="text-base font-bold">{v}</div>
            <div className="truncate text-[10px] text-muted">{l}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shift(-1)}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface2"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold">{formatLocal(month, 'MMMM yyyy')}</span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shift(1)}
            disabled={sameMonth(month, today)}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface2 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted">
          {WEEK_ORDER.map((d) => (
            <span key={d}>{WEEKDAY_LETTER[d]}</span>
          ))}
          {grid.map((d) => {
            const future = compareLocal(d, today) > 0
            const isDone = done.has(d)
            return (
              <button
                key={d}
                type="button"
                disabled={!sameMonth(d, month) || future}
                onClick={() => toggleHabit(habit.id, d)}
                aria-label={`${formatLocal(d, 'd MMMM')}: ${isDone ? 'done' : 'not done'}`}
                className={cx(
                  'aspect-square rounded-lg text-[11px] transition',
                  !sameMonth(d, month) && 'invisible',
                  isDone
                    ? 'bg-sage font-bold text-white'
                    : isScheduledOn(habit, d) && !future
                      ? 'bg-surface2'
                      : 'text-muted/40',
                  d === today && 'ring-2 ring-sage/50',
                )}
              >
                {parseLocalDate(d).getDate()}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Tap a past day to fix a missed check-in. Editing the habit never changes this history.
        </p>
      </div>
    </Sheet>
  )
}
