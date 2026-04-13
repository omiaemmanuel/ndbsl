import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const prisma = new PrismaClient();

const createUserSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(6),
  fullName: z.string().min(1).max(255),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  role: z.enum(['super_admin', 'admin', 'professor', 'member']),
  active: z.boolean().optional(),
});

const updateUserSchema = createUserSchema.partial().omit({ password: true });

// GET /api/users — admin only
router.get('/', requireRole('admin', 'super_admin'), async (_req: Request, res: Response) => {
  const users = await prisma.appUser.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      phone: true,
      employeeId: true,
      department: true,
      role: true,
      active: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: users, total: users.length });
});

// POST /api/users — admin only
router.post('/', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { password, ...rest } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.appUser.create({
    data: { ...rest, passwordHash },
    select: {
      id: true, username: true, fullName: true, email: true,
      phone: true, employeeId: true, department: true, role: true,
      active: true, createdAt: true,
    },
  });

  res.status(201).json(user);
});

// GET /api/users/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const isSelf = req.user!.userId === req.params.id;
  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);

  if (!isSelf && !isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const user = await prisma.appUser.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, username: true, fullName: true, email: true,
      phone: true, employeeId: true, department: true, role: true,
      active: true, createdAt: true, lastLoginAt: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

// PUT /api/users/:id — admin only
router.put('/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const user = await prisma.appUser.update({
    where: { id: req.params.id },
    data: parsed.data,
    select: {
      id: true, username: true, fullName: true, email: true,
      phone: true, employeeId: true, department: true, role: true,
      active: true, createdAt: true,
    },
  });

  res.json(user);
});

// PUT /api/users/:id/password — admin or self
router.put('/:id/password', async (req: Request, res: Response): Promise<void> => {
  const isSelf = req.user!.userId === req.params.id;
  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);

  if (!isSelf && !isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { password } = req.body;
  if (!password || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.appUser.update({
    where: { id: req.params.id },
    data: { passwordHash },
  });

  res.json({ message: 'Password updated' });
});

// DELETE /api/users/:id — admin only
router.delete('/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const { confirm } = req.body;
  if (!confirm) {
    res.status(400).json({ error: 'Confirmation required' });
    return;
  }

  await prisma.appUser.delete({ where: { id: req.params.id } });
  res.json({ message: 'User deleted' });
});

export default router;
