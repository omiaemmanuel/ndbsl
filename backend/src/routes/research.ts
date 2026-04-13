import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const prisma = new PrismaClient();

const researchSchema = z.object({
  title: z.string().min(1).max(255),
  researchType: z.enum(['current', 'completed']),
  summary: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  leadResearcher: z.string().optional().nullable(),
  year: z.number().int().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  externalLink: z.string().optional().nullable(),
  displayOrder: z.number().int().optional(),
  status: z.enum(['active', 'archived']).optional(),
  // Array of user IDs to tag as project members
  memberIds: z.array(z.string()).optional(),
});

const projectSelect = {
  id: true, title: true, researchType: true, summary: true, description: true,
  leadResearcher: true, year: true, imageUrl: true, externalLink: true,
  displayOrder: true, status: true, createdAt: true,
  members: {
    select: {
      id: true,
      user: { select: { id: true, fullName: true, username: true, role: true } },
    },
  },
};

// GET /api/research — public
router.get('/', async (_req: Request, res: Response) => {
  const projects = await prisma.researchProject.findMany({
    where: { status: 'active' },
    select: projectSelect,
    orderBy: [{ researchType: 'asc' }, { displayOrder: 'asc' }, { year: 'desc' }],
  });
  res.json({ data: projects, total: projects.length });
});

// GET /api/research/members — returns list of users who can be tagged (members)
router.get('/members', authenticate, requireRole('admin', 'super_admin', 'professor'), async (_req: Request, res: Response) => {
  const users = await prisma.appUser.findMany({
    where: { role: 'member', active: true },
    select: { id: true, fullName: true, username: true, department: true },
    orderBy: { fullName: 'asc' },
  });
  res.json({ data: users });
});

// POST /api/research — admin or professor
router.post('/', authenticate, requireRole('admin', 'super_admin', 'professor'), async (req: Request, res: Response): Promise<void> => {
  const parsed = researchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { memberIds, ...data } = parsed.data;

  const project = await prisma.researchProject.create({
    data: {
      ...data,
      createdBy: req.user!.userId,
      members: memberIds?.length
        ? { create: memberIds.map((uid) => ({ userId: uid })) }
        : undefined,
    },
    select: projectSelect,
  });

  res.status(201).json(project);
});

// PUT /api/research/:id — admin, professor, OR tagged member
router.put('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const isAdminOrProf = ['admin', 'super_admin', 'professor'].includes(role);

  if (!isAdminOrProf) {
    // Check if tagged member
    const membership = await prisma.researchProjectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId } },
    });
    if (!membership) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  const parsed = researchSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { memberIds, ...data } = parsed.data;

  // If memberIds provided and user is admin/prof, update members
  if (memberIds !== undefined && isAdminOrProf) {
    await prisma.researchProjectMember.deleteMany({ where: { projectId: req.params.id } });
    if (memberIds.length > 0) {
      await prisma.researchProjectMember.createMany({
        data: memberIds.map((uid) => ({ projectId: req.params.id, userId: uid })),
        skipDuplicates: true,
      });
    }
  }

  const project = await prisma.researchProject.update({
    where: { id: req.params.id },
    data,
    select: projectSelect,
  });

  res.json(project);
});

// DELETE /api/research/:id — admin only
router.delete('/:id', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  await prisma.researchProject.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

export default router;
