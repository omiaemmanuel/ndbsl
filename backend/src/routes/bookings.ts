import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireRole } from '../middleware/requireRole.js';
import { checkBookingConflict } from '../services/bookingConflict.js';

const router = Router();
const prisma = new PrismaClient();

const createBookingSchema = z.object({
  equipmentId: z.string().min(1),
  purpose: z.string().min(1),
  startDatetime: z.string().min(1),
  endDatetime: z.string().min(1),
});

// GET /api/bookings
router.get('/', async (req: Request, res: Response) => {
  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);
  const showArchived = req.query.archived === 'true';
  const statusFilter = req.query.status as string | undefined;

  const where: Record<string, unknown> = {
    isArchived: showArchived,
  };

  if (!isAdmin) {
    where.userId = req.user!.userId;
  }

  if (statusFilter && statusFilter !== 'all') {
    where.status = statusFilter;
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      equipment: { select: { id: true, name: true, category: true } },
      user: { select: { id: true, fullName: true, username: true } },
    },
    orderBy: { startDatetime: 'desc' },
  });

  res.json({ data: bookings, total: bookings.length });
});

// POST /api/bookings
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { equipmentId, purpose, startDatetime, endDatetime } = parsed.data;
  const start = new Date(startDatetime);
  const end = new Date(endDatetime);

  if (start >= end) {
    res.status(400).json({ error: 'Start time must be before end time' });
    return;
  }

  const conflict = await checkBookingConflict(equipmentId, start, end);
  if (conflict) {
    res.status(409).json({ error: 'Booking conflict: time slot is not available', nextAvailable: conflict });
    return;
  }

  // Check if equipment requires admin approval
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { requiresApproval: true, status: true, bookingDisabled: true, name: true },
  });

  if (!equipment) {
    res.status(404).json({ error: 'Equipment not found' });
    return;
  }

  if (equipment.bookingDisabled) {
    res.status(403).json({ error: `Bookings for "${equipment.name}" are currently disabled due to a reported fault. Please contact an admin.` });
    return;
  }

  if (equipment.status === 'under_maintenance' || equipment.status === 'decommissioned') {
    res.status(400).json({ error: 'Equipment is not available for booking' });
    return;
  }

  const bookingStatus = equipment.requiresApproval ? 'pending' : 'confirmed';

  const booking = await prisma.booking.create({
    data: {
      equipmentId,
      userId: req.user!.userId,
      purpose,
      startDatetime: start,
      endDatetime: end,
      status: bookingStatus,
    },
    include: {
      equipment: { select: { id: true, name: true } },
      user: { select: { id: true, fullName: true } },
    },
  });

  res.status(201).json({ ...booking, requiresApproval: equipment.requiresApproval });
});

// PUT /api/bookings/:id/cancel
router.put('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });

  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  const isOwner = booking.userId === req.user!.userId;
  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);

  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const updated = await prisma.booking.update({
    where: { id: req.params.id },
    data: {
      status: 'cancelled',
      adminNotes: req.body.adminNotes ?? booking.adminNotes,
    },
    include: {
      equipment: { select: { id: true, name: true } },
      user: { select: { id: true, fullName: true } },
    },
  });

  res.json(updated);
});

// PUT /api/bookings/:id/approve — admin only (for requiresApproval equipment)
router.put('/:id/approve', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }

  const updated = await prisma.booking.update({
    where: { id: req.params.id },
    data: { status: 'confirmed', adminNotes: req.body.adminNotes ?? booking.adminNotes },
    include: { equipment: { select: { id: true, name: true } }, user: { select: { id: true, fullName: true } } },
  });
  res.json(updated);
});

// PUT /api/bookings/:id/reject — admin only
router.put('/:id/reject', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }

  const updated = await prisma.booking.update({
    where: { id: req.params.id },
    data: { status: 'cancelled', adminNotes: req.body.adminNotes ?? booking.adminNotes },
    include: { equipment: { select: { id: true, name: true } }, user: { select: { id: true, fullName: true } } },
  });
  res.json(updated);
});

// POST /api/bookings/:id/archive — admin only
router.post('/:id/archive', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const booking = await prisma.booking.update({
    where: { id: req.params.id },
    data: { isArchived: !req.body.unarchive },
  });
  res.json(booking);
});

// GET /api/bookings/availability/:equipmentId
router.get('/availability/:equipmentId', async (req: Request, res: Response) => {
  const { start, end } = req.query;

  const bookings = await prisma.booking.findMany({
    where: {
      equipmentId: req.params.equipmentId,
      status: { in: ['confirmed', 'pending'] },
      isArchived: false,
      ...(start && end
        ? {
            NOT: {
              OR: [
                { endDatetime: { lte: new Date(start as string) } },
                { startDatetime: { gte: new Date(end as string) } },
              ],
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, fullName: true } },
    },
    orderBy: { startDatetime: 'asc' },
  });

  res.json({ data: bookings, total: bookings.length });
});

export default router;
