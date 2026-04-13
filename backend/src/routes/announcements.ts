import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import multer from 'multer';
import { uploadFile } from '../services/storage.js';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

const announcementSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  visibleFrom: z.string().optional(),
  visibleUntil: z.string().optional().nullable(),
  displayOrder: z.number().int().optional(),
  visible: z.boolean().optional(),
});

// GET /api/announcements — public, filtered to visible + within date range
router.get('/', async (_req: Request, res: Response) => {
  const now = new Date();

  const announcements = await prisma.announcement.findMany({
    where: {
      visible: true,
      isArchived: false,
      visibleFrom: { lte: now },
      OR: [
        { visibleUntil: null },
        { visibleUntil: { gte: now } },
      ],
    },
    include: { files: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
  });

  res.json({ data: announcements, total: announcements.length });
});

// GET /api/announcements/all — admin only
router.get('/all', authenticate, requireRole('admin', 'super_admin'), async (_req: Request, res: Response) => {
  const announcements = await prisma.announcement.findMany({
    include: {
      files: true,
      creator: { select: { id: true, fullName: true } },
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
  });

  res.json({ data: announcements, total: announcements.length });
});

// POST /api/announcements — admin only
router.post('/', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = announcementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const announcement = await prisma.announcement.create({
    data: {
      ...parsed.data,
      visibleFrom: parsed.data.visibleFrom ? new Date(parsed.data.visibleFrom) : new Date(),
      visibleUntil: parsed.data.visibleUntil ? new Date(parsed.data.visibleUntil) : null,
      createdBy: req.user!.userId,
    },
    include: { files: true },
  });

  res.status(201).json(announcement);
});

// PUT /api/announcements/:id — admin only
router.put('/:id', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = announcementSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const announcement = await prisma.announcement.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      visibleFrom: parsed.data.visibleFrom ? new Date(parsed.data.visibleFrom) : undefined,
      visibleUntil: parsed.data.visibleUntil ? new Date(parsed.data.visibleUntil) : undefined,
    },
    include: { files: true },
  });

  res.json(announcement);
});

// POST /api/announcements/:id/archive — admin only
router.post('/:id/archive', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const announcement = await prisma.announcement.update({
    where: { id: req.params.id },
    data: { isArchived: !req.body.unarchive },
    include: { files: true },
  });
  res.json(announcement);
});

// DELETE /api/announcements/:id — admin only
router.delete('/:id', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  await prisma.announcement.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

// POST /api/announcements/:id/files — admin, multipart
router.post('/:id/files', authenticate, requireRole('admin', 'super_admin'), upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const { url, key } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

  const file = await prisma.announcementFile.create({
    data: {
      announcementId: req.params.id,
      filename: req.file.originalname,
      fileUrl: url,
      fileSize: req.file.size,
    },
  });

  res.status(201).json({ ...file, key });
});

// DELETE /api/announcements/:id/files/:fid — admin only
router.delete('/:id/files/:fid', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  await prisma.announcementFile.delete({ where: { id: req.params.fid } });
  res.json({ message: 'File deleted' });
});

export default router;
