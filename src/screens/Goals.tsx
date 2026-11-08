import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Goal, GoalHorizon, Task } from '@/db/types'
import { formatLocal } from '@/lib/date'
import { useProfileMap, useToday } from '@/lib/hooks'
import { useUI } from '@/store/ui'
import {
  Avatar,
  Button,
  EmptyState,
  LinkButton,
  PageHeader,
  Panel,
  Ring,
  Segmented,
  Tag,
} from '@/components/ui'
import { TaskRow } from '@/components/rows'
import { goalProgress } from '@/lib/goals'

export function Goals() {
  const [horizon, setHorizon] = useState<GoalHorizon>('month')
  const openSheet = useUI((s) => s.openSheet)
  const data = useLiveQuery(async () => {
    const [goals, tasks] = await Promise.all([
      db.goals.toArray(),
      db.tasks.filter((t) => !!t.goalId).toArray(),
    ])
    return { goals, tasks }
  }, [])
  const goals = data?.goals.filter((g) => g.horizon === horizon) ?? []
  const active = goals.filter((g) => g.status === 'active' || g.status === 'paused')
  const finished = goals.filter((g) => g.status === 'achieved' || g.status === 'dropped')
  return (
    <div>
      <PageHeader
        eyebrow="Goals & plans"
        title="Where you're heading"
        sub="A few meaningful goals, broken into small tasks."
        action={<Button onClick={() => openSheet({ type: 'goal' })}>+ New goal</Button>}
      />
      <div className="mb-4">
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
      </div>
      {active.length === 0 && (
        <Panel>
          <EmptyState
            emoji="🎯"
            title="No goals in this plan yet"
            text="Try one gentle goal — like “Family walk every weekend”."
            action={
              <Button size="sm" onClick={() => openSheet({ type: 'goal' })}>
                + New goal
              </Button>
            }
          />
        </Panel>
      )}
      <div className="grid items-start gap-4 md:grid-cols-2 stagger">
        {active.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            tasks={data?.tasks.filter((t) => t.goalId === g.id) ?? []}
          />
        ))}
      </div>
      {finished.length > 0 && (
        <Panel className="mt-4">
          <div className="mb-2 text-xs font-bold text-muted">Completed & let go</div>
          {finished.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => openSheet({ type: 'goal', goal: g })}
              className="flex w-full items-center gap-2 border-b border-line-soft py-2 text-left text-sm last:border-0"
            >
              <span>{g.emoji ?? '🎯'}</span>
              <span className="flex-1 truncate">{g.title}</span>
              <Tag tone={g.status === 'achieved' ? 'sage' : 'muted'}>
                {g.status === 'achieved' ? 'Achieved 🎉' : 'Let go'}
              </Tag>
            </button>
          ))}
        </Panel>
      )}
      <p className="mt-6 text-center text-[11px] text-muted">
        Progress counts one-off tasks linked to a goal. Recurring tasks support the goal but aren't
        counted.
      </p>
    </div>
  )
}

function GoalCard({ goal, tasks }: { goal: Goal; tasks: Task[] }) {
  const today = useToday()
  const openSheet = useUI((s) => s.openSheet)
  const profiles = useProfileMap()
  const owner = goal.profileId ? profiles.get(goal.profileId) : undefined
  const p = goalProgress(tasks)
  return (
    <Panel>
      <div className="mb-3 flex items-start gap-3">
        <Ring value={p.ratio} size={58}>
          {p.total ? `${Math.round(p.ratio * 100)}%` : (goal.emoji ?? '🎯')}
        </Ring>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => openSheet({ type: 'goal', goal })}
            className="text-left"
          >
            <h2 className="text-base font-bold leading-snug">
              {goal.emoji} {goal.title}
            </h2>
          </button>
          {goal.description && <p className="text-xs text-muted">{goal.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            {owner && (
              <span className="flex items-center gap-1">
                <Avatar avatar={owner.avatar} color={owner.color} size={18} /> {owner.name}
              </span>
            )}
            {goal.targetDate && <span>Target {formatLocal(goal.targetDate, 'd MMM')}</span>}
            {goal.status === 'paused' && <Tag tone="muted">Paused</Tag>}
            <span>
              {p.done}/{p.total} tasks
            </span>
          </div>
        </div>
      </div>
      {tasks
        .filter((t) => t.status !== 'archived')
        .map((t) => (
          <TaskRow
            key={t.id}
            item={{ task: t, date: t.dueDate ?? today, done: t.status === 'done', overdue: false }}
            showDate
          />
        ))}
      <LinkButton
        className="mt-2"
        onClick={() => openSheet({ type: 'task', defaults: { goalId: goal.id, dueDate: null } })}
      >
        + Add a step
      </LinkButton>
    </Panel>
  )
}
