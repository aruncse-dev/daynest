import { db } from './db'
import { uuid } from '@/lib/id'
import { addLocalDays, nowIso, todayLocal, weekdayOf } from '@/lib/date'
import { REMINDER_PRESETS } from './reminderPresets'
import { clearAllData, setSetting } from './actions'
import type { Habit, HabitEntry, Profile, Reminder, Task } from './types'

export const SETTING_ONBOARDED = 'onboarded'
export const SETTING_SAMPLE = 'sampleData'

function reminderRows(enabledKeys: string[]): Reminder[] {
  const now = nowIso()
  return REMINDER_PRESETS.map((p) => ({
    ...p,
    id: uuid(),
    enabled: enabledKeys.includes(p.presetKey ?? ''),
    lastFiredSlot: now, // don't fire a slot that was already due when the reminder was created
    createdAt: now,
    updatedAt: now,
  }))
}

/** Fresh start: one primary profile + reminder presets (off until the user enables them). */
export async function startFresh(name: string) {
  const now = nowIso()
  await clearAllData()
  await db.profiles.add({
    id: uuid(),
    name: name.trim() || 'Me',
    avatar: (name.trim()[0] || 'M').toUpperCase(),
    color: '#dce9dc',
    role: 'Personal',
    isPrimary: true,
    createdAt: now,
    updatedAt: now,
  })
  await db.reminders.bulkAdd(reminderRows([]))
  await setSetting(SETTING_SAMPLE, false)
  await setSetting(SETTING_ONBOARDED, true)
}

/**
 * Obviously-fictional sample household so the app can be explored.
 * Settings → "Reset sample data" removes it.
 */
export async function loadSampleData(primaryName = 'Alex') {
  await clearAllData()
  const now = nowIso()
  const today = todayLocal()
  const p = (
    name: string,
    avatar: string,
    color: string,
    role: string,
    isPrimary = false,
  ): Profile => ({
    id: uuid(),
    name,
    avatar,
    color,
    role,
    isPrimary,
    createdAt: now,
    updatedAt: now,
  })
  const me = p(primaryName, primaryName[0]?.toUpperCase() ?? 'A', '#e9dfd0', 'Personal', true)
  const partner = p('Sam (sample)', 'S', '#f0dfdf', 'Personal')
  const kid1 = p('Mia (sample)', '👧', '#e6e2f1', 'Learning & play')
  const kid2 = p('Leo (sample)', '👦', '#dfeaf0', 'Learning & play')
  await db.profiles.bulkAdd([me, partner, kid1, kid2])

  const task = (t: Partial<Task> & Pick<Task, 'title'>): Task => ({
    id: uuid(),
    priority: 'normal',
    category: 'Personal',
    status: 'open',
    createdAt: now,
    updatedAt: now,
    dueDate: today,
    profileId: me.id,
    ...t,
  })
  const goalId = uuid()
  await db.goals.bulkAdd([
    {
      id: goalId,
      title: 'Calmer mornings (sample)',
      description: 'Prepare the night before so mornings feel unhurried.',
      profileId: me.id,
      horizon: 'month',
      status: 'active',
      emoji: '🌅',
      targetDate: addLocalDays(today, 21),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      title: 'Family walk every weekend',
      horizon: 'week',
      status: 'active',
      emoji: '🌳',
      profileId: null,
      createdAt: now,
      updatedAt: now,
    },
  ])
  await db.tasks.bulkAdd([
    task({
      title: 'Review project plan',
      category: 'Work',
      dueTime: '10:00',
      priority: 'high',
      status: 'done',
      completedAt: now,
    }),
    task({ title: 'Pay electricity bill', category: 'Home', status: 'done', completedAt: now }),
    task({
      title: 'Play with kids for 30 minutes',
      category: 'Family',
      priority: 'important',
      dueTime: '18:00',
    }),
    task({ title: 'Plan the coming week', dueTime: '20:30', goalId }),
    task({
      title: 'Lay out clothes for tomorrow',
      recurrenceRule: { type: 'daily' },
      dueTime: '21:00',
      goalId,
    }),
    task({
      title: 'Pack school bags',
      profileId: kid1.id,
      category: 'Family',
      recurrenceRule: { type: 'weekdays' },
      dueTime: '19:30',
    }),
    task({
      title: 'Water the plants',
      profileId: partner.id,
      category: 'Home',
      recurrenceRule: { type: 'selectedDays', days: [1, 4] },
    }),
    task({ title: 'Book dentist check-up', dueDate: addLocalDays(today, 3), category: 'Health' }),
    task({
      title: 'Buy birthday gift',
      dueDate: addLocalDays(today, 5),
      priority: 'high',
      profileId: partner.id,
    }),
    task({ title: 'Learn to bake bread', dueDate: null, category: 'Personal' }),
    task({ title: 'Sort out the garage', dueDate: null, category: 'Home' }),
  ])

  const habit = (h: Partial<Habit> & Pick<Habit, 'title' | 'emoji'>): Habit => ({
    id: uuid(),
    scheduleDays: [],
    status: 'active',
    profileId: me.id,
    createdAt: addLocalDays(today, -40) + 'T08:00:00.000Z',
    updatedAt: now,
    ...h,
  })
  const habits = [
    habit({ title: 'Morning walk', emoji: '🚶', targetLabel: '20 minutes' }),
    habit({ title: 'Drink enough water', emoji: '💧', targetLabel: '6 glasses' }),
    habit({ title: 'Read with kids', emoji: '📚', targetLabel: '15 minutes' }),
    habit({ title: '5 min meditation', emoji: '🧘', targetLabel: 'Before bed' }),
    habit({
      title: 'Screen-free family time',
      emoji: '📵',
      targetLabel: 'After dinner',
      profileId: partner.id,
    }),
    habit({
      title: 'Practise piano',
      emoji: '🎹',
      targetLabel: '10 minutes',
      profileId: kid1.id,
      scheduleDays: [1, 3, 5],
    }),
    habit({ title: 'Tidy toys', emoji: '🧸', profileId: kid2.id }),
  ]
  await db.habits.bulkAdd(habits)
  // Fictional history with gentle gaps so streaks & heatmap have something to show
  const entries: HabitEntry[] = []
  habits.forEach((h, hi) => {
    for (let i = 1; i <= 35; i++) {
      const d = addLocalDays(today, -i)
      const scheduled = h.scheduleDays.length === 0 || h.scheduleDays.includes(weekdayOf(d))
      if (!scheduled) continue
      if ((i * (hi + 3)) % 7 === 0 && i > 4) continue
      entries.push({ id: uuid(), habitId: h.id, localDate: d, completedAt: now })
    }
  })
  entries.push({ id: uuid(), habitId: habits[0].id, localDate: today, completedAt: now })
  entries.push({ id: uuid(), habitId: habits[2].id, localDate: today, completedAt: now })
  await db.habitEntries.bulkAdd(entries)

  await db.events.bulkAdd([
    {
      id: uuid(),
      title: 'School activity (sample)',
      localDate: addLocalDays(today, 2),
      startTime: '09:00',
      type: 'school',
      profileId: kid1.id,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      title: 'Important appointment',
      localDate: addLocalDays(today, 4),
      startTime: '11:30',
      type: 'appointment',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      title: "Sam's birthday (sample)",
      localDate: addLocalDays(today, 9),
      type: 'birthday',
      repeatYearly: true,
      profileId: partner.id,
      createdAt: now,
      updatedAt: now,
    },
  ])

  await db.wellnessSessions.bulkAdd([
    {
      id: uuid(),
      kind: 'breathing',
      routineId: 'calm',
      title: 'Calm breath',
      localDate: addLocalDays(today, -1),
      durationSec: 100,
      completedAt: now,
    },
    {
      id: uuid(),
      kind: 'yoga',
      routineId: 'yoga-morning',
      title: 'Morning wake-up flow',
      localDate: addLocalDays(today, -2),
      durationSec: 300,
      completedAt: now,
    },
  ])

  await db.reminders.bulkAdd(reminderRows(['water', 'posture', 'footwear']))
  await setSetting(SETTING_SAMPLE, true)
  await setSetting(SETTING_ONBOARDED, true)
}
