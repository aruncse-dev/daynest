import { CalendarCheck, Repeat, Sun, Users } from 'lucide-react'

/** Three tabs, plus Family once a family member is added. Settings lives behind the avatar. */
export const NAV = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/plan', label: 'Plan', icon: CalendarCheck },
  { to: '/routines', label: 'Routines', icon: Repeat },
  { to: '/family', label: 'Family', icon: Users, needsMembers: true },
] as const
