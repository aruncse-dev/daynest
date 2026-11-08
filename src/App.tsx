import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { SETTING_ONBOARDED } from '@/db/seed'
import { maybeDailySnapshot } from '@/lib/folderBackup'
import { useSetting } from '@/lib/hooks'
import { AppShell } from '@/components/layout/AppShell'
import { ReminderRunner } from '@/components/layout/ReminderRunner'
import { Skeleton } from '@/components/ui'
import { Today } from '@/screens/Today'
import { Setup } from '@/screens/Setup'

const Plan = lazy(() => import('@/screens/Plan').then((m) => ({ default: m.Plan })))
const Routines = lazy(() => import('@/screens/Routines').then((m) => ({ default: m.Routines })))
const Family = lazy(() => import('@/screens/Family').then((m) => ({ default: m.Family })))
const Settings = lazy(() => import('@/screens/Settings').then((m) => ({ default: m.Settings })))

function useTheme() {
  const theme = useSetting<'light' | 'dark' | 'system'>('theme', 'system')
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#121814' : '#f5f6f2')
      try {
        localStorage.setItem('daynest-theme', theme) // only to avoid a colour flash on next load
      } catch {
        /* ignore */
      }
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export default function App() {
  useTheme()
  const onboarded = useLiveQuery(
    async () => (await db.settings.get(SETTING_ONBOARDED))?.value === true,
    [],
  )

  useEffect(() => {
    if (onboarded) void maybeDailySnapshot().catch(() => undefined)
  }, [onboarded])

  if (onboarded === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <img
          src="/favicon.svg"
          alt="Loading DayNest"
          className="size-14 animate-pulse rounded-2xl"
        />
      </div>
    )
  }

  return (
    <BrowserRouter>
      {!onboarded ? (
        <Setup onboarding />
      ) : (
        <>
          <ReminderRunner />
          <Suspense
            fallback={
              <div className="mx-auto max-w-[480px] p-4">
                <Skeleton lines={6} />
              </div>
            }
          >
            <Routes>
              <Route path="setup" element={<Setup />} />
              <Route element={<AppShell />}>
                <Route index element={<Today />} />
                <Route path="plan" element={<Plan />} />
                <Route path="routines" element={<Routines />} />
                <Route path="family" element={<Family />} />
                <Route path="settings" element={<Settings />} />
                {/* old links */}
                <Route path="tasks" element={<Navigate to="/plan" replace />} />
                <Route path="calendar" element={<Navigate to="/plan?tab=calendar" replace />} />
                <Route path="goals" element={<Navigate to="/plan?tab=goals" replace />} />
                <Route path="habits" element={<Navigate to="/routines" replace />} />
                <Route path="reminders" element={<Navigate to="/routines?tab=nudges" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </>
      )}
    </BrowserRouter>
  )
}
