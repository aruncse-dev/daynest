/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { db } from './db/db'
import { completeLinked } from './db/links'
import { remindersDueAt } from './lib/pushSchedule'
import { syncPush } from './lib/push'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// App shell + versioned static assets only. User data lives in IndexedDB and
// backups/exports are never cached here.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

/* ---------- Always-on reminders ---------- */
// The push only says *when* ("at"); the reminder text comes from this phone's own data.

type ActionNotificationOptions = NotificationOptions & {
  actions?: { action: string; title: string }[]
  requireInteraction?: boolean
}

async function onPush(atMs: number) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  // DayNest is open on screen: its own reminder runner shows the animated card instead
  if (windows.some((w) => w.visibilityState === 'visible')) return
  const due = await remindersDueAt(atMs)
  if (!due.length) {
    // browsers require a visible notification for every push
    await self.registration.showNotification('DayNest', {
      body: 'Open DayNest to see your day.',
      tag: 'daynest',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: '/' },
    })
    return
  }
  for (const r of due.slice(0, 3)) {
    await db.reminders.update(r.id, {
      lastFiredSlot: new Date(atMs).toISOString(),
      snoozedUntil: null,
    })
    const canComplete = !!r.link && r.link.type !== 'event'
    const options: ActionNotificationOptions = {
      body: r.message,
      tag: `reminder-${r.id}`,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: '/', reminderId: r.id },
      requireInteraction: r.priority === 'high',
      actions: [
        ...(canComplete ? [{ action: 'done', title: 'Mark done ✓' }] : []),
        { action: 'snooze', title: 'Snooze 10 min' },
      ],
    }
    await self.registration.showNotification(`${r.emoji} ${r.title}`, options)
  }
}

self.addEventListener('push', (event) => {
  let at = Date.now()
  try {
    const data = event.data?.json() as { at?: number } | undefined
    if (typeof data?.at === 'number') at = data.at
  } catch {
    /* empty or non-JSON push: treat as "now" */
  }
  event.waitUntil(onPush(at))
})

// Tap a notification (or one of its buttons).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = (event.notification.data ?? {}) as { url?: string; reminderId?: string }
  const url = data.url ?? '/'
  event.waitUntil(
    (async () => {
      if (event.action === 'done' && data.reminderId) {
        const r = await db.reminders.get(data.reminderId)
        if (r) await completeLinked(r)
        await syncPush({ getReg: async () => self.registration }).catch(() => undefined)
        return
      }
      if (event.action === 'snooze' && data.reminderId) {
        await db.reminders.update(data.reminderId, {
          snoozedUntil: new Date(Date.now() + 10 * 60_000).toISOString(),
        })
        await syncPush({ getReg: async () => self.registration }).catch(() => undefined)
        return
      }
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client && url !== '/')
            await (client as WindowClient).navigate(url).catch(() => undefined)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
