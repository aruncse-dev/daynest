import { CalendarCheck, Repeat, Sun } from 'lucide-react'

/** Three tabs. Settings lives behind the avatar. */
export const NAV = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/plan', label: 'Plan', icon: CalendarCheck },
  { to: '/routines', label: 'Routines', icon: Repeat },
] as const
