import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/audit
router.get('/', requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
  const { resourceType, userId, from, to } = req.query;

  const where: Record<string, unknown> = {};

  if (resourceType) where.resourceType = resourceType;
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to ? { lte: new Date(to as string) } : {}),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  res.json({ data: logs, total: logs.length });
});

export default router;
