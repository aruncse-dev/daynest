import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { AnimatedBackground } from './AnimatedBackground'
import { NAV } from './nav'
import { Avatar, cx } from '@/components/ui'
import { usePrimaryProfile } from '@/lib/hooks'
import { useUI } from '@/store/ui'
import { Toasts } from './Toasts'
import { NudgeHost } from './NudgeHost'
import { SheetHost } from '@/components/sheets/SheetHost'
import { UpdatePrompt } from './UpdatePrompt'

/** Mobile-first single column. On larger screens the same phone layout is centred. */
export function AppShell() {
  const me = usePrimaryProfile()
  const openSheet = useUI((s) => s.openSheet)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const showFab = pathname === '/' || pathname === '/plan'
  // toasts belong to the screen they were shown on
  useEffect(() => useUI.setState({ toasts: [] }), [pathname])

  return (
    <>
      <AnimatedBackground leaves={5} />
      <div className="mx-auto min-h-dvh w-full max-w-[480px] px-4 pb-[150px] pt-[max(14px,env(safe-area-inset-top))]">
        <header className="mb-3 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-bold tracking-[-.5px]">
            <img src="/favicon.svg" alt="" className="size-9 rounded-xl shadow-sm" />
            daynest
          </NavLink>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            aria-label="Settings and profile"
            className="rounded-full ring-2 ring-transparent transition hover:ring-sage-line"
          >
            <Avatar avatar={me?.avatar ?? '🙂'} color={me?.color} size={38} />
          </button>
        </header>
        <main id="main" key={pathname} className="animate-rise">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-[var(--nav)] backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-[480px] justify-around px-2 pb-safe pt-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx(
                  'grid flex-1 justify-items-center gap-0.5 py-1 text-[11px]',
                  isActive ? 'font-bold text-sage-ink' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cx(
                      'grid h-8 w-14 place-items-center rounded-full transition',
                      isActive && 'bg-sage-soft',
                    )}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {showFab && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-20 mx-auto flex max-w-[480px] justify-end px-4">
          <button
            type="button"
            onClick={() => openSheet({ type: 'quickAdd' })}
            aria-label="Quick add task"
            className="pointer-events-auto grid size-14 place-items-center rounded-2xl bg-sage text-white shadow-[0_10px_24px_#47765b66] transition hover:brightness-105 active:scale-95"
          >
            <Plus size={26} strokeWidth={2.6} />
          </button>
        </div>
      )}

      <NudgeHost />
      <Toasts />
      <SheetHost />
      <UpdatePrompt />
    </>
  )
}
