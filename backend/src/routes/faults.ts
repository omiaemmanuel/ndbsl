import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { sendPushToUser, sendPushToRole } from '../services/push.js';

const router = Router();
const prisma = new PrismaClient();

const createFaultSchema = z.object({
  equipmentId: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1),
  reporterUsable: z.boolean().optional().default(true),
});

const faultInclude = {
  equipment: { select: { id: true, name: true, bookingDisabled: true } },
  reporter: { select: { id: true, fullName: true, username: true, department: true } },
  messages: {
    include: { sender: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

// POST /api/faults
router.post('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = createFaultSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { reporterUsable, ...rest } = parsed.data;

  const fault = await prisma.faultReport.create({
    data: { ...rest, reporterUsable, reporterId: req.user!.userId },
    include: faultInclude,
  });

  // Auto-set equipment status and booking disabled based on severity + reporter assessment
  const isHighSeverity = ['high', 'critical'].includes(parsed.data.severity);
  const reporterSaysUnusable = !reporterUsable;

  if (isHighSeverity || reporterSaysUnusable) {
    await prisma.equipment.update({
      where: { id: parsed.data.equipmentId },
      data: {
        status: 'under_maintenance',
        // Only auto-disable booking for critical severity; admin decides for others
        ...(parsed.data.severity === 'critical' ? { bookingDisabled: true } : {}),
      },
    });
  }

  // Notify admins
  await sendPushToRole('admin', {
    title: `Fault Reported — ${fault.equipment.name}`,
    body: `${fault.reporter.fullName} reported a ${parsed.data.severity} fault. ${reporterSaysUnusable ? '⚠ Reporter says equipment is NOT usable.' : ''}`,
    url: '/admin/faults',
  });

  res.status(201).json(fault);
});

// GET /api/faults
router.get('/', authenticate, async (req: Request, res: Response) => {
  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);
  const showArchived = req.query.archived === 'true';
  const statusFilter = req.query.status as string | undefined;

  const where: Record<string, unknown> = { isArchived: showArchived };
  if (!isAdmin) where.reporterId = req.user!.userId;
  if (statusFilter && statusFilter !== 'all') where.status = statusFilter;

  const faults = await prisma.faultReport.findMany({
    where,
    include: faultInclude,
    orderBy: { createdAt: 'desc' },
  });

  res.json({ data: faults, total: faults.length });
});

// GET /api/faults/:id — single fault
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  const fault = await prisma.faultReport.findUnique({
    where: { id: req.params.id },
    include: faultInclude,
  });
  if (!fault) { res.status(404).json({ error: 'Not found' }); return; }

  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);
  if (!isAdmin && fault.reporterId !== req.user!.userId) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  res.json(fault);
});

// POST /api/faults/:id/messages — send a message (admin or the reporter)
router.post('/:id/messages', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { body } = req.body;
  if (!body?.trim()) { res.status(400).json({ error: 'Message body required' }); return; }

  const fault = await prisma.faultReport.findUnique({ where: { id: req.params.id } });
  if (!fault) { res.status(404).json({ error: 'Not found' }); return; }

  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);
  if (!isAdmin && fault.reporterId !== req.user!.userId) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  const message = await prisma.faultMessage.create({
    data: { faultId: req.params.id, senderId: req.user!.userId, body: body.trim() },
    include: { sender: { select: { id: true, fullName: true, role: true } } },
  });

  // Push notifications: if admin sent → notify reporter; if reporter sent → notify admins
  const faultWithDetails = await prisma.faultReport.findUnique({
    where: { id: req.params.id },
    include: { equipment: { select: { name: true } }, reporter: { select: { id: true, fullName: true } } },
  });

  if (isAdmin) {
    await sendPushToUser(fault.reporterId, {
      title: `Follow-up on your fault report`,
      body: `Admin replied on: ${faultWithDetails?.equipment.name}`,
      url: '/member/faults',
    });
  } else {
    await sendPushToRole('admin', {
      title: `Fault reply from ${faultWithDetails?.reporter.fullName}`,
      body: `Re: ${faultWithDetails?.equipment.name} — ${body.trim().slice(0, 80)}`,
      url: '/admin/faults',
    });
  }

  res.status(201).json(message);
});

// PUT /api/faults/:id/status — admin only
router.put('/:id/status', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const { status, resolutionNotes } = req.body;

  if (!['pending', 'in_progress', 'resolved'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' }); return;
  }

  const fault = await prisma.faultReport.findUnique({
    where: { id: req.params.id },
    include: { equipment: true },
  });
  if (!fault) { res.status(404).json({ error: 'Not found' }); return; }

  const updated = await prisma.faultReport.update({
    where: { id: req.params.id },
    data: {
      status,
      resolutionNotes: resolutionNotes ?? fault.resolutionNotes,
      resolvedAt: status === 'resolved' ? new Date() : fault.resolvedAt,
    },
    include: faultInclude,
  });

  // Update equipment status based on fault resolution
  if (status === 'in_progress') {
    await prisma.equipment.update({
      where: { id: fault.equipmentId },
      data: { status: 'under_maintenance' },
    });
  } else if (status === 'resolved') {
    // On resolution: restore equipment to available and re-enable bookings
    await prisma.equipment.update({
      where: { id: fault.equipmentId },
      data: { status: 'available', bookingDisabled: false },
    });
    // Also clear adminUsable flag
    await prisma.faultReport.update({
      where: { id: req.params.id },
      data: { adminUsable: true },
    });
  }

  // Notify reporter
  await sendPushToUser(fault.reporterId, {
    title: `Fault report ${status === 'resolved' ? 'resolved ✓' : 'updated'}`,
    body: `Your report on ${fault.equipment.name} is now: ${status.replace('_', ' ')}`,
    url: '/member/faults',
  });

  res.json(updated);
});

// PUT /api/faults/:id/usable — admin sets whether equipment is usable (controls booking disable)
router.put('/:id/usable', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const { adminUsable } = req.body;
  if (typeof adminUsable !== 'boolean') {
    res.status(400).json({ error: 'adminUsable (boolean) required' }); return;
  }

  const fault = await prisma.faultReport.findUnique({
    where: { id: req.params.id },
    include: { equipment: true, reporter: { select: { id: true } } },
  });
  if (!fault) { res.status(404).json({ error: 'Not found' }); return; }

  // Update fault record
  const updated = await prisma.faultReport.update({
    where: { id: req.params.id },
    data: { adminUsable },
    include: faultInclude,
  });

  // Sync equipment booking disabled flag
  await prisma.equipment.update({
    where: { id: fault.equipmentId },
    data: {
      bookingDisabled: !adminUsable,
      status: !adminUsable ? 'under_maintenance' : fault.equipment.status,
    },
  });

  // Notify reporter of the decision
  await sendPushToUser(fault.reporter.id, {
    title: adminUsable ? `Equipment cleared for booking` : `Equipment booking disabled`,
    body: `${fault.equipment.name}: Admin has marked this equipment as ${adminUsable ? 'usable — bookings re-enabled' : 'NOT usable — bookings disabled'}`,
    url: '/member/faults',
  });

  res.json(updated);
});

// POST /api/faults/:id/archive — admin only
router.post('/:id/archive', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const updated = await prisma.faultReport.update({
    where: { id: req.params.id },
    data: { isArchived: !req.body.unarchive },
    include: faultInclude,
  });
  res.json(updated);
});

// DELETE /api/faults/:id — admin with confirmation
router.delete('/:id', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  if (!req.body.confirm) {
    res.status(400).json({ error: 'Confirmation required' }); return;
  }
  await prisma.faultReport.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

export default router;
