import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configure VAPID — called once at startup
export function initPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? 'mailto:admin@nbsl.lab';
  if (!publicKey || !privateKey) {
    console.warn('[push] VAPID keys not set — push notifications disabled');
    return;
  }
  webpush.setVapidDetails(email, publicKey, privateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;         // deep-link URL to open on click
  icon?: string;
}

/**
 * Send a push notification to a specific user (all their subscribed devices).
 * Silently removes expired/invalid subscriptions.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    icon: payload.icon ?? '/icon-192.png',
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data,
        );
      } catch (err: unknown) {
        // 410 Gone or 404 = subscription expired → delete it
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        }
      }
    }),
  );
}

/**
 * Send push to all users with a given role.
 */
export async function sendPushToRole(role: string, payload: PushPayload) {
  const users = await prisma.appUser.findMany({ where: { role, active: true }, select: { id: true } });
  await Promise.allSettled(users.map((u) => sendPushToUser(u.id, payload)));
}

/**
 * Send push to multiple specific user IDs.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, payload)));
}
