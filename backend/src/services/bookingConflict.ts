import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Check for booking conflicts on a given equipment.
 * Returns the next available start time if there is a conflict, or null if no conflict.
 */
export async function checkBookingConflict(
  equipmentId: string,
  start: Date,
  end: Date,
): Promise<Date | null> {
  const conflicts = await prisma.booking.findMany({
    where: {
      equipmentId,
      status: { in: ['confirmed', 'pending'] },
      isArchived: false,
      NOT: {
        OR: [
          { endDatetime: { lte: start } },
          { startDatetime: { gte: end } },
        ],
      },
    },
    orderBy: { endDatetime: 'asc' },
  });

  if (conflicts.length === 0) return null;

  // Return the earliest end time as the next available slot
  return conflicts[conflicts.length - 1].endDatetime;
}
