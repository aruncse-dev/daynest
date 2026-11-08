import { CalendarCheck, Repeat, Sun, Users } from 'lucide-react'

/** Three tabs (+ Family when family mode is on). Settings lives behind the avatar. */
export const NAV = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/plan', label: 'Plan', icon: CalendarCheck },
  { to: '/routines', label: 'Routines', icon: Repeat },
  { to: '/family', label: 'Family', icon: Users, familyOnly: true },
] as const
