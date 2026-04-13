import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const prisma = new PrismaClient();

// Helper: get the Monday (00:00 UTC) of the week containing `date`
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Helper: is the current time past Friday 23:59 KST for the current week?
function isPastDeadline(weekStart: Date): boolean {
  // Deadline = weekStart + 4 days (Friday) + 23h 59m 59s in KST (= UTC+9)
  // Friday 23:59 KST = Friday 14:59 UTC
  const deadline = new Date(weekStart);
  deadline.setUTCDate(deadline.getUTCDate() + 4); // Friday
  deadline.setUTCHours(14, 59, 59, 999);           // 23:59 KST
  return new Date() > deadline;
}

const reportSchema = z.object({
  accomplishments: z.string().min(10, 'Please describe your accomplishments (min 10 chars)'),
  challenges: z.string().min(10, 'Please describe challenges (min 10 chars)'),
  nextSteps: z.string().min(10, 'Please describe next steps (min 10 chars)'),
  readingList: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  isPublic: z.boolean().optional().default(false),
  requestMeeting: z.boolean().optional().default(false),
});

const commentSchema = z.object({
  text: z.string().min(1),
  parentCommentId: z.string().optional().nullable(),
  selectionMetadata: z.object({
    quote: z.string(),
    field: z.string(),
  }).optional().nullable(),
});

const reportSelect = {
  id: true,
  weekStart: true,
  accomplishments: true,
  challenges: true,
  nextSteps: true,
  readingList: true,
  imageUrl: true,
  isPublic: true,
  requestMeeting: true,
  status: true,
  isLate: true,
  createdAt: true,
  updatedAt: true,
  student: { select: { id: true, fullName: true, username: true, department: true } },
  comments: {
    where: { parentCommentId: null },
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      text: true,
      selectionMetadata: true,
      createdAt: true,
      author: { select: { id: true, fullName: true, role: true } },
      replies: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          text: true,
          createdAt: true,
          author: { select: { id: true, fullName: true, role: true } },
        },
      },
    },
  },
  meetings: {
    select: { id: true, status: true, notes: true, createdAt: true },
  },
  images: {
    orderBy: { displayOrder: 'asc' as const },
    select: { id: true, url: true, caption: true, displayOrder: true },
  },
};

// ─── GET /api/weekly-reports ─────────────────────────────────────────────────
// member → own reports
// professor/admin → all reports (filterable by studentId, weekStart)
router.get('/', async (req: Request, res: Response) => {
  const { userId, role } = req.user!;
  const { studentId, week, status } = req.query as Record<string, string | undefined>;

  const where: Record<string, unknown> = {};

  if (role === 'member') {
    where.studentId = userId;
  } else if (studentId) {
    where.studentId = studentId;
  }

  if (week) {
    const d = new Date(week);
    if (!isNaN(d.getTime())) {
      where.weekStart = getWeekStart(d);
    }
  }

  if (status) {
    where.status = status;
  }

  const reports = await prisma.weeklyReport.findMany({
    where,
    select: reportSelect,
    orderBy: { weekStart: 'desc' },
  });

  res.json({ data: reports, total: reports.length });
});

// ─── GET /api/weekly-reports/feed ────────────────────────────────────────────
// Public lab feed: reports marked isPublic, ordered by weekStart desc
router.get('/feed', async (req: Request, res: Response) => {
  const { week } = req.query as Record<string, string | undefined>;

  const where: Record<string, unknown> = { isPublic: true };

  if (week) {
    const d = new Date(week);
    if (!isNaN(d.getTime())) {
      where.weekStart = getWeekStart(d);
    }
  }

  const reports = await prisma.weeklyReport.findMany({
    where,
    select: {
      id: true,
      weekStart: true,
      accomplishments: true,
      isLate: true,
      status: true,
      createdAt: true,
      student: { select: { id: true, fullName: true, department: true } },
    },
    orderBy: [{ weekStart: 'desc' }, { createdAt: 'asc' }],
  });

  res.json({ data: reports, total: reports.length });
});

// ─── GET /api/weekly-reports/submission-status ───────────────────────────────
// Professor/Admin: for the current week, who has and hasn't submitted?
router.get('/submission-status', requireRole('professor', 'admin', 'super_admin'), async (_req: Request, res: Response) => {
  const weekStart = getWeekStart();

  const members = await prisma.appUser.findMany({
    where: { role: 'member', active: true },
    select: { id: true, fullName: true, department: true },
    orderBy: { fullName: 'asc' },
  });

  const submitted = await prisma.weeklyReport.findMany({
    where: { weekStart },
    select: { studentId: true, status: true, isLate: true },
  });

  const submittedSet = new Set(submitted.map((r) => r.studentId));

  const result = members.map((m) => ({
    ...m,
    submitted: submittedSet.has(m.id),
    reportStatus: submitted.find((r) => r.studentId === m.id)?.status ?? null,
    isLate: submitted.find((r) => r.studentId === m.id)?.isLate ?? false,
  }));

  res.json({ data: result, weekStart: weekStart.toISOString() });
});

// ─── GET /api/weekly-reports/:id ─────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { userId, role } = req.user!;

  const report = await prisma.weeklyReport.findUnique({
    where: { id: req.params.id },
    select: reportSelect,
  });

  if (!report) { res.status(404).json({ error: 'Report not found' }); return; }

  // Members can only view their own reports
  if (role === 'member' && report.student.id !== userId) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  res.json(report);
});

// ─── POST /api/weekly-reports ─────────────────────────────────────────────────
// Member submits weekly report (one per week, enforced by unique constraint)
router.post('/', requireRole('member', 'professor', 'admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const { userId, role } = req.user!;

  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  // Allow admin/professor to submit on behalf of a student (for testing)
  const studentId = (role === 'member') ? userId : (req.body.studentId ?? userId);

  const weekStart = getWeekStart();
  const isLate = isPastDeadline(weekStart);

  try {
    const { requestMeeting: _rm, ...reportData } = parsed.data;
    const report = await prisma.weeklyReport.create({
      data: {
        studentId,
        weekStart,
        isLate,
        ...reportData,
        requestMeeting: parsed.data.requestMeeting ?? false,
      },
      select: reportSelect,
    });

    // If requestMeeting flag set, create a MeetingRequest automatically
    if (parsed.data.requestMeeting) {
      await prisma.meetingRequest.create({
        data: { reportId: report.id, requesterId: studentId },
      });
    }

    res.status(201).json(report);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'You have already submitted a report for this week.' });
      return;
    }
    throw err;
  }
});

// ─── PATCH /api/weekly-reports/:id/review ────────────────────────────────────
// Professor marks report as reviewed
router.patch('/:id/review', requireRole('professor', 'admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const report = await prisma.weeklyReport.findUnique({ where: { id: req.params.id } });
  if (!report) { res.status(404).json({ error: 'Not found' }); return; }

  const updated = await prisma.weeklyReport.update({
    where: { id: req.params.id },
    data: { status: 'reviewed' },
    select: reportSelect,
  });

  res.json(updated);
});

// ─── POST /api/weekly-reports/:id/comments ───────────────────────────────────
router.post('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  const { userId, role } = req.user!;

  const report = await prisma.weeklyReport.findUnique({ where: { id: req.params.id } });
  if (!report) { res.status(404).json({ error: 'Not found' }); return; }

  // Members can only comment on their own reports
  if (role === 'member' && report.studentId !== userId) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const comment = await prisma.reportComment.create({
    data: {
      reportId: req.params.id,
      authorId: userId,
      text: parsed.data.text,
      parentCommentId: parsed.data.parentCommentId ?? null,
      selectionMetadata: parsed.data.selectionMetadata
        ? JSON.stringify(parsed.data.selectionMetadata)
        : null,
    },
    select: {
      id: true,
      text: true,
      selectionMetadata: true,
      createdAt: true,
      author: { select: { id: true, fullName: true, role: true } },
      replies: { select: { id: true } },
    },
  });

  // If professor comments → set status to 'discussion'
  if (['professor', 'admin', 'super_admin'].includes(role) && report.status === 'pending') {
    await prisma.weeklyReport.update({
      where: { id: req.params.id },
      data: { status: 'discussion' },
    });
  }

  res.status(201).json(comment);
});

// ─── POST /api/weekly-reports/:id/meetings ───────────────────────────────────
// Professor requests a meeting for a specific report
router.post('/:id/meetings', requireRole('professor', 'admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.user!;

  const report = await prisma.weeklyReport.findUnique({ where: { id: req.params.id } });
  if (!report) { res.status(404).json({ error: 'Not found' }); return; }

  const meeting = await prisma.meetingRequest.create({
    data: {
      reportId: req.params.id,
      requesterId: userId,
      notes: req.body.notes ?? null,
    },
  });

  res.status(201).json(meeting);
});

// ─── PATCH /api/weekly-reports/meetings/:mid ─────────────────────────────────
router.patch('/meetings/:mid', requireRole('professor', 'admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  const { status, notes } = req.body as { status?: string; notes?: string };

  const meeting = await prisma.meetingRequest.update({
    where: { id: req.params.mid },
    data: { status, notes },
  });

  res.json(meeting);
});

// ─── POST /api/weekly-reports/:id/images ─────────────────────────────────────
// Add an image (url + caption) to a report — after the report is created
router.post('/:id/images', async (req: Request, res: Response): Promise<void> => {
  const { userId, role } = req.user!;

  const report = await prisma.weeklyReport.findUnique({ where: { id: req.params.id } });
  if (!report) { res.status(404).json({ error: 'Report not found' }); return; }

  // Members can only add images to their own reports
  if (role === 'member' && report.studentId !== userId) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  const { url, caption, displayOrder } = req.body as { url: string; caption?: string; displayOrder?: number };
  if (!url) { res.status(400).json({ error: 'url is required' }); return; }

  const image = await prisma.reportImage.create({
    data: {
      reportId: req.params.id,
      url,
      caption: caption ?? null,
      displayOrder: displayOrder ?? 0,
    },
  });

  res.status(201).json(image);
});

// ─── DELETE /api/weekly-reports/:id/images/:imgId ────────────────────────────
router.delete('/:id/images/:imgId', async (req: Request, res: Response): Promise<void> => {
  const { userId, role } = req.user!;

  const report = await prisma.weeklyReport.findUnique({ where: { id: req.params.id } });
  if (!report) { res.status(404).json({ error: 'Report not found' }); return; }

  if (role === 'member' && report.studentId !== userId) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  await prisma.reportImage.delete({ where: { id: req.params.imgId } });
  res.json({ ok: true });
});

export default router;
