export type NotifySupport = 'granted' | 'denied' | 'default' | 'unsupported'

export function notificationSupport(): NotifySupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotifySupport> {
  if (notificationSupport() === 'unsupported') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return notificationSupport()
  }
}

export interface NotifyOptions {
  title: string
  body: string
  tag?: string
  url?: string
}

/**
 * Show a system notification. Prefers the service worker (required on Android
 * and for installed PWAs); falls back to the page Notification constructor.
 * Nothing leaves the device — this is a local notification, not web push.
 */
export async function showSystemNotification(opts: NotifyOptions): Promise<boolean> {
  if (notificationSupport() !== 'granted') return false
  const options: NotificationOptions = {
    body: opts.body,
    tag: opts.tag,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data: { url: opts.url ?? '/' },
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(opts.title, options)
      return true
    }
    new Notification(opts.title, options)
    return true
  } catch {
    return false
  }
}
