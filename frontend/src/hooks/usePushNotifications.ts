import { useEffect, useCallback, useRef } from 'react';
import api from './useApi';
import { useAuth } from './useAuth';

// Convert base64url VAPID public key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) return null;

  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;

    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  } catch {
    return null;
  }
}

/**
 * Call this once on login/app load to:
 * 1. Request notification permission
 * 2. Subscribe to Web Push
 * 3. Send subscription to backend
 * 4. Poll unread count and update the app badge
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateBadge = useCallback(async () => {
    if (!user) return;
    try {
      const r = await api.get('/api/notifications/unread-count');
      const count: number = r.data.count ?? 0;

      // App badge API (Chrome on Android/desktop, iOS 16.4+)
      if ('setAppBadge' in navigator) {
        if (count > 0) {
          await (navigator as Navigator & { setAppBadge: (n?: number) => Promise<void> }).setAppBadge(count);
        } else {
          await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
        }
      }
    } catch { /* non-critical */ }
  }, [user]);

  const setup = useCallback(async () => {
    if (!user) return;

    // Check/request permission
    if (!('Notification' in window)) return;
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return;

    // Subscribe and register with backend
    const reg = await getRegistration();
    if (!reg) return;

    const sub = await subscribeToPush(reg);
    if (!sub) return;

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    try {
      await api.post('/api/notifications/subscribe', {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
    } catch { /* already registered or server error — not critical */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    setup();
    updateBadge();

    // Poll unread count every 60 seconds to keep badge fresh
    pollingRef.current = setInterval(updateBadge, 60_000);

    // Clear badge when window gains focus (user is actively using the app)
    const onFocus = () => {
      if ('clearAppBadge' in navigator) {
        (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
      }
    };
    window.addEventListener('focus', onFocus);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, setup, updateBadge]);
}
