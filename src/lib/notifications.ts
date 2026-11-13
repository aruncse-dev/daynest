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
  /** keep on screen until the user acts (supported on Chromium desktop/Android) */
  requireInteraction?: boolean
  /** big picture (data: URL drawn on the device) */
  image?: string
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
    ...(opts.image ? { image: opts.image } : {}),
    ...alertOptions(!!opts.requireInteraction, !!opts.tag),
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

/**
 * Make every reminder actually alert. Without `renotify`, a notification that reuses a tag
 * (the same reminder firing again while the last one is still in the tray) replaces it silently.
 * Android's own per-app notification settings still decide sound and pop-up banners.
 */
export function alertOptions(important: boolean, hasTag: boolean): NotificationOptions {
  return {
    requireInteraction: important,
    silent: false,
    // `renotify` is only valid together with a tag
    ...(hasTag ? { renotify: true } : {}),
    vibrate: important ? [300, 120, 300, 120, 500] : [200, 100, 200],
    timestamp: Date.now(),
  } as NotificationOptions
}
