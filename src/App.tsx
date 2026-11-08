import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { SETTING_ONBOARDED } from '@/db/seed'
import { maybeDailySnapshot } from '@/lib/folderBackup'
import { useSetting } from '@/lib/hooks'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui'
import { ReminderRunner } from '@/components/layout/ReminderRunner'
import { Home } from '@/screens/Home'
import { Tasks } from '@/screens/Tasks'
import { Habits } from '@/screens/Habits'
import { Onboarding } from '@/screens/Onboarding'
const More = lazy(() => import('@/screens/More').then((m) => ({ default: m.More })))
const Settings = lazy(() => import('@/screens/Settings').then((m) => ({ default: m.Settings })))
const Reminders = lazy(() => import('@/screens/Reminders').then((m) => ({ default: m.Reminders })))
const Goals = lazy(() => import('@/screens/Goals').then((m) => ({ default: m.Goals })))
const Family = lazy(() => import('@/screens/Family').then((m) => ({ default: m.Family })))
const Calendar = lazy(() => import('@/screens/Calendar').then((m) => ({ default: m.Calendar })))
const Wellness = lazy(() => import('@/screens/Wellness').then((m) => ({ default: m.Wellness })))

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
        localStorage.setItem('daynest-theme', theme) // only to avoid a flash on next load
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
  if (!onboarded) return <Onboarding />

  return (
    <BrowserRouter>
      <ReminderRunner />
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1120px] p-6">
            <Skeleton lines={6} />
          </div>
        }
      >
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="habits" element={<Habits />} />
            <Route path="wellness" element={<Wellness />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="family" element={<Family />} />
            <Route path="goals" element={<Goals />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="settings" element={<Settings />} />
            <Route path="more" element={<More />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
