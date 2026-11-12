import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { useSetting } from '@/lib/hooks'
import { isIOS, isStandalone } from '@/lib/install'
import {
  disablePush,
  enablePush,
  PUSH_ENABLED_KEY,
  pushConfigured,
  pushSupported,
  sendTestPush,
} from '@/lib/push'
import {
  notificationSupport,
  requestNotificationPermission,
  showSystemNotification,
} from '@/lib/notifications'
import { toast } from '@/store/ui'
import { Button, Toggle } from './ui'

/**
 * Notification status for the Reminders section. With the push server configured it offers
 * "always-on" reminders that work while DayNest is closed; otherwise just notification permission.
 */
export function AlwaysOnCard() {
  const enabled = useSetting(PUSH_ENABLED_KEY, false)
  const [busy, setBusy] = useState(false)
  const [perm, setPerm] = useState(notificationSupport())

  if (!pushConfigured()) {
    if (perm === 'granted' || perm === 'unsupported') return null
    return (
      <div className="mb-2 flex items-center gap-3 rounded-[14px] bg-sage-soft px-3 py-2.5 text-xs">
        <BellRing size={18} className="shrink-0 text-sage-ink" />
        <span className="flex-1">
          {perm === 'denied'
            ? 'Notifications are blocked. Allow them for this site in browser settings.'
            : 'Allow notifications so reminders reach you in the background.'}
        </span>
        {perm === 'default' && (
          <Button
            size="sm"
            onClick={async () => {
              const r = await requestNotificationPermission()
              setPerm(r)
              if (r === 'granted')
                await showSystemNotification({
                  title: '🌿 Reminders are on',
                  body: 'Friendly reminders will appear here.',
                })
            }}
          >
            Allow
          </Button>
        )}
      </div>
    )
  }

  const needsInstall = isIOS() && !isStandalone()
  return (
    <div className="mb-2 rounded-[14px] bg-sage-soft px-3 py-2.5 text-xs">
      <div className="flex items-center gap-3">
        <BellRing size={18} className="shrink-0 text-sage-ink" />
        <span className="flex-1">
          <b className="block text-[13px]">Reminders when DayNest is closed</b>
          {enabled
            ? 'On. Your phone will ring even if the app is closed.'
            : needsInstall
              ? 'On iPhone, add DayNest to your Home Screen first (Share ⬆️ → Add to Home Screen).'
              : !pushSupported()
                ? "This browser can't receive them. Try Chrome or the installed app."
                : 'Turn on to get reminders even when the app is closed.'}
        </span>
        {(enabled || (!needsInstall && pushSupported())) && (
          <Toggle
            checked={enabled}
            label="Reminders when DayNest is closed"
            onChange={async (v) => {
              if (busy) return
              setBusy(true)
              try {
                if (!v) {
                  await disablePush()
                  toast('Closed-app reminders off')
                  return
                }
                const r = await enablePush()
                if (r === 'on')
                  toast('Reminders will reach you even when DayNest is closed', { emoji: '🔔' })
                else if (r === 'denied')
                  toast('Notifications are blocked. Allow them in your browser settings.')
                else
                  toast("Couldn't turn on. Check your connection and try again.", { emoji: '⚠️' })
              } finally {
                setBusy(false)
              }
            }}
          />
        )}
      </div>
      {enabled && <TestAndHelp />}
    </div>
  )
}

/** Check sound, vibration and pop-up with a real push, and the Android settings that control them. */
function TestAndHelp() {
  const [busy, setBusy] = useState(false)
  return (
    <div className="mt-2.5 border-t border-sage-line pt-2.5">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const s = await sendTestPush()
            toast(`Test coming in ${s} seconds. Lock your phone or switch apps now.`, {
              emoji: '🔔',
            })
          } catch {
            toast("Couldn't send a test. Check your connection.", { emoji: '⚠️' })
          } finally {
            setTimeout(() => setBusy(false), 10_000)
          }
        }}
      >
        🔔 Send a test notification
      </Button>
      <details className="mt-2">
        <summary className="cursor-pointer font-semibold">No sound, vibration or pop-up?</summary>
        <div className="mt-1.5 grid gap-1.5 text-muted">
          <p>Android decides how notifications appear, so they're set per app on your phone:</p>
          <ol className="grid list-decimal gap-1 pl-4">
            <li>
              Long-press the <b>DayNest</b> icon → <b>App info</b> (ⓘ) → <b>Notifications</b>. Make
              sure they're allowed.
            </li>
            <li>
              Tap the notification category (e.g. <b>General</b> or <b>daynestapp.vercel.app</b>) →
              choose <b>Alert / Default</b>, not Silent → turn on <b>Pop on screen</b> (Samsung:{' '}
              <b>Pop-up</b>; Xiaomi: <b>Floating notifications</b>), <b>Sound</b> and{' '}
              <b>Vibration</b>.
            </li>
            <li>
              App info → <b>Battery</b> → <b>Unrestricted</b>, so reminders aren't held back.
            </li>
            <li>Check Do Not Disturb isn't on, then send another test.</li>
          </ol>
          <p>
            If DayNest isn't listed as its own app, it was added as a shortcut. Then the same
            settings are under <b>Chrome</b> → App info → Notifications → <b>Sites</b> →
            daynestapp.vercel.app.
          </p>
          <p>
            Full-screen alerts (like an alarm clock) aren't possible for web apps. For must-not-miss
            moments, also set a phone alarm.
          </p>
        </div>
      </details>
    </div>
  )
}
