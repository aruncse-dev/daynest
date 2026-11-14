import {
  IconFamily,
  IconFamilyFilled,
  IconRoutines,
  IconRoutinesFilled,
  IconToday,
  IconTodayFilled,
  IconTodos,
  IconTodosFilled,
} from '@/components/icons'

/** Four tabs. Settings lives behind the avatar. Filled icon = the tab you're on. */
export const NAV = [
  { to: '/', label: 'Today', icon: IconToday, active: IconTodayFilled },
  { to: '/plan', label: 'To-dos', icon: IconTodos, active: IconTodosFilled },
  { to: '/routines', label: 'Routines', icon: IconRoutines, active: IconRoutinesFilled },
  { to: '/family', label: 'Family', icon: IconFamily, active: IconFamilyFilled },
] as const
