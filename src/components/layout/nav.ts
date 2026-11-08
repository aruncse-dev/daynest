import {
  Bell,
  CalendarDays,
  Flower2,
  Home,
  LayoutGrid,
  ListChecks,
  Repeat,
  Settings,
  Target,
  Users,
} from 'lucide-react'

export const NAV = [
  { to: '/', label: 'Home', icon: Home, mobile: true },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, mobile: true },
  { to: '/habits', label: 'Habits', icon: Repeat, mobile: true },
  { to: '/wellness', label: 'Wellness', icon: Flower2, mobile: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, mobile: false },
  { to: '/family', label: 'Family', icon: Users, mobile: false },
  { to: '/goals', label: 'Goals', icon: Target, mobile: false },
  { to: '/reminders', label: 'Reminders', icon: Bell, mobile: false },
  { to: '/settings', label: 'Settings', icon: Settings, mobile: false },
  { to: '/more', label: 'More', icon: LayoutGrid, mobile: true, mobileOnly: true },
] as const
