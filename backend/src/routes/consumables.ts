import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const prisma = new PrismaClient();

const consumableSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().optional().nullable(),
  currentStock: z.number().int().nonnegative().optional(),
  unit: z.string().optional().nullable(),
  reorderThreshold: z.number().int().nonnegative().optional(),
  location: z.string().optional().nullable(),
  costPerUnit: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

const consumableRequestSchema = z.object({
  requestType: z.enum(['restock', 'new_item']),
  consumableId: z.string().min(1).optional().nullable(),
  itemName: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  quantity: z.number().int().positive(),
  purpose: z.string().optional().nullable(),
});

// GET /api/consumables
router.get('/', async (_req: Request, res: Response) => {
  const consumables = await prisma.consumable.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const withStatus = consumables.map((c) => ({
    ...c,
    stockStatus: c.currentStock === 0 ? 'out_of_stock'
      : c.currentStock <= c.reorderThreshold ? 'low_stock'
      : 'in_stock',
  }));

  res.json({ data: withStatus, total: withStatus.length });
});

// POST /api/consumables — admin only
router.post('/', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = consumableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const item = await prisma.consumable.create({ data: parsed.data });
  res.status(201).json(item);
});

// PUT /api/consumables/:id — admin only
router.put('/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = consumableSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const item = await prisma.consumable.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  res.json(item);
});

// POST /api/consumables/requests — member
router.post('/requests', async (req: Request, res: Response): Promise<void> => {
  const parsed = consumableRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const request = await prisma.consumableRequest.create({
    data: { ...parsed.data, requesterId: req.user!.userId },
    include: {
      requester: { select: { id: true, fullName: true } },
      consumable: true,
    },
  });

  res.status(201).json(request);
});

// GET /api/consumables/requests
router.get('/requests', async (req: Request, res: Response) => {
  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);

  const requests = await prisma.consumableRequest.findMany({
    where: isAdmin ? { isArchived: false } : {
      requesterId: req.user!.userId,
      isArchived: false,
    },
    include: {
      requester: { select: { id: true, fullName: true } },
      consumable: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ data: requests, total: requests.length });
});

// PUT /api/consumables/requests/:id/approve — admin only
router.put('/requests/:id/approve', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const request = await prisma.consumableRequest.findUnique({ where: { id: req.params.id } });
  if (!request) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const updated = await prisma.consumableRequest.update({
    where: { id: req.params.id },
    data: { status: 'approved' },
    include: { requester: { select: { id: true, fullName: true } }, consumable: true },
  });

  // For restock requests, increment stock immediately on approve
  if (request.requestType === 'restock' && request.consumableId) {
    await prisma.consumable.update({
      where: { id: request.consumableId },
      data: { currentStock: { increment: request.quantity } },
    });
  }

  res.json(updated);
});

// PUT /api/consumables/requests/:id/reject — admin only
router.put('/requests/:id/reject', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const updated = await prisma.consumableRequest.update({
    where: { id: req.params.id },
    data: { status: 'rejected', adminNotes: req.body.adminNotes ?? null },
    include: { requester: { select: { id: true, fullName: true } }, consumable: true },
  });
  res.json(updated);
});

// PUT /api/consumables/requests/:id/issue — admin only
router.put('/requests/:id/issue', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const request = await prisma.consumableRequest.findUnique({ where: { id: req.params.id } });
  if (!request) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const updated = await prisma.consumableRequest.update({
    where: { id: req.params.id },
    data: { status: 'issued' },
    include: { requester: { select: { id: true, fullName: true } }, consumable: true },
  });

  // Decrement stock on issue
  if (request.consumableId) {
    await prisma.consumable.update({
      where: { id: request.consumableId },
      data: { currentStock: { decrement: request.quantity } },
    });
  }

  res.json(updated);
});

export default router;
