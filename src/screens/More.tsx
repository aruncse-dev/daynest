import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { NAV } from '@/components/layout/nav'
import { PageHeader } from '@/components/ui'

const DESCRIPTIONS: Record<string, string> = {
  '/calendar': 'Month, week & agenda',
  '/family': 'Profiles and shared view',
  '/goals': 'Weekly & monthly plans',
  '/reminders': 'Water, posture, footwear & more',
  '/settings': 'Backup, theme, data',
}
const TINTS: Record<string, string> = {
  '/calendar': 'bg-amber-soft text-amber-ink',
  '/family': 'bg-rose-soft text-rose-ink',
  '/goals': 'bg-lilac text-[#5b4f86] dark:text-[#c7b8ea]',
  '/reminders': 'bg-sage-soft text-sage-ink',
  '/settings': 'bg-sky text-[#3c6478] dark:text-[#9ccbe0]',
}

export function More() {
  const items = NAV.filter((n) => !n.mobile)
  return (
    <div>
      <PageHeader eyebrow="More" title="Everything else" />
      <div className="grid gap-3 sm:grid-cols-2 stagger">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 rounded-[20px] border border-line bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 active:scale-[.98]"
          >
            <span className={`grid size-12 place-items-center rounded-2xl ${TINTS[to]}`}>
              <Icon size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{label}</span>
              <span className="block text-xs text-muted">{DESCRIPTIONS[to]}</span>
            </span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
      </div>
    </div>
  )
}
