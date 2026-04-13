import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireRole } from '../middleware/requireRole.js';
import { sendPushToUser, sendPushToRole } from '../services/push.js';

const router = Router();
const prisma = new PrismaClient();

const itemSchema = z.object({
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().int().nonnegative(),
  specifications: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
});

const createRequestSchema = z.object({
  title: z.string().min(1).max(255),
  assistantName: z.string().optional().nullable(),
  justification: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  requiredByDate: z.string().optional().nullable(),
  deliveryLocation: z.string().optional().nullable(),
  professorApproval: z.boolean().optional(),
  items: z.array(itemSchema).min(1),
});

function calcTotal(items: { quantity: number; unitCost: number }[]) {
  return items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
}

const procurementSelect = {
  id: true, title: true, status: true, priority: true,
  justification: true, assistantName: true, deliveryLocation: true,
  requiredByDate: true, professorApproval: true, totalAmount: true,
  professorNotes: true, adminNotes: true, isArchived: true,
  hasUnreadMemberReply: true, hasUnreadProfMessage: true,
  createdAt: true, updatedAt: true, reviewedAt: true,
  requester: { select: { id: true, fullName: true, username: true, department: true } },
  reviewer: { select: { id: true, fullName: true } },
  items: true,
};

// GET /api/procurement
router.get('/', async (req: Request, res: Response) => {
  const role = req.user!.role;
  const showArchived = req.query.archived === 'true';
  const statusFilter = req.query.status as string | undefined;

  const where: Record<string, unknown> = { isArchived: showArchived };

  if (role === 'member') {
    where.requesterId = req.user!.userId;
  }

  if (statusFilter && statusFilter !== 'all') {
    where.status = statusFilter;
  }

  const requests = await prisma.procurementRequest.findMany({
    where,
    select: procurementSelect,
    orderBy: { createdAt: 'desc' },
  });

  res.json({ data: requests, total: requests.length });
});

// POST /api/procurement — member, admin, super_admin
router.post('/', requireRole('member', 'admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { items, requiredByDate, ...rest } = parsed.data;
  const totalAmount = calcTotal(items);

  const request = await prisma.procurementRequest.create({
    data: {
      ...rest,
      requesterId: req.user!.userId,
      totalAmount,
      requiredByDate: requiredByDate ? new Date(requiredByDate) : null,
      items: { create: items },
    },
    select: procurementSelect,
  });

  // Notify professor + admin of new request
  sendPushToRole('professor', {
    title: 'New Procurement Request',
    body: `"${request.title}" submitted by ${request.requester.fullName}`,
    url: '/professor/requests',
  });
  sendPushToRole('admin', {
    title: 'New Procurement Request',
    body: `"${request.title}" submitted by ${request.requester.fullName}`,
    url: '/admin/procurement',
  });

  res.status(201).json(request);
});

// GET /api/procurement/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const request = await prisma.procurementRequest.findUnique({
    where: { id: req.params.id },
    select: procurementSelect,
  });

  if (!request) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const role = req.user!.role;
  const isOwner = request.requester.id === req.user!.userId;
  const isAdminOrProf = ['admin', 'super_admin', 'professor'].includes(role);

  if (!isOwner && !isAdminOrProf) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // Mark prof message as read if member is viewing
  if (role === 'member' && request.hasUnreadProfMessage) {
    await prisma.procurementRequest.update({
      where: { id: req.params.id },
      data: { hasUnreadProfMessage: false },
    });
  }

  res.json(request);
});

// PUT /api/procurement/:id — owner if pending, or admin
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.procurementRequest.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });

  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const isOwner = existing.requesterId === req.user!.userId;
  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);

  if (!isAdmin && !(isOwner && existing.status === 'pending')) {
    res.status(403).json({ error: 'Cannot edit this request' });
    return;
  }

  const parsed = createRequestSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { items, requiredByDate, ...rest } = parsed.data;
  let updateData: Record<string, unknown> = {
    ...rest,
    requiredByDate: requiredByDate ? new Date(requiredByDate) : undefined,
  };

  if (items) {
    await prisma.procurementItem.deleteMany({ where: { requestId: req.params.id } });
    await prisma.procurementItem.createMany({
      data: items.map((i) => ({ ...i, requestId: req.params.id })),
    });
    updateData.totalAmount = calcTotal(items);
  }

  const updated = await prisma.procurementRequest.update({
    where: { id: req.params.id },
    data: updateData,
    select: procurementSelect,
  });

  res.json(updated);
});

// POST /api/procurement/:id/approve
router.post('/:id/approve', requireRole('professor', 'admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const updated = await prisma.procurementRequest.update({
    where: { id: req.params.id },
    data: {
      status: 'approved',
      professorNotes: req.body.notes ?? null,
      reviewedBy: req.user!.userId,
      reviewedAt: new Date(),
    },
    select: procurementSelect,
  });
  sendPushToUser(updated.requester.id, {
    title: 'Request Approved ✓',
    body: `Your request "${updated.title}" has been approved.`,
    url: '/member/requests',
  });
  res.json(updated);
});

// POST /api/procurement/:id/decline
router.post('/:id/decline', requireRole('professor', 'admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const updated = await prisma.procurementRequest.update({
    where: { id: req.params.id },
    data: {
      status: 'declined',
      professorNotes: req.body.notes ?? null,
      reviewedBy: req.user!.userId,
      reviewedAt: new Date(),
    },
    select: procurementSelect,
  });
  sendPushToUser(updated.requester.id, {
    title: 'Request Declined',
    body: `Your request "${updated.title}" was declined.`,
    url: '/member/requests',
  });
  res.json(updated);
});

// POST /api/procurement/:id/query — professor or admin
router.post('/:id/query', requireRole('professor', 'admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const { message, queryTarget } = req.body;
  if (!message) {
    res.status(400).json({ error: 'Message required' });
    return;
  }

  const target: string = ['member', 'admin', 'both'].includes(queryTarget) ? queryTarget : 'member';

  // Only set hasUnreadProfMessage if member can see it
  const notifyMember = target === 'member' || target === 'both';

  // Only flip status to 'queried' if the request is currently pending (not already approved/delivered/etc.)
  const existingRequest = await prisma.procurementRequest.findUnique({ where: { id: req.params.id } });
  const shouldSetQueried = existingRequest?.status === 'pending';

  await prisma.procurementRequest.update({
    where: { id: req.params.id },
    data: {
      ...(shouldSetQueried ? { status: 'queried' } : {}),
      hasUnreadProfMessage: notifyMember ? true : undefined,
    },
  });

  const query = await prisma.professorQuery.create({
    data: {
      requestId: req.params.id,
      professorId: req.user!.userId,
      message,
      queryTarget: target,
      messages: {
        create: {
          senderId: req.user!.userId,
          body: message,
        },
      },
    },
    include: {
      professor: { select: { id: true, fullName: true } },
      messages: { include: { sender: { select: { id: true, fullName: true, role: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });

  // Push to relevant parties
  const reqRecord = await prisma.procurementRequest.findUnique({ where: { id: req.params.id }, select: { requesterId: true, title: true } });
  if (reqRecord) {
    if (notifyMember) {
      sendPushToUser(reqRecord.requesterId, {
        title: 'You have a query on your request',
        body: `"${reqRecord.title}" — reply to continue.`,
        url: '/member/requests',
      });
    }
    if (target === 'admin' || target === 'both') {
      sendPushToRole('admin', {
        title: 'New professor query',
        body: `Query on "${reqRecord.title}"`,
        url: '/admin/queries',
      });
    }
  }

  res.status(201).json(query);
});

// POST /api/procurement/:id/status — admin only
router.post('/:id/status', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!['ordered', 'delivered'].includes(status)) {
    res.status(400).json({ error: 'Status must be ordered or delivered' });
    return;
  }

  const updated = await prisma.procurementRequest.update({
    where: { id: req.params.id },
    data: { status },
    select: procurementSelect,
  });

  res.json(updated);
});

// POST /api/procurement/:id/archive — admin
router.post('/:id/archive', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const updated = await prisma.procurementRequest.update({
    where: { id: req.params.id },
    data: { isArchived: !req.body.unarchive },
    select: procurementSelect,
  });
  res.json(updated);
});

// DELETE /api/procurement/:id — admin with confirmation
router.delete('/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  if (!req.body.confirm) {
    res.status(400).json({ error: 'Confirmation required' });
    return;
  }
  await prisma.procurementRequest.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

// GET /api/procurement/:id/queries
router.get('/:id/queries', async (req: Request, res: Response): Promise<void> => {
  const request = await prisma.procurementRequest.findUnique({ where: { id: req.params.id } });
  if (!request) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const role = req.user!.role;
  const userId = req.user!.userId;
  const isOwner = request.requesterId === userId;
  const isAdmin = ['admin', 'super_admin'].includes(role);
  const isProfessor = role === 'professor';

  if (!isOwner && !isAdmin && !isProfessor) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // Members only see queries targeted to them
  // Admins and professors see everything (all targets, all senders)
  const targetFilter: string[] = [];
  if (isOwner && !isAdmin && !isProfessor) {
    targetFilter.push('member', 'both');
  }
  // admins and professors see all queries with no filter

  const queries = await prisma.professorQuery.findMany({
    where: {
      requestId: req.params.id,
      ...(targetFilter.length > 0 ? { queryTarget: { in: targetFilter } } : {}),
    },
    include: {
      professor: { select: { id: true, fullName: true } },
      messages: {
        include: { sender: { select: { id: true, fullName: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ data: queries, total: queries.length });
});

// POST /api/procurement/:id/queries/:qid/messages — post a message in a thread
router.post('/:id/queries/:qid/messages', async (req: Request, res: Response): Promise<void> => {
  const { body } = req.body;
  if (!body?.trim()) {
    res.status(400).json({ error: 'Message body required' });
    return;
  }

  const query = await prisma.professorQuery.findUnique({ where: { id: req.params.qid } });
  if (!query) {
    res.status(404).json({ error: 'Query not found' });
    return;
  }

  const role = req.user!.role;
  const userId = req.user!.userId;

  // Check access: professor (owner), member (if queryTarget includes member), admin (if target includes admin)
  const request = await prisma.procurementRequest.findUnique({ where: { id: req.params.id } });
  if (!request) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = request.requesterId === userId;
  const isAdmin = ['admin', 'super_admin'].includes(role);
  const isProfessor = role === 'professor' && query.professorId === userId;

  const canReply =
    isProfessor ||
    (isOwner && (query.queryTarget === 'member' || query.queryTarget === 'both')) ||
    (isAdmin && (query.queryTarget === 'admin' || query.queryTarget === 'both'));

  if (!canReply) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const message = await prisma.queryMessage.create({
    data: { queryId: req.params.qid, senderId: userId, body },
    include: { sender: { select: { id: true, fullName: true, role: true } } },
  });

  // Update query status and unread flags
  await prisma.professorQuery.update({
    where: { id: req.params.qid },
    data: { status: 'responded', respondedAt: new Date() },
  });

  // Set unread flags + push based on who sent the message
  if (role === 'member') {
    await prisma.procurementRequest.update({
      where: { id: req.params.id },
      data: { hasUnreadMemberReply: true },
    });
    // Notify professor who owns this query
    sendPushToUser(query.professorId, {
      title: 'New reply on your query',
      body: `A member replied to your query on request.`,
      url: '/professor/requests',
    });
    sendPushToRole('admin', {
      title: 'New reply on query',
      body: 'A member replied to a query thread.',
      url: '/admin/queries',
    });
  } else if (isProfessor || isAdmin) {
    await prisma.procurementRequest.update({
      where: { id: req.params.id },
      data: { hasUnreadProfMessage: true },
    });
    // Notify the request owner (member)
    sendPushToUser(request.requesterId, {
      title: 'New message on your request',
      body: 'A reply has been posted on one of your request threads.',
      url: '/member/requests',
    });
  }

  res.status(201).json(message);
});

// Legacy reply endpoint (keep for backward compat)
router.post('/:id/queries/:qid/reply', async (req: Request, res: Response): Promise<void> => {
  const body = req.body.response || req.body.body;
  if (!body?.trim()) { res.status(400).json({ error: 'Response required' }); return; }
  req.body.body = body;
  // Delegate to the messages endpoint logic inline
  const query = await prisma.professorQuery.findUnique({ where: { id: req.params.qid } });
  if (!query) { res.status(404).json({ error: 'Query not found' }); return; }

  const message = await prisma.queryMessage.create({
    data: { queryId: req.params.qid, senderId: req.user!.userId, body },
    include: { sender: { select: { id: true, fullName: true, role: true } } },
  });
  await prisma.professorQuery.update({
    where: { id: req.params.qid },
    data: { status: 'responded', response: body, respondedAt: new Date() },
  });
  await prisma.procurementRequest.update({
    where: { id: req.params.id },
    data: { hasUnreadMemberReply: true },
  });
  res.status(201).json(message);
});

export default router;
