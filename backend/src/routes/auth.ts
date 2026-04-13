import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function signTokens(userId: string, role: string, fullName: string) {
  const payload = { userId, role, fullName };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = (jwt.sign as any)(payload, config.jwt.secret, { expiresIn: config.jwt.accessExpiresIn });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refreshToken = (jwt.sign as any)(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });
  return { token, refreshToken };
}

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const { username, password } = parsed.data;

  const user = await prisma.appUser.findUnique({ where: { username } });

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (!user.active) {
    res.status(403).json({ error: 'Account disabled' });
    return;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  await prisma.appUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const { token, refreshToken } = signTokens(user.id, user.role, user.fullName);

  res.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      email: user.email,
      phone: user.phone,
      department: user.department,
    },
  });
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as {
      userId: string;
      role: string;
      fullName: string;
    };

    const user = await prisma.appUser.findUnique({ where: { id: payload.userId } });
    if (!user || !user.active) {
      res.status(401).json({ error: 'User not found or disabled' });
      return;
    }

    const tokens = signTokens(user.id, user.role, user.fullName);
    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.appUser.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      phone: true,
      department: true,
      employeeId: true,
      role: true,
      active: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

export default router;
