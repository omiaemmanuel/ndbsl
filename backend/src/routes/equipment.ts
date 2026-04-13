import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const prisma = new PrismaClient();

const equipmentSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  specs: z.record(z.unknown()).optional().nullable(),
  roomId: z.string().min(1).optional().nullable(),
  status: z.enum(['available', 'in_use', 'under_maintenance', 'decommissioned']).optional(),
  manualUrl: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  requiresApproval: z.boolean().optional(),
  maxDurationHours: z.number().int().optional(),
  advanceLimitDays: z.number().int().optional(),
  minNoticeHours: z.number().int().optional(),
});

// GET /api/equipment — all authenticated
router.get('/', async (_req: Request, res: Response) => {
  const equipment = await prisma.equipment.findMany({
    include: {
      room: true,
      faultReports: {
        where: { isArchived: false, status: { not: 'resolved' } },
        select: { id: true, severity: true, status: true, adminUsable: true, reporterUsable: true, description: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
    orderBy: { name: 'asc' },
  });
  res.json({ data: equipment, total: equipment.length });
});

// POST /api/equipment — admin only
router.post('/', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = equipmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { specs, ...rest } = parsed.data;
  const item = await prisma.equipment.create({
    data: {
      ...rest,
      specs: specs ? JSON.stringify(specs) : null,
      createdBy: req.user!.userId,
    },
    include: { room: true },
  });

  res.status(201).json(item);
});

// PUT /api/equipment/:id — admin only
router.put('/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = equipmentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { specs, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (specs !== undefined) updateData.specs = specs ? JSON.stringify(specs) : null;

  const item = await prisma.equipment.update({
    where: { id: req.params.id },
    data: updateData,
    include: { room: true },
  });

  res.json(item);
});

// DELETE /api/equipment/:id — admin only, blocked if active bookings
router.delete('/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const activeBookings = await prisma.booking.count({
    where: {
      equipmentId: req.params.id,
      status: 'confirmed',
      endDatetime: { gte: new Date() },
    },
  });

  if (activeBookings > 0) {
    res.status(409).json({ error: 'Cannot delete equipment with active future bookings' });
    return;
  }

  await prisma.equipment.delete({ where: { id: req.params.id } });
  res.json({ message: 'Equipment deleted' });
});

// GET /api/equipment/:id/bookings
router.get('/:id/bookings', async (req: Request, res: Response) => {
  const bookings = await prisma.booking.findMany({
    where: { equipmentId: req.params.id, isArchived: false },
    include: {
      user: { select: { id: true, fullName: true, username: true } },
    },
    orderBy: { startDatetime: 'asc' },
  });

  res.json({ data: bookings, total: bookings.length });
});

export default router;
