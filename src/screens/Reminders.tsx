import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BellRing, Info, Pencil } from 'lucide-react'
import { db } from '@/db/db'
import { saveReminder, setSetting } from '@/db/actions'
import { REMINDER_PRESETS } from '@/db/reminderPresets'
import type { Reminder } from '@/db/types'
import { describeSchedule, nextSlotAfter } from '@/lib/reminders'
import {
  notificationSupport,
  requestNotificationPermission,
  showSystemNotification,
} from '@/lib/notifications'
import { useNow, useSetting } from '@/lib/hooks'
import { chime } from '@/lib/sound'
import { toast, useUI } from '@/store/ui'
import { Button, EmptyState, IconButton, PageHeader, Panel, Toggle, cx } from '@/components/ui'

export function Reminders() {
  const now = useNow(30_000)
  const openSheet = useUI((s) => s.openSheet)
  const reminders = useLiveQuery(() => db.reminders.toArray(), [])
  const [perm, setPerm] = useState(notificationSupport())
  const sound = useSetting('reminderSound', true)
  const notifyWhenOpen = useSetting('notifyWhenOpen', false)

  const missingPresets = REMINDER_PRESETS.filter(
    (p) => !reminders?.some((r) => r.presetKey === p.presetKey),
  )
  const sorted = [...(reminders ?? [])].sort(
    (a, b) => Number(b.enabled) - Number(a.enabled) || a.title.localeCompare(b.title),
  )

  const enableNotifications = async () => {
    const result = await requestNotificationPermission()
    setPerm(result)
    if (result === 'granted') {
      await showSystemNotification({
        title: '🌿 DayNest notifications are on',
        body: 'Gentle reminders will appear here.',
      })
      toast('Notifications enabled', { emoji: '🔔' })
    } else if (result === 'denied') toast('Notifications are blocked in your browser settings')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reminders"
        title="Gentle nudges"
        sub="Water, posture, movement — small cues for a kinder day."
        action={<Button onClick={() => openSheet({ type: 'reminder' })}>+ Custom reminder</Button>}
      />

      <Panel className="mb-4">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sage-soft text-sage-ink">
            <BellRing size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold">Notifications</h2>
            <p className="text-xs text-muted">
              {perm === 'granted' &&
                'On. You will get a system notification when DayNest is in the background.'}
              {perm === 'default' &&
                'Allow notifications so reminders can appear even when DayNest is in the background.'}
              {perm === 'denied' &&
                'Blocked. Enable notifications for this site in your browser settings to receive system alerts.'}
              {perm === 'unsupported' &&
                'This browser does not support notifications. Reminders will still appear inside the app.'}
            </p>
          </div>
          {perm === 'default' && (
            <Button size="sm" onClick={enableNotifications}>
              Allow
            </Button>
          )}
          {perm === 'granted' && (
            <Button
              size="sm"
              variant="soft"
              onClick={() => {
                void showSystemNotification({
                  title: '💧 Test reminder',
                  body: 'This is how a DayNest reminder looks.',
                })
                chime('soft')
              }}
            >
              Test
            </Button>
          )}
        </div>
        <div className="mt-4 grid gap-3 border-t border-line-soft pt-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Soft chime when a reminder appears</span>
            <Toggle
              checked={sound}
              onChange={(v) => setSetting('reminderSound', v)}
              label="Reminder chime"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Also show system notification while app is open</span>
            <Toggle
              checked={notifyWhenOpen}
              onChange={(v) => setSetting('notifyWhenOpen', v)}
              label="Notify while open"
            />
          </label>
        </div>
        <details className="mt-3 rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">
          <summary className="flex cursor-pointer items-center gap-1.5 font-semibold">
            <Info size={13} /> How reminders work
          </summary>
          <p className="mt-2">
            DayNest has no server, so reminders are scheduled on this device. They fire while
            DayNest is open — in a tab, in the background, or as an installed app the system keeps
            alive. If the browser or app is fully closed, reminders can't fire; you'll see any
            missed one when you return (within ten minutes). Installing DayNest to your home screen
            gives the most reliable results. On iPhone, notifications require installing DayNest to
            the Home Screen (iOS 16.4+).
          </p>
        </details>
      </Panel>

      {!reminders ? null : sorted.length === 0 ? (
        <Panel>
          <EmptyState
            emoji="⏰"
            title="No reminders yet"
            text="Add one of the suggestions below or create your own."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 stagger">
          {sorted.map((r) => (
            <ReminderCard key={r.id} reminder={r} now={now} />
          ))}
        </div>
      )}

      {missingPresets.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 text-base font-bold">Suggestions</h2>
          <div className="flex flex-wrap gap-2">
            {missingPresets.map((p) => (
              <button
                key={p.presetKey}
                type="button"
                onClick={async () => {
                  await saveReminder({
                    ...p,
                    enabled: true,
                    lastFiredSlot: new Date().toISOString(),
                  })
                  toast(`${p.title} added`, { emoji: p.emoji })
                }}
                className="flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-xs font-semibold transition hover:border-sage active:scale-95"
              >
                <span>{p.emoji}</span> {p.title} <span className="text-sage-ink">+</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ReminderCard({ reminder: r, now }: { reminder: Reminder; now: Date }) {
  const openSheet = useUI((s) => s.openSheet)
  const next = r.enabled ? nextSlotAfter(r, now) : null
  return (
    <Panel className={cx('transition', !r.enabled && 'opacity-70')}>
      <div className="flex items-center gap-3">
        <div
          className={cx(
            'grid size-12 shrink-0 place-items-center rounded-2xl text-2xl transition',
            r.enabled ? 'bg-sage-soft' : 'bg-surface2 grayscale',
          )}
        >
          {r.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold">{r.title}</h3>
          <div className="truncate text-[11px] text-muted">{describeSchedule(r)}</div>
          {next && (
            <div className="text-[11px] font-semibold text-sage-ink">
              Next: {next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              {next.toDateString() !== now.toDateString() &&
                ` · ${next.toLocaleDateString([], { weekday: 'short' })}`}
            </div>
          )}
        </div>
        <IconButton
          label={`Edit ${r.title}`}
          onClick={() => openSheet({ type: 'reminder', reminder: r })}
        >
          <Pencil size={15} />
        </IconButton>
        <Toggle
          checked={r.enabled}
          label={`${r.title} enabled`}
          onChange={(v) =>
            saveReminder({
              ...r,
              enabled: v,
              lastFiredSlot: v ? new Date().toISOString() : r.lastFiredSlot,
            })
          }
        />
      </div>
    </Panel>
  )
}
