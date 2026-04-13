import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/notifications/subscribe
 * Store a Web Push subscription for the authenticated user.
 * Body: { endpoint, keys: { p256dh, auth } }
 */
router.post('/subscribe', async (req: Request, res: Response): Promise<void> => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: 'Invalid subscription object' });
    return;
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: req.user!.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: req.user!.userId, p256dh: keys.p256dh, auth: keys.auth },
  });

  res.status(201).json({ ok: true });
});

/**
 * DELETE /api/notifications/subscribe
 * Remove the subscription (user unsubscribes / logs out from this device).
 */
router.delete('/subscribe', async (req: Request, res: Response): Promise<void> => {
  const { endpoint } = req.body;
  if (!endpoint) { res.status(400).json({ error: 'endpoint required' }); return; }
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user!.userId } });
  res.json({ ok: true });
});

/**
 * GET /api/notifications/unread-count
 * Returns a simple unread count so the frontend can update the app badge.
 */
router.get('/unread-count', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const role = req.user!.role;

  let count = 0;

  if (role === 'member') {
    // Unread prof messages on own requests
    const reqs = await prisma.procurementRequest.count({
      where: { requesterId: userId, hasUnreadProfMessage: true },
    });
    count = reqs;
  } else if (role === 'professor') {
    // Unread member replies + pending requests
    const [replies, pending] = await Promise.all([
      prisma.procurementRequest.count({ where: { hasUnreadMemberReply: true } }),
      prisma.procurementRequest.count({ where: { status: 'pending' } }),
    ]);
    count = replies + pending;
  } else if (role === 'admin' || role === 'super_admin') {
    const [pending, faults, bookings, memberReplies] = await Promise.all([
      prisma.procurementRequest.count({ where: { status: 'pending', isArchived: false } }),
      prisma.faultReport.count({ where: { status: 'pending', isArchived: false } }),
      prisma.booking.count({ where: { status: 'pending' } }),
      prisma.procurementRequest.count({ where: { hasUnreadMemberReply: true } }),
    ]);
    count = pending + faults + bookings + memberReplies;
  }

  res.json({ count });
});

export default router;
