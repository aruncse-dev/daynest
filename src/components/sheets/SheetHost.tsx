import { useUI } from '@/store/ui'
import { QuickAddSheet, TaskSheet } from './TaskSheets'
import { HabitDetailSheet } from './HabitDetailSheet'
import { AddNudgeSheet } from './AddNudgeSheet'
import { EventSheet, GoalSheet, HabitSheet, ProfileSheet, ReminderSheet } from './OtherSheets'

export function SheetHost() {
  const sheet = useUI((s) => s.sheet)
  if (!sheet) return null
  // `key` resets form state when switching between items
  switch (sheet.type) {
    case 'quickAdd':
      return <QuickAddSheet />
    case 'task':
      return <TaskSheet key={sheet.task?.id ?? 'new'} task={sheet.task} defaults={sheet.defaults} />
    case 'habit':
      return <HabitSheet key={sheet.habit?.id ?? 'new'} habit={sheet.habit} />
    case 'addNudge':
      return <AddNudgeSheet />
    case 'habitDetail':
      return <HabitDetailSheet key={sheet.habitId} habitId={sheet.habitId} />
    case 'event':
      return <EventSheet key={sheet.event?.id ?? 'new'} event={sheet.event} date={sheet.date} />
    case 'goal':
      return <GoalSheet key={sheet.goal?.id ?? 'new'} goal={sheet.goal} />
    case 'profile':
      return <ProfileSheet key={sheet.profile?.id ?? 'new'} profile={sheet.profile} />
    case 'reminder':
      return <ReminderSheet key={sheet.reminder?.id ?? 'new'} reminder={sheet.reminder} />
  }
}
