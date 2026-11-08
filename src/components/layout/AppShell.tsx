import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Plus, WifiOff } from 'lucide-react'
import { AnimatedBackground } from './AnimatedBackground'
import { NAV } from './nav'
import { Avatar, cx } from '@/components/ui'
import { useOnline, usePrimaryProfile } from '@/lib/hooks'
import { useUI } from '@/store/ui'
import { Toasts } from './Toasts'
import { ReminderBanners } from './ReminderBanners'
import { SheetHost } from '@/components/sheets/SheetHost'
import { UpdatePrompt } from './UpdatePrompt'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'

const MORE_PATHS = ['/calendar', '/family', '/goals', '/reminders', '/settings', '/more']

export function AppShell() {
  const online = useOnline()
  const me = usePrimaryProfile()
  const openSheet = useUI((s) => s.openSheet)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeReminders = useLiveQuery(() => db.reminders.filter((r) => r.enabled).count(), [])
  const immersive = pathname.startsWith('/wellness')

  return (
    <>
      <AnimatedBackground leaves={immersive ? 10 : 5} intense={immersive} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto min-h-dvh max-w-[1120px] px-[15px] pb-[110px] pt-[17px] sm:px-6 sm:pt-[22px] md:pb-10">
        <header className="mb-5 flex items-center justify-between sm:mb-6">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-.5px]"
          >
            <img src="/favicon.svg" alt="" className="size-[38px] rounded-[13px] shadow-sm" />
            daynest
          </NavLink>
          <div className="flex items-center gap-2">
            {!online && (
              <span
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted animate-fade"
                role="status"
              >
                <WifiOff size={13} /> Offline · saved on device
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate('/reminders')}
              aria-label="Reminders"
              className="relative grid size-10 place-items-center rounded-[13px] border border-line bg-surface hover:bg-surface2"
            >
              <Bell size={18} />
              {!!activeReminders && (
                <span className="absolute right-2 top-2 size-2 rounded-full bg-sage ring-2 ring-surface" />
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              aria-label="Profile and settings"
              className="rounded-full"
            >
              <Avatar avatar={me?.avatar ?? '🙂'} color={me?.color} size={38} />
            </button>
          </div>
        </header>

        {/* Desktop navigation (pills, like the mock) */}
        <nav aria-label="Main navigation" className="mb-5 hidden flex-wrap gap-2 md:flex">
          {NAV.filter((n) => !('mobileOnly' in n)).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition',
                  isActive
                    ? 'border-sage bg-sage text-white shadow-[0_6px_16px_#47765b33]'
                    : 'border-line bg-surface text-muted hover:text-ink',
                )
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        <main id="main" key={pathname} className="animate-rise">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-20 flex justify-center border-t border-line bg-[var(--nav)] px-2 pb-safe pt-2 backdrop-blur-xl md:hidden"
      >
        {NAV.filter((n) => n.mobile).map(({ to, label, icon: Icon }) => {
          const isMore = to === '/more'
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => {
                const active = isActive || (isMore && MORE_PATHS.includes(pathname))
                return cx(
                  'grid w-[min(20%,110px)] justify-items-center gap-0.5 py-1 text-[10px]',
                  active ? 'font-bold text-sage-ink' : 'text-muted',
                )
              }}
            >
              {({ isActive }) => {
                const active = isActive || (isMore && MORE_PATHS.includes(pathname))
                return (
                  <>
                    <span
                      className={cx(
                        'grid h-7 w-12 place-items-center rounded-full transition',
                        active && 'bg-sage-soft',
                      )}
                    >
                      <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                    </span>
                    {label}
                  </>
                )
              }}
            </NavLink>
          )
        })}
      </nav>

      {!immersive && (
        <button
          type="button"
          onClick={() => openSheet({ type: 'quickAdd' })}
          className="fixed bottom-[82px] right-[max(16px,calc((100vw-1120px)/2+24px))] z-20 flex min-h-12 items-center gap-1.5 rounded-2xl bg-sage px-4 font-bold text-white shadow-[0_8px_20px_#47765b55] transition hover:brightness-105 active:scale-95 md:bottom-7"
        >
          <Plus size={18} strokeWidth={2.6} /> Quick add
        </button>
      )}

      <ReminderBanners />
      <Toasts />
      <SheetHost />
      <UpdatePrompt />
    </>
  )
}
