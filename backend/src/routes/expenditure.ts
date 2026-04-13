import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/expenditure?year=2025
router.get('/', requireRole('admin', 'super_admin', 'professor'), async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
  const endOfYear = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  // Only count each request once using its current (most advanced) status
  const requests = await prisma.procurementRequest.findMany({
    where: {
      status: { in: ['ordered', 'delivered'] },
      isArchived: false,
      updatedAt: { gte: startOfYear, lt: endOfYear },
    },
    include: {
      requester: { select: { id: true, fullName: true } },
      items: true,
    },
    orderBy: { updatedAt: 'asc' },
  });

  // Aggregate monthly totals
  const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 }));

  for (const req of requests) {
    const month = new Date(req.updatedAt).getMonth(); // 0-indexed
    monthlyTotals[month].total += req.totalAmount;
  }

  res.json({
    year,
    monthlyTotals,
    requests: requests.map((r) => ({
      id: r.id,
      title: r.title,
      requester: r.requester,
      totalAmount: r.totalAmount,
      status: r.status,
      date: r.updatedAt,
      items: r.items,
    })),
    grandTotal: requests.reduce((sum, r) => sum + r.totalAmount, 0),
  });
});

export default router;
