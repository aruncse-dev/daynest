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
    </div>
  )
}
