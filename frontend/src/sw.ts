/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
// Inject the precache manifest (filled in by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST);

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: { title: string; body: string; url?: string; icon?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'NBSL', body: event.data.text() };
  }

  const { title, body, url = '/', icon = '/icon-192.png' } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icon-192.png',
      data: { url },
      vibrate: [150, 75, 150],
      requireInteraction: false,
      tag: url, // collapse duplicate notifications for same URL
    }),
  );
});

// ── Notification click → open / focus the app at the right URL ───────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string) ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // If app is already open, navigate it
        const existing = clients.find((c) => c.url.startsWith(self.registration.scope));
        if (existing) {
          return existing.focus().then((c) => c.navigate(targetUrl));
        }
        // Otherwise open a new window
        return self.clients.openWindow(targetUrl);
      }),
  );
});

// ── Background sync: clear badge when app is opened ──────────────────────────
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'CLEAR_BADGE') {
    // navigator.clearAppBadge is called from the client directly; this is a no-op hook
  }
});
