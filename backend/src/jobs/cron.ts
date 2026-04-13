import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const prisma = new PrismaClient();

export function startCronJobs() {
  // Auto-archive expired bookings (every hour)
  cron.schedule('0 * * * *', async () => {
    const result = await prisma.booking.updateMany({
      where: {
        endDatetime: { lt: new Date() },
        status: 'confirmed',
        isArchived: false,
      },
      data: {
        status: 'completed',
        isArchived: true,
      },
    });

    if (result.count > 0) {
      console.log(`[cron] Auto-archived ${result.count} expired bookings`);
    }
  });

  // Auto-archive old procurements for professor review (daily at midnight)
  cron.schedule('0 0 * * *', async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const result = await prisma.procurementRequest.updateMany({
      where: {
        createdAt: { lt: sixMonthsAgo },
        isArchived: false,
        status: { in: ['delivered', 'declined', 'cancelled'] },
      },
      data: { isArchived: true },
    });

    if (result.count > 0) {
      console.log(`[cron] Auto-archived ${result.count} old procurement requests`);
    }
  });

  // Friday 8 PM KST (= Friday 11:00 UTC) — notify professors of submission status
  // "0 11 * * 5" = 11:00 UTC every Friday
  cron.schedule('0 11 * * 5', async () => {
    const weekStart = getWeekStart();

    const members = await prisma.appUser.findMany({
      where: { role: 'member', active: true },
      select: { id: true, fullName: true },
    });

    const submitted = await prisma.weeklyReport.findMany({
      where: { weekStart },
      select: { studentId: true },
    });

    const submittedIds = new Set(submitted.map((r) => r.studentId));
    const notSubmitted = members.filter((m) => !submittedIds.has(m.id));

    const professors = await prisma.appUser.findMany({
      where: { role: 'professor', active: true },
      select: { id: true },
    });

    // Create an in-app notification for each professor
    if (professors.length > 0 && members.length > 0) {
      const summary = notSubmitted.length === 0
        ? `All ${members.length} members submitted their weekly report.`
        : `Weekly report summary: ${submittedIds.size}/${members.length} submitted. Missing: ${notSubmitted.map((m) => m.fullName).join(', ')}.`;

      await prisma.auditLog.createMany({
        data: professors.map((p) => ({
          userId: p.id,
          action: 'WEEKLY_REPORT_SUMMARY',
          resourceType: 'weekly_report',
          note: summary,
        })),
      });

      console.log(`[cron] Friday summary: ${summary}`);
    }
  });

  console.log('[cron] Jobs scheduled');
}
